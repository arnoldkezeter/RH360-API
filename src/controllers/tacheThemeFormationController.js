import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import TacheThemeFormation from '../models/TacheThemeFormation.js';
import TacheGenerique from '../models/TacheGenerique.js';
import ThemeFormation from '../models/ThemeFormation.js'; // Ajout supposé
import Formation from '../models/Formation.js';
import { notifierChangementStatutTache } from '../services/notificationService.js';

// Fonction helper pour valider ObjectId
const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Fonction helper pour vérifier les autorisations
const checkUserPermission = (user, tache, action = 'read') => {
  if (!user) return false;
  
  // Admin peut tout faire
  if (user.role === 'super-admin' || user.role === 'admin') return true;
  
  // Pour les actions de modification, seul le responsable peut agir
  if (['execute', 'update', 'delete'].includes(action)) {
    return tache.responsable?.toString() === user._id.toString();
  }
  
  // Pour la lecture, plus permissif selon vos règles métier
  return true;
};



export const executerTacheTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId, tacheId, statut } = req.body;
  const currentUser = req.user;

  // Validation des IDs
  if (!validateObjectId(themeId) || !validateObjectId(tacheId)) {
    return res.status(400).json({ 
      success: false, 
      message: t('identifiant_invalide', lang) 
    });
  }

  const statutsValides = ['A_FAIRE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE'];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ 
      success: false, 
      message: t('statut_invalide', lang),
      statutsValides 
    });
  }

  try {
    // Vérifier l'existence du thème
    const theme = await ThemeFormation.findById(themeId).populate({ path:'responsable', select:"nom prenom email", strictPopulate:false });
    if (!theme) {
      return res.status(404).json({ 
        success: false, 
        message: t('theme_non_trouve', lang) 
      });
    }

    // Déterminer le responsable
    const responsableId = theme.responsable?._id || currentUser._id;
    if (responsableId && !validateObjectId(responsableId)) {
      return res.status(400).json({ 
        success: false, 
        message: t('responsable_invalide', lang) 
      });
    }

    // Vérifier l'existence et l'état de la tâche
    const tache = await TacheGenerique.findById(tacheId);
    if (!tache || !tache.actif) {
      return res.status(404).json({ 
        success: false, 
        message: t('tache_non_trouvee', lang) 
      });
    }

    // Vérifier si déjà lié
    const existingLink = await TacheThemeFormation.findOne({ 
      theme: themeId, 
      tache: tacheId })
      .populate({ path: 'theme', select:'titreFr titreEn', options: { strictPopulate: false } })
      .populate({ path: 'tache', options: { strictPopulate: false } })
    if (existingLink) {
        // Sauvegarder l'ancien statut
        const ancienStatut = existingLink.statut;

        // Logique métier pour les changements de statut
        if (statut === 'TERMINE' && !existingLink.estExecutee) {
          return res.status(400).json({
            success: false,
            message: t('tache_non_executee', lang)
          });
        }

        if (statut === 'EN_ATTENTE') {
          existingLink.dateExecution = new Date();
          existingLink.dateFin = new Date();
        }

        if (statut === 'EN_COURS') {
          existingLink.dateExecution = new Date();
        }

        if (statut === 'TERMINE') {
          existingLink.dateExecution = new Date();
        }
        existingLink.executePar = currentUser._id;
        existingLink.statut = statut;
        // tache.donnees = donnees;
        await existingLink.save();

        if (ancienStatut !== statut) {
          try {
            await notifierChangementStatutTache({
              tache:existingLink,
              ancienStatut,
              nouveauStatut: statut,
              modifiePar: currentUser._id,
              theme: existingLink.theme
            });
          } catch (notifError) {
            // Logger l'erreur mais ne pas bloquer la réponse
            console.error('Erreur envoi notifications:', notifError);
          }
        }

        return res.json({ 
          success: true, 
          message: t('modifier_succes', lang),
          data: existingLink 
        });
    }

    // Création du lien tâche <-> thème
    const tacheTheme = new TacheThemeFormation({
      theme: themeId,
      tache: tacheId,
      dateDebut: new Date(),
      statut:statut
    });
    await tacheTheme.save();

    // Mise à jour nbTachesTotal dans ThemeFormation
    const nbTachesTheme = await TacheThemeFormation.countDocuments({ theme: themeId });
    theme.nbTachesTotal = nbTachesTheme;
    await theme.save();

    // Mise à jour nbTachesTotal dans Formation associée
    if (theme.formation) {
      const nbTachesFormation = await TacheThemeFormation.countDocuments({ theme: { $in: await ThemeFormation.find({ formation: theme.formation }).distinct('_id') } });
      await Formation.findByIdAndUpdate(theme.formation, { nbTachesTotal: nbTachesFormation });
    }

    // Populer les données pour la réponse
    await tacheTheme.populate([
      { path: 'tache'},
      { path: 'theme', select: 'titreFr titreEn' },
    ]);
    try {
      await notifierChangementStatutTache({
        tache:tacheTheme,
        ancienStatut:"A_FAIRE",
        nouveauStatut: statut,
        modifiePar: currentUser._id,
        theme: theme
      });
    } catch (notifError) {
      // Logger l'erreur mais ne pas bloquer la réponse
      console.error('Erreur envoi notifications:', notifError);
    }

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: tacheTheme,
    });

  } catch (err) {
    console.error('Erreur ajouterTacheAuTheme:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


// export const getTachesParTheme = async (req, res) => {
//   const { themeId } = req.params;
//   const lang = req.headers['accept-language'] || 'fr';
//   const search = req.query.nom?.trim() || '';
//   const statut = req.query.statut;
//   const estExecutee = req.query.estExecutee;
//   const page = Math.max(1, parseInt(req.query.page) || 1);
//   const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

//   if (!validateObjectId(themeId)) {
//     return res.status(400).json({
//       success: false,
//       message: t('identifiant_invalide', lang),
//     });
//   }

//   try {
//     // Vérifier l'existence du thème
//     const theme = await ThemeFormation.findById(themeId);
//     if (!theme) {
//       return res.status(404).json({
//         success: false,
//         message: t('theme_non_trouve', lang),
//       });
//     }

//     // Construction de la requête de base
//     let query = { theme: themeId };

//     // Filtres additionnels
//     if (statut) {
//       query.statut = statut;
//     }

//     if (estExecutee !== undefined) {
//       query.estExecutee = estExecutee === 'true';
//     }

//     // Si on a une recherche, on doit d'abord chercher les tâches qui matchent
//     let tacheIds = null;
//     if (search && search.trim() !== '') {
//       const tachesMatching = await TacheGenerique.find({
//         $or: [
//           { nomFr: { $regex: new RegExp(search, 'i') } },
//           { nomEn: { $regex: new RegExp(search, 'i') } }
//         ]
//       }).select('_id');
      
//       tacheIds = tachesMatching.map(t => t._id);
      
//       // Si aucune tâche ne correspond à la recherche, retourner un résultat vide
//       if (tacheIds.length === 0) {
//         return res.status(200).json({
//           success: true,
//           data: {
//             tachesThemeFormation: [],
//             totalItems: 0,
//             currentPage: page,
//             totalPages: 0,
//             pageSize: limit,
//           },
//         });
//       }
      
//       query.tache = { $in: tacheIds };
//     }

//     // Compter le total
//     const total = await TacheThemeFormation.countDocuments(query);

//     // Récupérer TOUTES les tâches (sans pagination d'abord) pour pouvoir trier
//     const allTaches = await TacheThemeFormation.find(query)
//     .populate({
//           path: 'theme',
//           select: 'titreFr titreEn formation responsable',
//           options: { strictPopulate: false },
//           populate: {
//               path: 'formation',
//               select: 'titreFr titreEn'
//           },
//           populate: {
//               path: 'responsable',
//               select: 'nom prenom'
//           }
//       })
//       .populate({ 
//         path: 'tache', 
//         select: 'nomFr nomEn type obligatoire code',
//         options: { strictPopulate: false } 
//       })
//       .lean();

//     // Tri par ordre alphabétique sur le nom des tâches selon la langue
//     const sortedTaches = allTaches.sort((a, b) => {
//       const nameA = lang === 'fr' ? (a.tache?.nomFr || '') : (a.tache?.nomEn || '');
//       const nameB = lang === 'fr' ? (b.tache?.nomFr || '') : (b.tache?.nomEn || '');
//       return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
//     });

//     // Appliquer la pagination APRÈS le tri
//     const startIndex = (page - 1) * limit;
//     const endIndex = startIndex + limit;
//     const paginatedTaches = sortedTaches.slice(startIndex, endIndex);

//     return res.status(200).json({
//       success: true,
//       data: {
//         tachesThemeFormation: paginatedTaches,
//         totalItems: total,
//         currentPage: page,
//         totalPages: Math.ceil(total / limit),
//         pageSize: limit,
//       },
//     });
//   } catch (err) {
//     console.error('Erreur getTachesParTheme:', err);
//     return res.status(500).json({
//       success: false,
//       message: t('erreur_serveur', lang),
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined,
//     });
//   }
// };

export const getTachesParTheme = async (req, res) => {
  const { themeId } = req.params;
  const lang = req.headers['accept-language'] || 'fr';
  const search = req.query.nom?.trim() || '';
  const statut = req.query.statut;
  const estExecutee = req.query.estExecutee;
  const niveau = req.query.niveau; // 'pre-formation', 'pendant-formation', 'post-formation'
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

  if (!validateObjectId(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    // Vérifier l'existence du thème
    const theme = await ThemeFormation.findById(themeId)
      .select('titreFr titreEn formation responsable')
      .populate('formation', 'titreFr titreEn')
      .populate('responsable', 'nom prenom')
      .lean();
      
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: t('theme_non_trouve', lang),
      });
    }

    // Construction de la requête pour les tâches génériques
    let queryTachesGeneriques = { actif: true };

    // Filtre par niveau si spécifié
    if (niveau) {
      queryTachesGeneriques.niveau = niveau;
    }

    // Filtre par recherche sur le nom
    if (search && search.trim() !== '') {
      queryTachesGeneriques.$or = [
        { nomFr: { $regex: new RegExp(search, 'i') } },
        { nomEn: { $regex: new RegExp(search, 'i') } },
        { code: { $regex: new RegExp(search, 'i') } }
      ];
    }

    // Récupérer toutes les tâches génériques correspondant aux critères
    const tachesGeneriques = await TacheGenerique.find(queryTachesGeneriques)
      .sort({ ordre: 1 }) // Tri par ordre défini dans TacheGenerique
      .lean();

    if (tachesGeneriques.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          tachesThemeFormation: [],
          totalItems: 0,
          currentPage: page,
          totalPages: 0,
          pageSize: limit,
        },
      });
    }

    // Récupérer les tâches déjà associées au thème
    const tachesTheme = await TacheThemeFormation.find({ 
      theme: themeId 
    })
    .populate('executePar', 'nom prenom')
    .lean();

    // Créer un map pour accès rapide par tâche ID
    const tachesThemeMap = tachesTheme.reduce((acc, tacheTheme) => {
      acc[tacheTheme.tache.toString()] = tacheTheme;
      return acc;
    }, {});

    // Enrichir les tâches génériques avec les données du thème
    let tachesEnrichies = tachesGeneriques.map(tacheGenerique => {
      const tacheThemeData = tachesThemeMap[tacheGenerique._id.toString()];

      return {
        _id: tacheThemeData?._id || null, // ID de TacheThemeFormation si existe
        tache: {
          _id: tacheGenerique._id,
          code: tacheGenerique.code,
          nomFr: tacheGenerique.nomFr,
          nomEn: tacheGenerique.nomEn,
          descriptionFr: tacheGenerique.descriptionFr,
          descriptionEn: tacheGenerique.descriptionEn,
          niveau: tacheGenerique.niveau,
          type: tacheGenerique.type,
          obligatoire: tacheGenerique.obligatoire,
          ordre: tacheGenerique.ordre,
        },
        theme: {
          _id: theme._id,
          titreFr: theme.titreFr,
          titreEn: theme.titreEn,
          formation: theme.formation,
          responsable: theme.responsable,
        },
        // Données de TacheThemeFormation si la tâche est déjà associée
        dateDebut: tacheThemeData?.dateDebut || null,
        dateFin: tacheThemeData?.dateFin || null,
        estExecutee: tacheThemeData?.estExecutee || false,
        fichierJoint: tacheThemeData?.fichierJoint || null,
        donnees: tacheThemeData?.donnees || null,
        dateExecution: tacheThemeData?.dateExecution || null,
        statut: tacheThemeData?.statut || 'A_FAIRE',
        commentaires: tacheThemeData?.commentaires || null,
        executePar: tacheThemeData?.executePar || null,
        createdAt: tacheThemeData?.createdAt || null,
        updatedAt: tacheThemeData?.updatedAt || null,
      };
    });

    // Appliquer les filtres sur les données enrichies
    if (statut) {
      tachesEnrichies = tachesEnrichies.filter(t => t.statut === statut);
    }

    if (estExecutee !== undefined) {
      const isExecuted = estExecutee === 'true';
      tachesEnrichies = tachesEnrichies.filter(t => t.estExecutee === isExecuted);
    }

    // Tri par ordre (déjà trié par TacheGenerique.ordre)
    // Mais on peut aussi trier par nom si nécessaire
    const sortField = lang === 'fr' ? 'nomFr' : 'nomEn';
    tachesEnrichies.sort((a, b) => {
      // D'abord par ordre
      if (a.tache.ordre !== b.tache.ordre) {
        return a.tache.ordre - b.tache.ordre;
      }
      // Ensuite par nom alphabétique
      const nameA = a.tache[sortField] || '';
      const nameB = b.tache[sortField] || '';
      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
    });

    // Calculer le total après filtrage
    const total = tachesEnrichies.length;

    // Appliquer la pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTaches = tachesEnrichies.slice(startIndex, endIndex);

    return res.status(200).json({
      success: true,
      data: {
        tachesThemeFormation: paginatedTaches,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
      },
    });
  } catch (err) {
    console.error('Erreur getTachesParTheme:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

export const executerTache = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { tacheFormationId, currentUserId } = req.params;

  if (!validateObjectId(tacheFormationId)) {
    return res.status(400).json({ 
      success: false, 
      message: t('identifiant_invalide', lang) 
    });
  }

  if (!validateObjectId(currentUserId)) {
    return res.status(400).json({ 
      success: false, 
      message: t('identifiant_invalide', lang) 
    });
  }

  try {
    const tacheFormation = await TacheThemeFormation.findById(tacheFormationId)
      .populate('tache');

    if (!tacheFormation) {
      console.log("non trouvee")
      return res.status(404).json({ 
        success: false, 
        message: t('tache_non_trouvee', lang) 
      });
    }

    // Vérifier si déjà exécutée
    // if (tacheFormation.estExecutee) {
    //   return res.status(400).json({
    //     success: false,
    //     message: t('tache_deja_executee', lang)
    //   });
    // }

    // ✅ Mise à jour des champs de la tâche
    tacheFormation.statut = 'TERMINE';
    tacheFormation.dateExecution = new Date();
    tacheFormation.estExecutee = true;
    tacheFormation.executePar = currentUserId;

    await tacheFormation.save();

    const themeId = tacheFormation.theme;

    // ✅ Mettre à jour nbTachesExecutees du thème
    const nbTachesExecuteesTheme = await TacheThemeFormation.countDocuments({ 
      theme: themeId, 
      estExecutee: true 
    });
    await ThemeFormation.findByIdAndUpdate(themeId, { nbTachesExecutees: nbTachesExecuteesTheme });

    // ✅ Mettre à jour nbTachesExecutees de la formation
    const theme = await ThemeFormation.findById(themeId);
    if (theme && theme.formation) {
      const nbTachesExecuteesFormation = await TacheThemeFormation.countDocuments({
        theme: { $in: await ThemeFormation.find({ formation: theme.formation }).distinct('_id') },
        estExecutee: true
      });
      await Formation.findByIdAndUpdate(theme.formation, { nbTachesExecutees: nbTachesExecuteesFormation });
    }

    return res.json({ 
      success: true, 
      message: t('tache_executee_succes', lang),
      data: tacheFormation
    });
  } catch (err) {
    console.error('Erreur executerTache:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


// export const changerStatutTache = async (req, res) => {
//     const lang = req.headers['accept-language'] || 'fr';
//     const { tacheFormationId, currentUser } = req.params;
//     const {statut, donnees=""}=req.body
//     // Validation du statut
//     const statutsValides = ['A_FAIRE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE'];
//     if (!statutsValides.includes(statut)) {
//       return res.status(400).json({ 
//         success: false, 
//         message: t('statut_invalide', lang),
//         statutsValides 
//       });
//     }

//     if (!validateObjectId(tacheFormationId)) {
//       return res.status(400).json({
//         success: false,
//         message: t('identifiant_invalide', lang)
//       });
//     }

//     try {
//       const tache = await TacheThemeFormation.findById(tacheFormationId);
      
//       if (!tache) {
//         return res.status(404).json({ 
//           success: false, 
//           message: t('tache_non_trouvee', lang) 
//         });
//       }

    
//       // Logique métier pour les changements de statut
//       if (statut === 'TERMINE' && !tache.estExecutee) {
//         return res.status(400).json({
//           success: false,
//           message: t('tache_non_executee', lang)
//         });
//       }

//       if (statut === 'EN_ATTENTE') {
//         tache.dateDebut = tache.dateDebut || new Date();
//       }

//       if (statut === 'EN_COURS') {
//         tache.dateDebut = tache.dateDebut || new Date();
//       }

//       if (statut === 'TERMINE') {
//         tache.dateFin = new Date();
//       }

//       tache.statut = statut;
//       tache.donnees = donnees;
//       await tache.save();

//       return res.json({ 
//         success: true, 
//         message: t('statut_modifie_succes', lang),
//         data: tache 
//       });
//     } catch (err) {
//       console.error('Erreur changerStatutTache:', err);
//       return res.status(500).json({
//         success: false,
//         message: t('erreur_serveur', lang),
//         error: process.env.NODE_ENV === 'development' ? err.message : undefined,
//       });
//     }
// };


export const changerStatutTache = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { tacheFormationId, currentUserId } = req.params;
  const { statut, donnees = "" } = req.body;

  // Validation du statut
  const statutsValides = ['A_FAIRE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE'];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ 
      success: false, 
      message: t('statut_invalide', lang),
      statutsValides 
    });
  }

  if (!validateObjectId(tacheFormationId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang)
    });
  }

  try {
    const tache = await TacheThemeFormation.findById(tacheFormationId)
      .populate({
        path: 'theme',
        select: 'titreFr titreEn responsable',
        
      });
    
    if (!tache) {
      return res.status(404).json({ 
        success: false, 
        message: t('tache_non_trouvee', lang) 
      });
    }

    // Sauvegarder l'ancien statut
    const ancienStatut = tache.statut;

    // Logique métier pour les changements de statut
    if (statut === 'TERMINE' && !tache.estExecutee) {
      return res.status(400).json({
        success: false,
        message: t('tache_non_executee', lang)
      });
    }

    if (statut === 'EN_ATTENTE') {
      tache.dateDebut = tache.dateDebut || new Date();
    }

    if (statut === 'EN_COURS') {
      tache.dateDebut = tache.dateDebut || new Date();
    }

    if (statut === 'TERMINE') {
      tache.dateFin = new Date();
    }
    tache.executePar = currentUserId;
    tache.statut = statut;
    tache.donnees = donnees;
    await tache.save();

    // Envoyer les notifications si le statut a changé
    if (ancienStatut !== statut) {
      try {
        await notifierChangementStatutTache({
          tache,
          ancienStatut,
          nouveauStatut: statut,
          modifiePar: currentUserId,
          theme: tache.theme
        });
      } catch (notifError) {
        // Logger l'erreur mais ne pas bloquer la réponse
        console.error('Erreur envoi notifications:', notifError);
      }
    }

    return res.json({ 
      success: true, 
      message: t('modifier_succes', lang),
      data: tache 
    });
  } catch (err) {
    console.error('Erreur changerStatutTache:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


export const reinitialiserToutesLesTaches = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    // Mettre à jour toutes les tâches en BD
    const result = await TacheThemeFormation.updateMany(
      {}, // filtre vide = toutes les tâches
      { 
        $set: { 
          statut: 'A_FAIRE',
          dateDebut: null,
          dateFin: null 
        } 
      }
    );

    return res.json({
      success: true,
      message: t('toutes_taches_reinitialisees', lang),
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('Erreur reinitialiserToutesLesTaches:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


export const reinitialiserTache = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { tacheFormationId } = req.params;
  const currentUser = req.user;

  if (!validateObjectId(tacheFormationId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang)
    });
  }

  try {
    const tache = await TacheThemeFormation.findById(tacheFormationId);
    
    if (!tache) {
      return res.status(404).json({ 
        success: false, 
        message: t('tache_non_trouvee', lang) 
      });
    }

    // Vérification des autorisations
    if (!checkUserPermission(currentUser, tache, 'update')) {
      return res.status(403).json({
        success: false,
        message: t('acces_refuse', lang)
      });
    }

    // Réinitialisation
    tache.estExecutee = false;
    tache.statut = 'EN_ATTENTE';
    tache.fichierJoint = null;
    tache.donnees = {};
    tache.dateExecution = null;
    tache.commentaires = '';

    await tache.save();
    
    res.json({ 
      success: true, 
      message: t('tache_reinitialise', lang),
      data: tache
    });
  } catch (err) {
    console.error('Erreur reinitialiserTache:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

export const getStatutExecutionTheme = async (req, res) => {
  const { themeId } = req.params;
  const lang = req.headers['accept-language'] || 'fr';

  if (!validateObjectId(themeId)) {
    return res.status(400).json({ 
      success: false, 
      message: t('identifiant_invalide', lang) 
    });
  }

  try {
    // Vérifier l'existence du thème
    const theme = await ThemeFormation.findById(themeId);
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: t('theme_non_trouve', lang)
      });
    }

    // Statistiques détaillées
    const stats = await TacheThemeFormation.aggregate([
      { $match: { theme: new mongoose.Types.ObjectId(themeId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          executees: { $sum: { $cond: ['$estExecutee', 1, 0] } },
          enAttente: { $sum: { $cond: [{ $eq: ['$statut', 'EN_ATTENTE'] }, 1, 0] } },
          enCours: { $sum: { $cond: [{ $eq: ['$statut', 'EN_COURS'] }, 1, 0] } },
          terminees: { $sum: { $cond: [{ $eq: ['$statut', 'TERMINE'] }, 1, 0] } },
          obligatoires: {
            $sum: {
              $cond: [
                { $and: ['$tache.obligatoire', { $not: '$estExecutee' }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      executees: 0,
      enAttente: 0,
      enCours: 0,
      terminees: 0,
      obligatoires: 0
    };

    const taux = result.total > 0 ? Math.round((result.executees / result.total) * 100) : 0;

    return res.json({
      success: true,
      data: {
        ...result,
        taux,
        restantes: result.total - result.executees,
        pourcentageTerminees: result.total > 0 ? Math.round((result.terminees / result.total) * 100) : 0
      }
    });
  } catch (err) {
    console.error('Erreur getStatutExecutionTheme:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


export const supprimerTacheDuTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { tacheFormationId } = req.params;

  if (!validateObjectId(tacheFormationId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang)
    });
  }

  try {
    const tacheFormation = await TacheThemeFormation.findById(tacheFormationId);
    
    if (!tacheFormation) {
      return res.status(404).json({
        success: false,
        message: t('tache_non_trouvee', lang)
      });
    }

    const themeId = tacheFormation.theme;

    // Supprimer la tâche
    await TacheThemeFormation.deleteOne({ _id: tacheFormationId });

    // Mettre à jour nbTachesTotal dans ThemeFormation
    const nbTachesTheme = await TacheThemeFormation.countDocuments({ theme: themeId });
    await ThemeFormation.findByIdAndUpdate(themeId, { nbTachesTotal: nbTachesTheme });

    // Mettre à jour nbTachesTotal dans Formation associée
    const theme = await ThemeFormation.findById(themeId);
    if (theme && theme.formation) {
      const nbTachesFormation = await TacheThemeFormation.countDocuments({
        theme: { $in: await ThemeFormation.find({ formation: theme.formation }).distinct('_id') }
      });
      await Formation.findByIdAndUpdate(theme.formation, { nbTachesTotal: nbTachesFormation });
    }

    return res.json({
      success: true,
      message: t('supprimer_succes', lang)
    });
  } catch (err) {
    console.error('Erreur supprimerTacheDuTheme:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Nouvelle fonction pour obtenir une tâche spécifique
export const getTacheThemeById = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { tacheFormationId } = req.params;

  if (!validateObjectId(tacheFormationId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang)
    });
  }

  try {
    const tacheFormation = await TacheThemeFormation.findById(tacheFormationId)
      .populate('tache')
      .populate('theme', 'nomFr nomEn')
      .populate('responsable', 'nom prenom email')
      .lean();

    if (!tacheFormation) {
      return res.status(404).json({
        success: false,
        message: t('tache_non_trouvee', lang)
      });
    }

    return res.json({
      success: true,
      data: tacheFormation
    });
  } catch (err) {
    console.error('Erreur getTacheThemeById:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const updateTachesResponsable = async (req, res) => {
    try {
      const { tacheFormationId } = req.params;
      const { responsableId } = req.body;
      const lang = req.headers['accept-language'] || 'fr';

      const tacheFormation = await TacheThemeFormation.findByIdAndUpdate(
        tacheFormationId,
        { responsable: responsableId },
        { new: true }
      ).populate('responsable', 'nom prenom email');

      if (!tacheFormation) {
        return res.status(404).json({
          success: false,
          message: t('tache_non_trouvee', lang)
        });
      }

      return res.json({
        success: true,
        message: t('responsable_modifie_succes', lang),
        data: tacheFormation
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
}

export const updateDate = async (req, res) => {
    try {
      const { tacheFormationId } = req.params;
      const { dateDebut, dateFin } = req.body;
      const lang = req.headers['accept-language'] || 'fr';

      const updateData = {};
      if (dateDebut !== undefined) updateData.dateDebut = dateDebut ? new Date(dateDebut) : null;
      if (dateFin !== undefined) updateData.dateFin = dateFin ? new Date(dateFin) : null;

      const tacheFormation = await TacheThemeFormation.findByIdAndUpdate(
        tacheFormationId,
        updateData,
        { new: true }
      );

      if (!tacheFormation) {
        return res.status(404).json({
          success: false,
          message: t('tache_non_trouvee', lang)
        });
      }

      return res.json({
        success: true,
        message: t('modifier_succes', lang),
        data: tacheFormation
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
}

export const getUserTaches = async (req, res) => {
    // Cette fonction devrait être ajoutée au contrôleur
    try {
      const { userId } = req.params;
      const { statut, estExecutee, page = 1, limit = 10 } = req.query;
      const lang = req.headers['accept-language'] || 'fr';

      let query = { responsable: userId };
      
      if (statut) query.statut = statut;
      if (estExecutee !== undefined) query.estExecutee = estExecutee === 'true';

      const total = await TacheThemeFormation.countDocuments(query);
      
      const taches = await TacheThemeFormation.find(query)
        .populate('tache', 'code nomFr nomEn type')
        .populate('theme', 'nomFr nomEn')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: {
          taches,
          totalItems: total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          pageSize: parseInt(limit)
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
}


export const getTacheProgressionByTheme = async (req, res) => {
    const { themeId } = req.params; // Récupère le themeId depuis les paramètres de la route
    const lang = req.headers['accept-language'] || 'fr';
    
    // Validation de l'ID du thème
    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        // Préparer le filtre pour toutes les requêtes
        const filter = { theme: themeId };
        
        // Obtenir le nombre total de tâches pour ce thème
        const totalTaches = await TacheGenerique.countDocuments();
        
        // Si aucune tâche n'est trouvée pour ce thème, retourner 0% de progression
        if (totalTaches === 0) {
            return res.status(200).json({
                success: true,
                // message: t('aucune_tache_trouvee', lang),
                progressionExecutee: 0,
                progressionEnAttente: 0,
            });
        }
        
        // Compter les tâches exécutées pour ce thème
        const tachesExecutees = await TacheThemeFormation.countDocuments({
            ...filter,
            estExecutee: true
        });
        
        // Compter les tâches en attente pour ce thème
        const tachesEnAttente = await TacheThemeFormation.countDocuments({
            ...filter,
            statut: 'EN_ATTENTE'
        });
        
        // Calculer la progression en pourcentage
        const progressionExecutee = (tachesExecutees / totalTaches) * 100;
        const progressionEnAttente = (tachesEnAttente / totalTaches) * 100;
        
        return res.status(200).json({
            success: true,
            message: t('progression_taches_succes', lang),
            data: {
                progressionExecutee: Math.round(progressionExecutee),
                progressionEnAttente: Math.round(progressionEnAttente)
            }
        });
        
    } catch (err) {
        console.error("Erreur lors de la récupération de la progression des tâches par thème:", err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const statsTaches = async (req, res) => {
    try {
      const lang = req.headers['accept-language'] || 'fr';
      const { themeId } = req.query; // Optionnel : stats pour un thème spécifique

      // Récupérer toutes les tâches génériques actives
      const totalTachesGeneriques = await TacheGenerique.countDocuments({ actif: true });

      let query = {};
      
      // Si un themeId est fourni, filtrer par thème
      if (themeId) {
        if (!mongoose.Types.ObjectId.isValid(themeId)) {
          return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
          });
        }
        query.theme = themeId;
      }

      // Agréger les statistiques des tâches associées aux thèmes
      const stats = await TacheThemeFormation.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalTachesAssociees: { $sum: 1 },
            tachesExecutees: { $sum: { $cond: ['$estExecutee', 1, 0] } },
            tachesAFaire: { $sum: { $cond: [{ $eq: ['$statut', 'A_FAIRE'] }, 1, 0] } },
            tachesEnAttente: { $sum: { $cond: [{ $eq: ['$statut', 'EN_ATTENTE'] }, 1, 0] } },
            tachesEnCours: { $sum: { $cond: [{ $eq: ['$statut', 'EN_COURS'] }, 1, 0] } },
            tachesTerminees: { $sum: { $cond: [{ $eq: ['$statut', 'TERMINE'] }, 1, 0] } }
          }
        }
      ]);

      const statsResult = stats[0] || {
        totalTachesAssociees: 0,
        tachesExecutees: 0,
        tachesAFaire: 0,
        tachesEnAttente: 0,
        tachesEnCours: 0,
        tachesTerminees: 0
      };

      // Si c'est pour un thème spécifique
      if (themeId) {
        const tauxExecution = totalTachesGeneriques > 0 
          ? Math.round((statsResult.tachesExecutees / totalTachesGeneriques) * 100) 
          : 0;

        const tauxProgression = totalTachesGeneriques > 0
          ? Math.round((statsResult.totalTachesAssociees / totalTachesGeneriques) * 100)
          : 0;

        return res.json({
          success: true,
          data: {
            totalTachesDisponibles: totalTachesGeneriques, // Toutes les tâches génériques
            totalTachesAssociees: statsResult.totalTachesAssociees, // Tâches liées au thème
            tachesNonAssociees: totalTachesGeneriques - statsResult.totalTachesAssociees,
            tachesExecutees: statsResult.tachesExecutees,
            tachesRestantes: statsResult.totalTachesAssociees - statsResult.tachesExecutees,
            parStatut: {
              aFaire: statsResult.tachesAFaire,
              enAttente: statsResult.tachesEnAttente,
              enCours: statsResult.tachesEnCours,
              terminees: statsResult.tachesTerminees
            },
            tauxExecution, // % de tâches exécutées par rapport au total disponible
            tauxProgression, // % de tâches associées par rapport au total disponible
          }
        });
      }

      // Statistiques globales (tous les thèmes)
      const totalThemes = await ThemeFormation.countDocuments();
      
      // Calculer le nombre moyen de tâches par thème
      const moyenneTachesParTheme = totalThemes > 0 
        ? Math.round(statsResult.totalTachesAssociees / totalThemes) 
        : 0;

      // Taux d'exécution global
      const tauxExecutionGlobal = statsResult.totalTachesAssociees > 0 
        ? Math.round((statsResult.tachesExecutees / statsResult.totalTachesAssociees) * 100) 
        : 0;

      // Nombre de tâches potentielles (toutes les tâches × tous les thèmes)
      const totalTachesPotentielles = totalTachesGeneriques * totalThemes;
      const tauxAssociationGlobal = totalTachesPotentielles > 0
        ? Math.round((statsResult.totalTachesAssociees / totalTachesPotentielles) * 100)
        : 0;

      return res.json({
        success: true,
        data: {
          global: {
            totalTachesDisponibles: totalTachesGeneriques,
            totalThemes,
            totalTachesPotentielles, // Toutes les tâches × tous les thèmes
            totalTachesAssociees: statsResult.totalTachesAssociees,
            tachesExecutees: statsResult.tachesExecutees,
            tachesRestantes: statsResult.totalTachesAssociees - statsResult.tachesExecutees,
            moyenneTachesParTheme,
            tauxExecutionGlobal,
            tauxAssociationGlobal,
          },
          parStatut: {
            aFaire: statsResult.tachesAFaire,
            enAttente: statsResult.tachesEnAttente,
            enCours: statsResult.tachesEnCours,
            terminees: statsResult.tachesTerminees
          }
        }
      });
    } catch (error) {
      console.error('Erreur statsTaches:', error);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
};



// Script pour enregistrer les tâches du thème de formation
export const enregistrerTachesThemeFormation = async (req, res) => {
  try {
    // Données fournies
    const themeId = '687fbd32d50f59e9e063764f';
    const responsableId = '685040d2a917b66890fb7dfa';
    
    // Liste des tâches génériques
    const tachesGeneriques = [
      {
        "_id": "68906d9341ae42b9a7515bf2",
        "code": "def_objectifs",
        "nomFr": "Définition des objectifs",
        "nomEn": "Objectives Definition",
        "descriptionFr": "Définir et enregistrer les objectifs pédagogiques de la formation",
        "descriptionEn": "Define and record the pedagogical objectives of the training",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906d9641ae42b9a7515bfa",
        "code": "ident_participants",
        "nomFr": "Identification des participants",
        "nomEn": "Participants Identification",
        "descriptionFr": "Sélectionner les participants parmi les employés concernés selon les postes de travail du public cible",
        "descriptionEn": "Select participants from concerned employees according to target audience job positions",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906d9841ae42b9a7515bfe",
        "code": "ident_formateurs",
        "nomFr": "Identification des formateurs",
        "nomEn": "Trainers Identification",
        "descriptionFr": "Enregistrer et sélectionner les équipes pédagogiques dans l'application",
        "descriptionEn": "Register and select pedagogical teams in the application",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906d9a41ae42b9a7515c01",
        "code": "choix_lieu_periode",
        "nomFr": "Choix du lieu et de la période",
        "nomEn": "Venue and Period Selection",
        "descriptionFr": "Choisir le(s) lieu(x) de formation, la période et les jours concernés",
        "descriptionEn": "Choose training venue(s), period and concerned days",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906d9d41ae42b9a7515c04",
        "code": "elaboration_budget",
        "nomFr": "Élaboration du budget",
        "nomEn": "Budget Development",
        "descriptionFr": "Élaborer et enregistrer le budget prévisionnel de la formation",
        "descriptionEn": "Develop and record the training budget forecast",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906d9f41ae42b9a7515c07",
        "code": "elaboration_tdr",
        "nomFr": "Élaboration des termes de référence",
        "nomEn": "Terms of Reference Development",
        "descriptionFr": "Élaborer les termes de référence de la formation",
        "descriptionEn": "Develop the training terms of reference",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da141ae42b9a7515c0a",
        "code": "note_service_convocation",
        "nomFr": "Élaboration de la note de service convoquant les participants",
        "nomEn": "Service Note for Participants Convocation",
        "descriptionFr": "Génération automatique de la note de service pour convoquer les participants",
        "descriptionEn": "Automatic generation of service note to convene participants",
        "type": "autoGenerate",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da241ae42b9a7515c0d",
        "code": "note_presentation",
        "nomFr": "Élaboration de la note de présentation",
        "nomEn": "Presentation Note Development",
        "descriptionFr": "Génération automatique de la note de présentation de la formation",
        "descriptionEn": "Automatic generation of training presentation note",
        "type": "autoGenerate",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da541ae42b9a7515c10",
        "code": "validation_dg",
        "nomFr": "Validation par le Directeur Général",
        "nomEn": "General Director Validation",
        "descriptionFr": "Upload de la note de service signée et scannée par le DG pour validation",
        "descriptionEn": "Upload of service note signed and scanned by General Director for validation",
        "type": "upload",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da541ae42b9a7515c13",
        "code": "reunion_prep_beneficiaires",
        "nomFr": "Réunion préparatoire avec les services bénéficiaires",
        "nomEn": "Preparatory Meeting with Beneficiary Services",
        "descriptionFr": "Organiser et valider la tenue de la réunion préparatoire avec les services bénéficiaires",
        "descriptionEn": "Organize and validate the preparatory meeting with beneficiary services",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da541ae42b9a7515c16",
        "code": "reunion_prep_formateurs",
        "nomFr": "Réunion préparatoire avec les formateurs",
        "nomEn": "Preparatory Meeting with Trainers",
        "descriptionFr": "Organiser et valider la tenue de la réunion préparatoire avec les formateurs",
        "descriptionEn": "Organize and validate the preparatory meeting with trainers",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da641ae42b9a7515c19",
        "code": "communication_participants",
        "nomFr": "Communication aux participants",
        "nomEn": "Communication to Participants",
        "descriptionFr": "Envoi automatique d'emails de communication aux participants",
        "descriptionEn": "Automatic sending of communication emails to participants",
        "type": "email",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da641ae42b9a7515c1c",
        "code": "communication_formateurs",
        "nomFr": "Communication aux formateurs",
        "nomEn": "Communication to Trainers",
        "descriptionFr": "Envoi automatique d'emails de communication aux formateurs",
        "descriptionEn": "Automatic sending of communication emails to trainers",
        "type": "email",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da641ae42b9a7515c1f",
        "code": "confection_fiches_eval_chaud",
        "nomFr": "Confection des fiches d'évaluation à chaud",
        "nomEn": "Hot Evaluation Forms Creation",
        "descriptionFr": "Créer les fiches d'évaluation à chaud dans l'application",
        "descriptionEn": "Create hot evaluation forms in the application",
        "type": "form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da641ae42b9a7515c22",
        "code": "confection_fiches_presence_formateur",
        "nomFr": "Confection des fiches de présence formateur",
        "nomEn": "Trainer Attendance Sheets Creation",
        "descriptionFr": "Génération automatique des fiches de présence pour les formateurs",
        "descriptionEn": "Automatic generation of attendance sheets for trainers",
        "type": "autoGenerate",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da741ae42b9a7515c25",
        "code": "confection_fiches_presence_participant",
        "nomFr": "Confection des fiches de présence participant",
        "nomEn": "Participant Attendance Sheets Creation",
        "descriptionFr": "Génération automatique des fiches de présence pour les participants",
        "descriptionEn": "Automatic generation of attendance sheets for participants",
        "type": "autoGenerate",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da841ae42b9a7515c28",
        "code": "confection_supports",
        "nomFr": "Confection des supports de formation",
        "nomEn": "Training Materials Creation",
        "descriptionFr": "Préparer et valider les supports pédagogiques de la formation",
        "descriptionEn": "Prepare and validate training pedagogical materials",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906da841ae42b9a7515c2b",
        "code": "confection_kits_formateur",
        "nomFr": "Confection des kits du formateur",
        "nomEn": "Trainer Kits Creation",
        "descriptionFr": "Préparer et valider les kits destinés aux formateurs",
        "descriptionEn": "Prepare and validate kits for trainers",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906daa41ae42b9a7515c2e",
        "code": "verification_salles",
        "nomFr": "Vérification de la disponibilité des salles",
        "nomEn": "Training Rooms Availability Check",
        "descriptionFr": "Vérifier et confirmer la disponibilité des salles de formation",
        "descriptionEn": "Check and confirm training rooms availability",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906daa41ae42b9a7515c31",
        "code": "mise_disposition_frais",
        "nomFr": "Mise à disposition des frais de mission",
        "nomEn": "Mission Expenses Provision",
        "descriptionFr": "Valider la mise à disposition des frais de mission pour la formation",
        "descriptionEn": "Validate the provision of mission expenses for training",
        "type": "checkbox",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906dab41ae42b9a7515c34",
        "code": "deroulement_formation",
        "nomFr": "Déroulement effectif de la formation",
        "nomEn": "Actual Training Conduct",
        "descriptionFr": "Valider le déroulement effectif de chaque journée de formation",
        "descriptionEn": "Validate the actual conduct of each training day",
        "type": "table-form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906dac41ae42b9a7515c37",
        "code": "signature_presence_formateur",
        "nomFr": "Signature des fiches de présence formateur",
        "nomEn": "Trainer Attendance Sheets Signature",
        "descriptionFr": "Valider la signature des fiches de présence formateur par jour de formation",
        "descriptionEn": "Validate trainer attendance sheets signature per training day",
        "type": "table-form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906dad41ae42b9a7515c3a",
        "code": "signature_presence_participant",
        "nomFr": "Signature des fiches de présence participant",
        "nomEn": "Participant Attendance Sheets Signature",
        "descriptionFr": "Valider la signature des fiches de présence participant par jour de formation",
        "descriptionEn": "Validate participant attendance sheets signature per training day",
        "type": "table-form",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906dae41ae42b9a7515c3d",
        "code": "remplissage_eval_chaud",
        "nomFr": "Remplissage des fiches d'évaluation à chaud",
        "nomEn": "Hot Evaluation Forms Completion",
        "descriptionFr": "Valider le remplissage des fiches d'évaluation à chaud (en ligne ou manuel)",
        "descriptionEn": "Validate hot evaluation forms completion (online or manual)",
        "type": "evaluation",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "68906db041ae42b9a7515c40",
        "code": "evaluation_connaissances",
        "nomFr": "Évaluation des connaissances par le formateur",
        "nomEn": "Knowledge Assessment by Trainer",
        "descriptionFr": "Enregistrement des moyennes obtenues par chaque participant (optionnel)",
        "descriptionEn": "Recording of averages obtained by each participant (optional)",
        "type": "form",
        "obligatoire": false,
        "actif": true
      },
      {
        "_id": "68906db041ae42b9a7515c43",
        "code": "evaluation_froid",
        "nomFr": "Réalisation de l'évaluation à froid",
        "nomEn": "Cold Evaluation Implementation",
        "descriptionFr": "Valider la réalisation de l'évaluation à froid (en ligne ou manuel)",
        "descriptionEn": "Validate cold evaluation implementation (online or manual)",
        "type": "evaluation",
        "obligatoire": true,
        "actif": true
      },
      {
        "_id": "689074553e5f69bbc873a5ae",
        "code": "rapport_formation",
        "nomFr": "Élaboration du rapport de la formation",
        "nomEn": "Preparation of the training report",
        "descriptionFr": "Rédiger et finaliser le rapport détaillé de la formation, incluant les objectifs, déroulement, évaluations et recommandations.",
        "descriptionEn": "Drafting and finalizing the detailed training report, including objectives, proceedings, evaluations, and recommendations.",
        "type": "upload",
        "obligatoire": true,
        "actif": true
      }
    ];

    console.log(`Début de l'enregistrement de ${tachesGeneriques.length} tâches pour le thème ${themeId}`);
    
    const tachesCreees = [];
    const erreurs = [];

    // Parcourir chaque tâche générique et créer une TacheThemeFormation
    for (let i = 0; i < tachesGeneriques.length; i++) {
      const tacheGenerique = tachesGeneriques[i];
      
      try {
        // Créer une nouvelle tâche de thème de formation
        const nouvelleTache = new TacheThemeFormation({
          theme: new mongoose.Types.ObjectId(themeId),
          tache: new mongoose.Types.ObjectId(tacheGenerique._id),
          responsable: new mongoose.Types.ObjectId(responsableId),
          statut: 'EN_ATTENTE',
          estExecutee: false,
          donnees: {}, // Objet vide pour les données personnalisées
          commentaires: ""
        });

        // Sauvegarder la tâche
        const tacheSauvegardee = await nouvelleTache.save();
        tachesCreees.push({
          id: tacheSauvegardee._id,
          code: tacheGenerique.code,
          nom: tacheGenerique.nomFr,
          type: tacheGenerique.type,
          obligatoire: tacheGenerique.obligatoire
        });

        console.log(`✓ Tâche créée: ${tacheGenerique.nomFr} (${tacheGenerique.code})`);
        
      } catch (error) {
        // Gérer les erreurs (notamment les doublons)
        if (error.code === 11000) {
          console.log(`⚠ Tâche déjà existante: ${tacheGenerique.nomFr} (${tacheGenerique.code})`);
          erreurs.push({
            tache: tacheGenerique.code,
            erreur: 'Tâche déjà existante pour ce thème'
          });
        } else {
          console.error(`✗ Erreur lors de la création de ${tacheGenerique.nomFr}:`, error.message);
          erreurs.push({
            tache: tacheGenerique.code,
            erreur: error.message
          });
        }
      }
    }

    // Résumé des opérations
    console.log('\n=== RÉSUMÉ DES OPÉRATIONS ===');
    console.log(`Tâches créées avec succès: ${tachesCreees.length}`);
    console.log(`Erreurs/Doublons: ${erreurs.length}`);
    console.log(`Total traité: ${tachesGeneriques.length}`);

    if (tachesCreees.length > 0) {
      console.log('\n=== TÂCHES CRÉÉES ===');
      tachesCreees.forEach((tache, index) => {
        console.log(`${index + 1}. ${tache.nom} (${tache.code}) - Type: ${tache.type} - Obligatoire: ${tache.obligatoire ? 'Oui' : 'Non'}`);
      });
    }

    if (erreurs.length > 0) {
      console.log('\n=== ERREURS/DOUBLONS ===');
      erreurs.forEach((erreur, index) => {
        console.log(`${index + 1}. ${erreur.tache}: ${erreur.erreur}`);
      });
    }

    return  res.status(500).json({
      success: true,
      tachesCreees: tachesCreees.length,
      erreurs: erreurs.length,
      details: {
        tachesCreees,
        erreurs
      }
    });


  } catch (error) {
    console.error('Erreur générale lors de l\'enregistrement des tâches:', error);
    return {
      success: false,
      error: error.message
    };
  }
}