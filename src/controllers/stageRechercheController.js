import StageRecherche from '../models/StageRecherche.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Chercheur from '../models/Chercheur.js';
import { sendStageRechercheNotificationEmail } from '../utils/sendMailNotificationChercheur.js';
import mongoose from 'mongoose';

const isValidDateRange = (start, end) => new Date(start) <= new Date(end);

const isOverlapping = (start1, end1, start2, end2) => {
  return new Date(start1) <= new Date(end2) && new Date(start2) <= new Date(end1);
};

const checkOverlaps = (items, idKey) => {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (
        items[i][idKey] &&
        items[i][idKey].toString() === items[j][idKey].toString() &&
        isOverlapping(items[i].dateDebut, items[i].dateFin, items[j].dateDebut, items[j].dateFin)
      ) {
        return true;
      }
    }
  }
  return false;
};

export const createStageRecherche = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const {
        nomFr,
        nomEn,
        chercheur,
        superviseur,
        structure,
        dateDebut,
        dateFin,
        anneeStage,
        statut
    } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }
    
    if (!isValidDateRange(dateDebut, dateFin)) {
        return res.status(400).json({
            success: false,
            message: t('date_debut_anterieur_date_fin', lang),
        });
    }

    

    // Création du stageRecherche
    const stageRecherche = new StageRecherche({ nomFr, nomEn, chercheur,superviseur, structure, dateDebut, dateFin, anneeStage, statut });
    await stageRecherche.save({ session });  

    await session.commitTransaction();
    session.endSession();

    // Envoi mail notification
   
    const chercheurDoc = await Chercheur.findById(chercheur);
    if (chercheurDoc && chercheurDoc.email) {
        sendStageRechercheNotificationEmail(
            chercheurDoc.email,
            lang,
            chercheurDoc.nom,
            chercheurDoc.prenom
        );
    }
    

    return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: stageRecherche,
    });

  } catch (err) {
    console.log(err)
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const getStageRechercheById = async (req, res) => {
  try {
    const { id} = req.params;

    // Validation des paramètres
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID du stageRecherche et le type sont requis en tant que query parameters'
      });
    }

    

    // Utilisation de la même logique que la fonction principale avec select limité
    let query = StageRecherche.findById(id)
        .populate({
            path: 'chercheur',
            select: 'nom prenom'
        })
        .populate({
            path: 'superviseur',
            select: 'nom prenom'
        })
        .populate({
            path: 'structure',
            select: 'nomFr nomEn'
        });

    const stageRecherche = await query.exec();

    if (!stageRecherche) {
      return res.status(404).json({
        success: false,
        message: `Aucun stageRecherche de type ${type} trouvé avec l'ID ${id}`
      });
    }

    

    res.status(200).json({
      success: true,
      data: stageRecherche,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du stageRecherche:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Format d\'ID invalide'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la récupération du stageRecherche'
    });
  }
};


