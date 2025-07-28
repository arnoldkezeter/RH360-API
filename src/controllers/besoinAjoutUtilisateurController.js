//controllers/besoinAjoutUtilisateurController.js
import BesoinAjouteUtilisateur from "../models/BesoinAjoutUtilisateur.js";
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';

export const createBesoinAjoute = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';    
    try {
        const { utilisateur, titreFr, titreEn, descriptionFr, descriptionEn, pointsAAmeliorerFr, pointsAAmeliorerEn } = req.body;
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        

        const besoin = new BesoinAjouteUtilisateur({
            utilisateur,
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            pointsAAmeliorerFr,
            pointsAAmeliorerEn
        });

        await besoin.save();
        return res.status(201).json({
            success:true,
            message:t('ajouter_succes', lang),
            data:besoin
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Modifier un besoin ajouté par un utilisateur
export const updateBesoinAjoute = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const { id } = req.params;
        const {
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            pointsAAmeliorerFr,
            pointsAAmeliorerEn
        } = req.body;

        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }

        const besoin = await BesoinAjouteUtilisateur.findByIdAndUpdate(
        id,
        {
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            pointsAAmeliorerFr,
            pointsAAmeliorerEn,
            updatedAt: new Date()
        },
        { new: true }
        );

        if (!besoin) return res.status(404).json({success:false, message: t('besoin_non_trouve', lang) });

        return res.status(200).json({
            success:true,
            message:t('modifier_succes', lang),
            data:besoin
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Supprimer un besoin ajouté par un utilisateur
export const deleteBesoinAjoute = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const { id } = req.params;

        const besoin = await BesoinAjouteUtilisateur.findByIdAndDelete(id);

        if (!besoin) return res.status(404).json({ message: 'Besoin ajouté introuvable.' });

        return res.status(200).json({success:true, message: t('supprimer_succes', lang) });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getBesoinsByUser = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const { utilisateurId } = req.params;
        const { page = 1, limit = 10, search = '' } = req.query;

        const regex = new RegExp(search, 'i');

        const query = {
            utilisateur: utilisateurId,
            $or: [
                { titreFr: { $regex: regex } },
                { titreEn: { $regex: regex } },
            ]
        };

        const total = await BesoinAjouteUtilisateur.countDocuments(query);
        const besoins = await BesoinAjouteUtilisateur
            .find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                besoinAjouteUtilisateurs:besoins,
                totalItems:total,
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getAllBesoinsAjoutes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const besoins = await BesoinAjouteUtilisateur.find().populate('utilisateur');
        return res.status(200).json({
            success:true,
            data:besoins
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// 5. Statuts des besoins ajoutés
export const getStatutBesoinsAjoutes = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const total = await BesoinAjouteUtilisateur.countDocuments();
    const valides = await BesoinAjouteUtilisateur.countDocuments({ statut: 'VALIDE' });
    const rejetees = await BesoinAjouteUtilisateur.countDocuments({ statut: 'REJETE' });
    const enAttente = await BesoinAjouteUtilisateur.countDocuments({ statut: 'EN_ATTENTE' });

    return res.status(200).json({
      success:true,
      total,
      valides,
      rejetees,
      enAttente
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const validateBesoinAjoute = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const { id } = req.params;
        const { statut, commentaireAdminFr, commentaireAdminEn } = req.body;

        if (!['VALIDE', 'REJETE'].includes(statut)) {
            return res.status(400).json({success:false, message: t('statut_invalide', lang) });
        }

        const updated = await BesoinAjouteUtilisateur.findByIdAndUpdate(
        id,
        { statut, commentaireAdminFr, commentaireAdminEn },
        { new: true }
        );

        if (!updated) return res.status(404).json({success:false, message: t('besoin_non_trouve', lang) });

        return res.status(200).json({
            success:true,
            data:updated
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getRepartitionBesoinsParPoste = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const repartition = await BesoinAjouteUtilisateur.aggregate([
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'utilisateur',
          foreignField: '_id',
          as: 'utilisateur'
        }
      },
      { $unwind: '$utilisateur' },
      // Filtrer les utilisateurs qui ont un poste de travail défini
      {
        $match: {
          'utilisateur.posteDeTravail': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$utilisateur.posteDeTravail',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'postedetravails', // Nom correct de la collection (sans 's' à la fin)
          localField: '_id',
          foreignField: '_id',
          as: 'posteDeTravail'
        }
      },
      { $unwind: '$posteDeTravail' },
      {
        $project: {
          _id: 0,
          posteId: '$posteDeTravail._id',
          nomFr: '$posteDeTravail.nomFr',
          nomEn: '$posteDeTravail.nomEn',
          // Utiliser la langue appropriée pour le nom du poste
          nom: lang === 'en' ? '$posteDeTravail.nomEn' : '$posteDeTravail.nomFr',
          nombreBesoins: '$count'
        }
      },
      { $sort: { nombreBesoins: -1 } }
    ]);

   

    return res.status(200).json({
      success: true,
      data: repartition,
    });

  } catch (err) {
    console.error('Erreur lors de la récupération de la répartition des besoins par poste:', err);
    
    return res.status(500).json({
      success: false,
      message:t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


export const getGroupedBesoinsAjoutes = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search ? req.query.search.trim() : '';

  try {
    // Pipeline de base avec lookup des utilisateurs
    const basePipeline = [
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'utilisateur',
          foreignField: '_id',
          as: 'utilisateur'
        }
      },
      { $unwind: '$utilisateur' }
    ];

    // Ajouter le filtre de recherche si défini
    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            // Recherche dans le titre français du besoin
            { 'titreFr': { $regex: search, $options: 'i' } },
            // Recherche dans le titre anglais du besoin
            { 'titreEn': { $regex: search, $options: 'i' } },
            // Recherche dans les points à améliorer (français)
            { 'pointsAAmeliorerFr': { $regex: search, $options: 'i' } },
            // Recherche dans les points à améliorer (anglais)
            { 'pointsAAmeliorerEn': { $regex: search, $options: 'i' } },
            // Recherche dans les commentaires admin (français)
            { 'commentaireAdminFr': { $regex: search, $options: 'i' } },
            // Recherche dans les commentaires admin (anglais)
            { 'commentaireAdminEn': { $regex: search, $options: 'i' } },
            // Recherche dans le nom de l'utilisateur
            { 'utilisateur.nom': { $regex: search, $options: 'i' } },
            // Recherche dans le prénom de l'utilisateur
            { 'utilisateur.prenom': { $regex: search, $options: 'i' } },
            // Recherche dans l'email de l'utilisateur
            { 'utilisateur.email': { $regex: search, $options: 'i' } },
            // Recherche dans le nom complet (prénom + nom)
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$utilisateur.prenom', ' ', '$utilisateur.nom'] },
                  regex: search,
                  options: 'i'
                }
              }
            },
            // Recherche dans le statut
            { 'statut': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Pipeline principal pour obtenir les données groupées
    const mainPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: {
            utilisateurId: '$utilisateur._id',
            nom: '$utilisateur.nom',
            prenom: '$utilisateur.prenom',
            email: '$utilisateur.email'
          },
          besoins: {
            $push: {
              besoinId: '$_id',
              titreFr: '$titreFr',
              titreEn: '$titreEn',
              titre: {
                $cond: {
                  if: { $eq: [lang, 'fr'] },
                  then: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$titreFr', null] }, { $eq: ['$titreFr', ''] }] },
                      then: '$titreEn',
                      else: '$titreFr'
                    }
                  },
                  else: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$titreEn', null] }, { $eq: ['$titreEn', ''] }] },
                      then: '$titreFr',
                      else: '$titreEn'
                    }
                  }
                }
              },
              pointsAAmeliorerFr: '$pointsAAmeliorerFr',
              pointsAAmeliorerEn: '$pointsAAmeliorerEn',
              pointsAAmeliorer: {
                $cond: {
                  if: { $eq: [lang, 'fr'] },
                  then: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$pointsAAmeliorerFr', null] }, { $eq: ['$pointsAAmeliorerFr', ''] }] },
                      then: '$pointsAAmeliorerEn',
                      else: '$pointsAAmeliorerFr'
                    }
                  },
                  else: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$pointsAAmeliorerEn', null] }, { $eq: ['$pointsAAmeliorerEn', ''] }] },
                      then: '$pointsAAmeliorerFr',
                      else: '$pointsAAmeliorerEn'
                    }
                  }
                }
              },
              commentaireAdminFr: '$commentaireAdminFr',
              commentaireAdminEn: '$commentaireAdminEn',
              commentaireAdmin: {
                $cond: {
                  if: { $eq: [lang, 'fr'] },
                  then: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$commentaireAdminFr', null] }, { $eq: ['$commentaireAdminFr', ''] }] },
                      then: '$commentaireAdminEn',
                      else: '$commentaireAdminFr'
                    }
                  },
                  else: { 
                    $cond: {
                      if: { $or: [{ $eq: ['$commentaireAdminEn', null] }, { $eq: ['$commentaireAdminEn', ''] }] },
                      then: '$commentaireAdminFr',
                      else: '$commentaireAdminEn'
                    }
                  }
                }
              },
              statut: '$statut',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];

    // Pipeline pour compter le total
    const countPipeline = [
      ...mainPipeline,
      {
        $count: "total"
      }
    ];

    // Pipeline pour les données paginées
    const dataPipeline = [
      ...mainPipeline,
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          utilisateurId: '$_id.utilisateurId',
          nom: '$_id.nom',
          prenom: '$_id.prenom',
          email: '$_id.email',
          nomComplet: { $concat: ['$_id.prenom', ' ', '$_id.nom'] },
          count: 1,
          besoins: 1
        }
      }
    ];

    // Exécuter les deux pipelines en parallèle
    const [countResult, dataResult] = await Promise.all([
      BesoinAjouteUtilisateur.aggregate(countPipeline),
      BesoinAjouteUtilisateur.aggregate(dataPipeline)
    ]);

    // Calculer les informations de pagination
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalItems / limit);


    return res.status(200).json({
      success: true,
      data: {
        groupedCompetences: dataResult,
        currentPage: page,
        pageSize: limit,
        totalItems,
        totalPages,
      }
    });

  } catch (err) {
    console.error('Erreur dans getGroupedBesoinsAjoutes:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
    });
  }
};