export const updateStageRecherche = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const stageId = req.params.stageId;
    const {
        nomFr,
        nomEn,
        chercheur,
        superviseur,
        structure,
        dateDebut,
        dateFin,
        anneeStage,
        statut
    } = req.body;

    // Vérifier que le stageRecherche existe
    const existingStageRecherche = await StageRecherche.findById(stageId);
    if (!existingStageRecherche) {
        return res.status(404).json({
            success: false,
            message: t('stage_introuvable', lang),
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }
    
    if (!isValidDateRange(dateDebut, dateFin)) {
        return res.status(400).json({
            success: false,
            message: t('date_debut_anterieur_date_fin', lang),
        });
    }
        

    // MISE À JOUR DU stageRecherche
    const updatedStageRecherche = await StageRecherche.findByIdAndUpdate(
      stageId,
      { 
        nomFr, 
        nomEn, 
        chercheur,
        superviseur,
        structure,
        dateDebut, 
        dateFin, 
        anneeStage, 
        statut,
      },
      { new: true, session }
    );

    
    await session.commitTransaction();
    session.endSession();


    return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: updatedStageRecherche,
    });

  } catch (err) {
    console.log(err)
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const deleteStageRecherche = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    try {
        const stageRecherche = await StageRecherche.findByIdAndDelete(id);
        if (!stageRecherche) {
            return res.status(404).json({ 
                success: false, 
                message: t('stage_non_trouve', lang) 
            });
        }
       

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Liste des stages
export const listeStageRecherches = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        statut = '' 
    } = req.query;

    try {
        // Construction du filtre de recherche
        const matchFilters = {};

        // Filtre par recherche (nomFr ou nomEn)
        if (search && search.trim() !== '') {
            matchFilters.$or = [
                { nomFr: { $regex: search, $options: 'i' } },
                { nomEn: { $regex: search, $options: 'i' } }
            ];
        }

        // Filtre par statut
        if (statut && statut !== 'ALL') {
            matchFilters.statut = statut;
        }

        const pipeline = [
            // Filtre initial
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),
            
            {
                $lookup: {
                    from: 'chercheurs', // Collection des chercheurs
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo',
                },
            },
            {
                $lookup: {
                    from: 'rotations', // Collection des rotations
                    localField: '_id',
                    foreignField: 'stageRecherche',
                    as: 'rotations',
                },
            },
            {
                $addFields: {
                    nom: {
                        $cond: [
                            { $eq: [lang, 'en'] },
                            '$nomEn',
                            '$nomFr'
                        ]
                    },
                    // Nombre de chercheurs (toujours 1 pour les stages individuels)
                    nombreChercheurs: {
                        $cond: [{ $ne: ['$chercheur', null] }, 1, 0]
                    },
                    // Dates basées sur les rotations
                    dateDebutCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $min: '$rotations.dateDebut' },
                            '$dateDebut'
                        ]
                    },
                    dateFinCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $max: '$rotations.dateFin' },
                            '$dateFin'
                        ]
                    },
                },
            },
            {
                $sort: { createdAt: -1 }, // Tri par date de création
            },
            {
                $skip: (parseInt(page) - 1) * parseInt(limit),
            },
            {
                $limit: parseInt(limit),
            },
            {
                $project: {
                    _id: 1,
                    nom: 1,
                    nomFr: 1,
                    nomEn: 1,
                    nombreChercheurs: 1,
                    dateDebut: '$dateDebutCalculee',
                    dateFin: '$dateFinCalculee',
                    dateDebutOriginale: '$dateDebut',
                    dateFinOriginale: '$dateFin',
                    anneeStage: 1,
                    statut: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ];

        // Exécution de l'agrégation
        const stages = await StageRecherche.aggregate(pipeline);

        // Compter le total avec les mêmes filtres
        const totalPipeline = [
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),
            { $count: "total" }
        ];
        
        const totalResult = await StageRecherche.aggregate(totalPipeline);
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return res.status(200).json({
            success: true,
            data: {
                stageRecherches:stages,
                totalItems: total,
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
                hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
                hasPrevPage: parseInt(page) > 1,
                // Informations de filtrage
                filters: {
                    search: search || '',
                    statut: statut || 'ALL'
                }
            },
        });
    } catch (error) {
        console.error('Erreur dans listeStageRecherches:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

//Liste des stages par établissement
export const listeStageRecherchesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { etablissementId } = req.params;

    try {
        const pipeline = [
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $match: {
                    'chercheurInfo.etablissement': new mongoose.Types.ObjectId(etablissementId)
                }
            },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $project: {
                    _id: 1,
                    nomFr: 1,
                    nomEn: 1,
                    dateDebut: 1,
                    dateFin: 1,
                    anneeStage: 1,
                    statut: 1,
                    chercheur: {
                        _id: '$chercheurInfo._id',
                        nom: '$chercheurInfo.nom',
                        prenom: '$chercheurInfo.prenom',
                        etablissement: '$etablissement'
                    },
                    createdAt: 1,
                    updatedAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ];

        const stages = await StageRecherche.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            message: t('liste_stages_succes', lang),
            data: {
                stages
            },
        });
    } catch (error) {
        console.error('Erreur dans listeStageRecherchesParEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


// Helper pour construire les filtres
const buildFilters = (query) => {
    const filters = {};
    
    if (query.dateDebut) filters.dateDebut = { $gte: new Date(query.dateDebut) };
    if (query.dateFin) filters.dateFin = { $lte: new Date(query.dateFin) };
    if (query.statut) filters.statut = query.statut;
    if (query.anneeStage) filters.anneeStage = parseInt(query.anneeStage);
    
    return filters;
};

/**
 * Nombre de stages enregistrés par établissement
 * GET /api/statistiques/stages-par-etablissement
 */
export const nombreStageRecherchesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);
        
        const stagesIndividuels = await StageRecherche.aggregate([
            { $match: filters },
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: '$etablissement._id',
                    etablissement: { $first: '$etablissement' },
                    nombreStageRecherches: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: stagesIndividuels
        });

    } catch (error) {
        console.error('Erreur nombreStageRecherchesParEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

/**
 * Nombre de stages par statut et établissement
 * GET /api/statistiques/stages-statut-etablissement
 */
export const nombreStageRecherchesParStatutEtEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);

        const pipeline = [
            { $match: filters },
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: {
                        etablissement: '$etablissement._id',
                        statut: '$statut'
                    },
                    etablissementInfo: { $first: '$etablissement' },
                    count: { $sum: 1 }
                }
            }
        ];

        const result = await StageRecherche.aggregate(pipeline);

        // Regrouper par établissement
        const etablissementMap = new Map();
        
        result.forEach(item => {
            const etablissementId = item._id.etablissement.toString();
            if (!etablissementMap.has(etablissementId)) {
                etablissementMap.set(etablissementId, {
                    etablissement: {
                        nomFr: item.etablissementInfo.nomFr,
                        nomEn: item.etablissementInfo.nomEn
                    },
                    acceptes: 0,
                    refuses: 0,
                    enAttente: 0
                });
            }
            
            const etablissement = etablissementMap.get(etablissementId);
            if (item._id.statut === 'ACCEPTE') etablissement.acceptes += item.count;
            else if (item._id.statut === 'REFUSE') etablissement.refuses += item.count;
            else if (item._id.statut === 'EN_ATTENTE') etablissement.enAttente += item.count;
        });

        return res.status(200).json({
            success: true,
            data: Array.from(etablissementMap.values())
        });

    } catch (error) {
        console.error('Erreur nombreStageRecherchesParStatutEtEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

export const totalChercheursSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
       return res.status(400).json({
        success: false,
        message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
        });
    }

     try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        // Chercheurs individuels à partir des Rotations
        const chercheursIndividuelsResult = await Rotation.aggregate([
            {
                $match: {
                    chercheur: { $exists: true, $ne: null },
                    dateDebut: { $lte: dateFinFilter },
                    dateFin: { $gte: dateDebutFilter }
                }
            },
            {
                $group: {
                    _id: '$chercheur'
                }
            }
        ]);

        const totalChercheurs = chercheursIndividuelsResult.length;

        return res.status(200).json({
            success: true,
            totalChercheurs: totalChercheurs
        });

    } catch (error) {
        console.error("Erreur dans totalChercheursSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const totalChercheursTerminesSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);
        const now = new Date();

        // Chercheurs individuels à partir des Rotations
        const chercheursIndividuelsResult = await Rotation.aggregate([
            {
                $match: {
                    chercheur: { $exists: true, $ne: null },
                    dateFin: { $gte: dateDebutFilter, $lte: dateFinFilter, $lt: now }
                }
            },
            {
                $group: {
                    _id: '$chercheur'
                }
            }
        ]);

        const totalChercheursTermines = chercheursIndividuelsResult.length;

        return res.status(200).json({
            success: true,
            totalChercheursTermines: totalChercheursTermines
        });

    } catch (error) {
        console.error("Erreur dans totalChercheursTerminesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const moyenneChercheursParSuperviseurSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const pipeline = [
            {
                $match: {
                    chercheur: { $exists: true, $ne: null },
                    dateDebut: { $lte: dateFinFilter },
                    dateFin: { $gte: dateDebutFilter }
                }
            },
            {
                $group: {
                    _id: '$superviseur',
                    chercheurs: { $addToSet: '$chercheur' }
                }
            },
            {
                $project: {
                    _id: 0,
                    superviseurId: '$_id',
                    nombreChercheurs: { $size: '$chercheurs' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalChercheurs: { $sum: '$nombreChercheurs' },
                    totalSuperviseurs: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    moyenneChercheursParSuperviseur: { $divide: ['$totalChercheurs', '$totalSuperviseurs'] }
                }
            }
        ];

        const result = await Rotation.aggregate(pipeline);
        const moyenne = result[0]?.moyenneChercheursParSuperviseur || 0;

        return res.status(200).json({
            success: true,
            data: moyenne
        });
    } catch (error) {
        console.error("Erreur dans moyenneChercheursParSuperviseurSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const dureeMoyenneStageRecherchesSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        // Pipeline pour les rotations individuelles uniquement
        const dureesRotations = await Rotation.aggregate([
            { $match: matchStageRecherche },
            {
                $project: {
                    dureeEnJours: {
                        $divide: [{ $subtract: ['$dateFin', '$dateDebut'] }, 1000 * 60 * 60 * 24]
                    }
                }
            }
        ]);

        const totalJours = dureesRotations.reduce((sum, item) => sum + item.dureeEnJours, 0);
        const totalStageRecherches = dureesRotations.length;

        const moyenneEnMois = totalStageRecherches > 0 ? (totalJours / totalStageRecherches) / 30 : 0;

        return res.status(200).json({
            success: true,
            dureeMoyenneMois: moyenneEnMois.toFixed(2)
        });

    } catch (error) {
        console.error("Erreur dans dureeMoyenneStageRecherchesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const tauxStatutStageRecherchesSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const result = await StageRecherche.aggregate([
            { $match: matchStageRecherche },
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalStageRecherches = result.reduce((acc, cur) => acc + cur.count, 0);
        const map = result.reduce((acc, cur) => {
            acc[cur._id] = cur.count;
            return acc;
        }, {});

        const tauxAccepte = totalStageRecherches > 0 ? (map.ACCEPTE || 0) / totalStageRecherches : 0;
        const tauxRefuse = totalStageRecherches > 0 ? (map.REFUSE || 0) / totalStageRecherches : 0;
        const tauxEnAttente = totalStageRecherches > 0 ? (map.EN_ATTENTE || 0) / totalStageRecherches : 0;

        return res.status(200).json({
            success: true,
            tauxStatutStageRecherches: {
                tauxAccepte: tauxAccepte,
                tauxRefuse: tauxRefuse,
                tauxEnAttente: tauxEnAttente,
            }
        });
    } catch (error) {
        console.error("Erreur dans tauxStatutStageRecherchesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionChercheursParServiceSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            chercheur: { $exists: true, $ne: null },
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const repartition = await Rotation.aggregate([
            { $match: matchStageRecherche },
            {
                $group: {
                    _id: '$service',
                    chercheurs: { $addToSet: '$chercheur' }
                }
            },
            {
                $project: {
                    _id: 0,
                    service: '$_id',
                    nombreChercheurs: { $size: '$chercheurs' }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionChercheursParServiceSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionChercheursParSuperviseurSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            chercheur: { $exists: true, $ne: null },
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const repartition = await Rotation.aggregate([
            { $match: matchStageRecherche },
            {
                $group: {
                    _id: '$superviseur',
                    chercheurs: { $addToSet: '$chercheur' }
                }
            },
            {
                $lookup: {
                    from: 'superviseurs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'superviseurInfo'
                }
            },
            { $unwind: '$superviseurInfo' },
            {
                $project: {
                    _id: 0,
                    superviseur: {
                        _id: '$superviseurInfo._id',
                        nom: '$superviseurInfo.nom',
                        prenom: '$superviseurInfo.prenom'
                    },
                    nombreChercheurs: { $size: '$chercheurs' }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionChercheursParSuperviseurSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionChercheursParEtablissementSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            chercheur: { $exists: true, $ne: null },
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const repartition = await Rotation.aggregate([
            { $match: matchStageRecherche },
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $group: {
                    _id: '$chercheurInfo.etablissement',
                    chercheurs: { $addToSet: '$chercheur' }
                }
            },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'etablissementInfo'
                }
            },
            { $unwind: '$etablissementInfo' },
            {
                $project: {
                    _id: 0,
                    etablissement: {
                        _id: '$etablissementInfo._id',
                        nom: '$etablissementInfo.nom'
                    },
                    nombreChercheurs: { $size: '$chercheurs' }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionChercheursParEtablissementSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const nombreStageRecherchesEnCoursSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    try {
        const dateDebutFilter = dateDebut ? new Date(dateDebut) : undefined;
        const dateFinFilter = dateFin ? new Date(dateFin) : undefined;
        const now = new Date();

        const matchStageRecherche = {
            dateDebut: { $lte: now },
            dateFin: { $gte: now }
        };

        // Ajouter les filtres de période si fournis
        if (dateDebutFilter) {
            matchStageRecherche.dateDebut.$lte = dateFinFilter || now;
        }
        if (dateFinFilter) {
            matchStageRecherche.dateFin.$gte = dateDebutFilter || now;
        }

        const result = await Rotation.aggregate([
            { $match: matchStageRecherche },
            { $count: 'total' }
        ]);

        const totalStageRecherchesEnCours = result[0]?.total || 0;

        return res.status(200).json({
            success: true,
            totalStageRecherchesEnCours: totalStageRecherchesEnCours
        });
    } catch (error) {
        console.error("Erreur dans nombreStageRecherchesEnCoursSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};
