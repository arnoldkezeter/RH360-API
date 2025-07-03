import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import ThemeFormation from '../models/ThemeFormation.js';
import { calculerAge } from '../utils/calculerAge.js';
import Formation from '../models/Formation.js';
import BudgetFormation from '../models/BudgetFormation.js';
import { calculerCoutsBudget } from '../services/budgetFormationService.js';
import { enrichirFormations } from '../services/formationService.js';
import ProgrammeFormation from '../models/ProgrammeFormation.js';
import Depense from '../models/Depense.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import Service from '../models/Service.js';
import CategorieProfessionnelle from '../models/CategorieProfessionnelle.js';
import AxeStrategique from '../models/AxeStrategique.js';
import { LieuFormation } from '../models/LieuFormation.js';
import { Formateur } from '../models/Formateur.js';


// Ajouter
export const createFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { titreFr, titreEn, descriptionFr, descriptionEn, axeStrategique, programmeFormation } = req.body;
        if (!mongoose.Types.ObjectId.isValid(axeStrategique._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(programmeFormation._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const existsFr = await Formation.exists({ titreFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_fr', lang),
            });
        }

        const existsEn = await Formation.exists({ titreEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_en', lang),
            });
        }

        const formation = await Formation.create({
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            familleMetier: [],
            axeStrategique: axeStrategique._id,
            programmeFormation: programmeFormation._id,
        });

        // Peupler les champs axeStrategique et programmeFormation
        const populatedFormation = await Formation.findById(formation._id)
        .populate({
            path: 'axeStrategique',
            select: 'nomFr nomEn', // Sélectionner uniquement nomFr et nomEn
        })
        .populate({
            path: 'programmeFormation',
            select: 'annee', // Sélectionner uniquement annee
        });


        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: populatedFormation,
        });

    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Modifier
export const updateFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { titreFr, titreEn, descriptionFr, descriptionEn, axeStrategique, programmeFormation } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
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

    try {
        if (!mongoose.Types.ObjectId.isValid(axeStrategique._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(programmeFormation._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        const formation = await Formation.findById(id);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        const existsFr = await Formation.findOne({ titreFr, _id: { $ne: id } });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_fr', lang),
            });
        }

        const existsEn = await Formation.findOne({ titreEn, _id: { $ne: id } });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_en', lang),
            });
        }

        if (titreFr) formation.titreFr = titreFr;
        if (titreEn) formation.titreEn = titreEn;
        if (descriptionFr !== undefined) formation.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) formation.descriptionEn = descriptionEn;
        if (axeStrategique !== undefined) formation.axeStrategique = axeStrategique._id;
        if (programmeFormation !== undefined) formation.programmeFormation = programmeFormation._id;

        await formation.save();
        // Peupler les champs axeStrategique et programmeFormation
        const populatedFormation = await Formation.findById(formation._id)
        .populate({
            path: 'axeStrategique',
            select: 'nomFr nomEn', // Sélectionner uniquement nomFr et nomEn
        })
        .populate({
            path: 'programmeFormation',
            select: 'annee', // Sélectionner uniquement annee
        });


        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: populatedFormation,
        });

    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer
export const deleteFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(id);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        await Formation.deleteOne({ _id: id });

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Ajouter une famille metier
export const ajouterFamilleMetierAFormation = async (req, res) => {
    const { idFormation, idFamilleMetier } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(idFormation) || !mongoose.Types.ObjectId.isValid(idFamilleMetier)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(idFormation);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        if (!formation.familleMetier.includes(idFamilleMetier)) {
            formation.familleMetier.push(idFamilleMetier);
            await formation.save();
        }

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: formation,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Supprimer une famille metier
export const supprimerFamilleMetierDeFormation = async (req, res) => {
    const { idFormation, idFamilleMetier } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(idFormation) || !mongoose.Types.ObjectId.isValid(idFamilleMetier)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(idFormation);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        formation.familleMetier = formation.familleMetier.filter(fm => fm.toString() !== idFamilleMetier);
        await formation.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: formation,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Pour les menus déroulants
export const getFormationsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
    const {programmeId} = req.params;

    try {
        const formations = await Formation.find({programmeFormation:programmeId}, '_id titreFr titreEn')
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                formations,
                totalItems: formations.length,
                currentPage: 1,
                totalPages: 1,
                pageSize: formations.length,
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Liste avec pagination
export const getFormations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const total = await Formation.countDocuments();
        const formations = await Formation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Liste des formations avec filtres
export const getFilteredFormations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {
        programme,
        axeStrategique,
        familleMetier,
        titre,
        debut,
        fin,
        page = 1,
        limit = 10,
    } = req.query;

    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
    const filters = {};

    if (programme) {
        if (!mongoose.Types.ObjectId.isValid(programme)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        filters.programmeFormation = programme;
    }

    if (axeStrategique) {
        if (!mongoose.Types.ObjectId.isValid(axeStrategique)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        filters.axeStrategique = axeStrategique;
    }

    if (familleMetier) {
        if (!mongoose.Types.ObjectId.isValid(familleMetier)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        filters.familleMetier = familleMetier;
    }

    if (titre) {
        const field = lang === 'en' ? 'titreEn' : 'titreFr';
        filters[field] = { $regex: new RegExp(titre, 'i') };
    }

    // Filtrage par période
    if (debut && fin) {
        const matchThemes = {
            dateDebut: { $gte: new Date(debut) },
            dateFin: { $lte: new Date(fin) }
        };

        const themes = await ThemeFormation.find(matchThemes)
            .select('formation')
            .lean();

        const formationIds = [...new Set(themes.map(t => t.formation.toString()))];

        if (formationIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    formations: [],
                    totalItems: 0,
                    currentPage: parseInt(page),
                    totalPages: 0,
                    pageSize: parseInt(limit),
                },
                message: t('aucune_formation_periode', lang)
            });
        }

        filters._id = { $in: formationIds };
    }

    try {
        const [total, formations] = await Promise.all([
            Formation.countDocuments(filters),
            Formation.find(filters)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ [sortField]: 1 })
                .populate('familleMetier axeStrategique programmeFormation')
                .lean()
        ]);

        const formationIds = formations.map(f => f._id);

        const allThemes = await ThemeFormation.find({
            formation: { $in: formationIds }
        })
            .populate('publicCible')
            .lean();

        const themeIds = allThemes.map(t => t._id);

        const allBudgets = await BudgetFormation.find({
            theme: { $in: themeIds }
        }).lean();

        const budgetIds = allBudgets.map(b => b._id);

        const allDepenses = await Depense.find({
            budget: { $in: budgetIds }
        })
            .populate({path:'taxes', select:'taux', options:{strictPopulate:false}})
            .lean();

        // Regrouper les dépenses par budget
        const depensesByBudget = allDepenses.reduce((acc, dep) => {
            const budgetId = dep.budget.toString();
            if (!acc[budgetId]) acc[budgetId] = [];
            acc[budgetId].push(dep);
            return acc;
        }, {});

        const themesByFormation = allThemes.reduce((acc, theme) => {
            const formationId = theme.formation.toString();
            if (!acc[formationId]) acc[formationId] = [];
            acc[formationId].push(theme);
            return acc;
        }, {});

        const budgetsByTheme = allBudgets.reduce((acc, budget) => {
            const themeId = budget.theme.toString();
            if (!acc[themeId]) acc[themeId] = [];
            acc[themeId].push(budget);
            return acc;
        }, {});

        const calculateBudgets = (budgetIdList) => {
            return budgetIdList.reduce((totals, budgetId) => {
                const depenses = depensesByBudget[budgetId.toString()] || [];

                const budgetTotals = depenses.reduce((acc, dep) => {
                    const quantite = dep.quantite ?? 1;
                    const taux = dep.taxe?.taux || 0;

                    const prevuHT = dep.montantUnitairePrevu || 0;
                    const reelHT = dep.montantUnitaireReel || 0;

                    const montantPrevuTTC = prevuHT * quantite * (1 + taux / 100);
                    const montantReelTTC = reelHT * quantite * (1 + taux / 100);

                    return {
                        estimatif: acc.estimatif + montantPrevuTTC,
                        reel: acc.reel + montantReelTTC,
                    };
                }, { estimatif: 0, reel: 0 });

                return {
                    estimatif: totals.estimatif + budgetTotals.estimatif,
                    reel: totals.reel + budgetTotals.reel,
                };
            }, { estimatif: 0, reel: 0 });
        };

        const enrichedFormations = formations.map(formation => {
            const formationId = formation._id.toString();
            const themes = themesByFormation[formationId] || [];
            const nbTheme = themes.length;

            let dateDebut = null;
            let dateFin = null;
            if (nbTheme > 0) {
                const dates = themes.map(t => new Date(t.dateDebut).getTime());
                const dateFins = themes.map(t => new Date(t.dateFin).getTime());

                dateDebut = new Date(Math.min(...dates));
                dateFin = new Date(Math.max(...dateFins));
            }

            const totalPublicCible = themes.reduce(
                (total, theme) => total + (theme.publicCible?.length || 0),
                0
            );

            let totalBudgetEstimatif = 0;
            let totalBudgetReel = 0;

            themes.forEach(theme => {
                const themeBudgets = budgetsByTheme[theme._id.toString()] || [];
                const budgetIds = themeBudgets.map(b => b._id);
                const { estimatif, reel } = calculateBudgets(budgetIds);
                totalBudgetEstimatif += estimatif;
                totalBudgetReel += reel;
            });

            return {
                ...formation,
                nbTheme,
                dateDebut,
                dateFin,
                totalPublicCible,
                budgetEstimatif: Math.round(totalBudgetEstimatif * 100) / 100,
                budgetReel: Math.round(totalBudgetReel * 100) / 100,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                formations: enrichedFormations,
                totalItems: total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                pageSize: parseInt(limit),
            },
        });
    } catch (err) {
        console.error('Erreur dans getFilteredFormations:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur interne'
        });
    }
};


//Liste des formations pour le diagramme de Gantt
export const getFormationsForGantt = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {
        axeStrategique,
        familleMetier,
        titre,
        programmeAnnee,
        page = 1,
        limit = 10,
    } = req.query;

    const filters = {};

    // Validation et ajout des filtres
    if (axeStrategique) {
        if (!mongoose.Types.ObjectId.isValid(axeStrategique)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        filters.axeStrategique = axeStrategique;
    }

    if (familleMetier) {
        if (!mongoose.Types.ObjectId.isValid(familleMetier)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        filters.familleMetier = familleMetier;
    }

    if (titre) {
        const field = lang === 'en' ? 'titreEn' : 'titreFr';
        filters[field] = { $regex: new RegExp(titre, 'i') };
    }

    try {
        // Filtrage par année de programme de formation
        if (programmeAnnee) {
            const programmeIds = await ProgrammeFormation.find({ annee: programmeAnnee })
                .select('_id')
                .lean();
            const programmeIdList = programmeIds.map((p) => p._id);
            if (programmeIdList.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: {
                        formations: [],
                        totalItems: 0,
                        currentPage: parseInt(page),
                        totalPages: 0,
                        pageSize: parseInt(limit),
                    },
                });
            }
            filters.programmeFormation = { $in: programmeIdList };
        }

        // Récupérer les formations filtrées avec pagination
        const [total, formations] = await Promise.all([
            Formation.countDocuments(filters),
            Formation.find(filters)
                .sort({ dateDebut: 1 }) // Tri par date de début croissante
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .populate('familleMetier axeStrategique programmeFormation')
                .lean(),
        ]);

        const formationIds = formations.map((f) => f._id);

        // Récupérer les thèmes associés à ces formations
        const allThemes = await ThemeFormation.find({
            formation: { $in: formationIds },
        })
            .sort({ dateDebut: 1 }) // Tri par date de début croissante
            .select('formation titreFr titreEn dateDebut dateFin nbTachesTotal nbTachesExecutees')
            .lean();

        // Groupement des thèmes par formation
        const themesByFormation = allThemes.reduce((acc, theme) => {
            const formationId = theme.formation.toString();
            if (!acc[formationId]) acc[formationId] = [];
            acc[formationId].push(theme);
            return acc;
        }, {});

        // Enrichissement des formations avec les données supplémentaires
        const enrichedFormations = formations.map((formation) => {
            const formationId = formation._id.toString();
            const themes = themesByFormation[formationId] || [];
            const nbTheme = themes.length;

            // Calcul de dateDebut (la plus récente) et dateFin (la plus ancienne)
            let dateDebut = null;
            let dateFin = null;
            if (nbTheme > 0) {
                const datesDebut = themes.map((t) => new Date(t.dateDebut).getTime());
                const datesFin = themes.map((t) => new Date(t.dateFin).getTime());

                dateDebut = new Date(Math.min(...datesDebut));
                dateFin = new Date(Math.max(...datesFin));
            }

            return {
                _id: formation._id,
                titreFr: formation.titreFr,
                titreEn: formation.titreEn,
                descriptionFr: formation.descriptionFr,
                descriptionEn: formation.descriptionEn,
                axeStrategique: formation.axeStrategique
                    ? {
                          nomFr: formation.axeStrategique.nomFr,
                          nomEn: formation.axeStrategique.nomEn,
                      }
                    : null,
                familleMetier: formation.familleMetier
                    ? formation.familleMetier.map((fm) => ({
                          nomFr: fm.nomFr,
                          nomEn: fm.nomEn,
                      }))
                    : [],
                programmeFormation: formation.programmeFormation,
                nbTachesTotal: formation.nbTachesTotal || 0,
                nbTachesExecutees: formation.nbTachesExecutees || 0,
                dateDebut,
                dateFin,
                themes: themes.map((theme) => ({
                    _id: theme._id,
                    titreFr: theme.titreFr,
                    titreEn: theme.titreEn,
                    dateDebut: theme.dateDebut,
                    dateFin: theme.dateFin,
                    nbTachesTotal: theme.nbTachesTotal || 0,
                    nbTachesExecutees: theme.nbTachesExecutees || 0,
                })),
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                formations: enrichedFormations,
                totalItems: total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                pageSize: parseInt(limit),
            },
        });
    } catch (err) {
        console.error("Erreur dans getFilteredFormations:", err);
        return res.status(500).json({
            success: false,
            message: t("erreur_serveur", lang),
            error: process.env.NODE_ENV === "development" ? err.message : "Erreur interne",
        });
    }
};



// Formation par ID
export const getFormationById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(id)
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        const [enriched] = await enrichirFormations([formation]);

        return res.status(200).json({
            success: true,
            data: enriched,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};



//Statistiques par sexe, service, categorie professionnelle, tranche d'âge
export const getAllStatsParticipantsFormation = async (req, res) => {
  const { programmeId, formationId } = req.query;
  const lang = req.headers['accept-language'] || 'fr';

  if (!programmeId && !formationId) {
    return res.status(400).json({ success: false, message: t('parametre_requis', lang) });
  }

  try {
    let themeIds = [];

    // Étape 1 : récupérer les thèmes selon le filtre
    if (formationId) {
      if (!mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }
      const themes = await ThemeFormation.find({ formation: formationId }).select('_id').lean();
      themeIds = themes.map(t => t._id);
    } else if (programmeId) {
      if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }
      const formations = await Formation.find({ programmeFormation: programmeId }).select('_id').lean();
      const formationIds = formations.map(f => f._id);
      const themes = await ThemeFormation.find({ formation: { $in: formationIds } }).select('_id').lean();
      themeIds = themes.map(t => t._id);
    }

    // Étape 2 : récupérer les lieux pour ces thèmes
    const lieux = await LieuFormation.find({ theme: { $in: themeIds } })
      .select('cohortes')
      .lean();

    const cohorteIds = lieux.flatMap(lieu => lieu.cohortes?.map(id => id.toString()) || []);
    

    // Étape 3 : récupérer les utilisateurs de ces cohortes
    const cohortesUtilisateurs = await CohorteUtilisateur.find({ cohorte: { $in: cohorteIds } })
      .populate({
        path: 'utilisateur',
        select: 'genre dateNaissance service categorieProfessionnelle'
      })
      .lean();

    // Étape 4 : Calcul des stats
    const sexeMap = { H: 0, F: 0 };
    const trancheAgeMap = {
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-60': 0,
      '60+': 0
    };
    const serviceMap = new Map();
    const categorieMap = new Map();

    cohortesUtilisateurs.forEach(entry => {
      const user = entry.utilisateur;
    //   console.log(JSON.stringify(user, null, 2));
      if (!user) return;
        
      // Sexe
      if (user.genre === 'M') sexeMap.H++;
        else if (user.genre === 'F') sexeMap.F++;

      // Âge
      if (user.dateNaissance) {
        const age = calculerAge(user.dateNaissance);
        if (age >= 18 && age <= 25) trancheAgeMap['18-25']++;
        else if (age <= 35) trancheAgeMap['26-35']++;
        else if (age <= 45) trancheAgeMap['36-45']++;
        else if (age <= 60) trancheAgeMap['46-60']++;
        else trancheAgeMap['60+']++;
      }

      // Service
      const sid = user.service?.toString();
      if (sid) serviceMap.set(sid, (serviceMap.get(sid) || 0) + 1);

      // Catégorie
      const cid = user.categorieProfessionnelle?.toString();
      if (cid) categorieMap.set(cid, (categorieMap.get(cid) || 0) + 1);
    });

    // Étape 5 : récupérer les objets associés
    const services = await Service.find({ _id: { $in: [...serviceMap.keys()] } }).lean();
    const categories = await CategorieProfessionnelle.find({ _id: { $in: [...categorieMap.keys()] } }).lean();

    // Étape 6 : format final
    const sexe = [
      { genre: 'H', total: sexeMap.H },
      { genre: 'F', total: sexeMap.F }
    ];

    const trancheAge = Object.entries(trancheAgeMap).map(([tranche, total]) => ({ tranche, total }));

    const service = services.map(s => ({
      service: {_id:s._id || "", nomFr:s.nomFr||"", nomEn:s.nomEn||""},
      total: serviceMap.get(s._id.toString()) || 0
    }));

    const categorieProfessionnelle = categories.map(c => ({
      categorieProfessionnelle: {_id:c._id || "", nomFr:c.nomFr||"", nomEn:c.nomEn||""},
      total: categorieMap.get(c._id.toString()) || 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        sexe: sexe,
        trancheAge: trancheAge,
        service: service,
        categorieProfessionnelle: categorieProfessionnelle
      }
    });

  } catch (err) {
    console.error('Erreur getAllStatsParticipantsFormation:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message
    });
  }
};


//Formateur par type
export const getNbFormateursParType = async (req, res) => {
  const { programmeId, formationId } = req.query;
  const lang = req.headers['accept-language'] || 'fr';

  if (!programmeId && !formationId) {
    return res.status(400).json({ success: false, message: t('parametre_requis', lang) });
  }

  try {
    let themeIds = [];

    if (formationId) {
      if (!mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }

      const themes = await ThemeFormation.find({ formation: formationId }).select('_id').lean();
      themeIds = themes.map(t => t._id);
    } else if (programmeId) {
      if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }

      const formations = await Formation.find({ programmeFormation: programmeId }).select('_id').lean();
      const formationIds = formations.map(f => f._id);

      const themes = await ThemeFormation.find({ formation: { $in: formationIds } }).select('_id').lean();
      themeIds = themes.map(t => t._id);
    }

    // Récupérer les formateurs liés aux thèmes
    const formateurs = await Formateur.find({ theme: { $in: themeIds } }).select('interne utilisateur').lean();

    const stats = { interne: 0, externe: 0 };
    const dejaCompte = new Set();

    for (const f of formateurs) {
      const userId = f.utilisateur?.toString();
      if (!userId || dejaCompte.has(userId)) continue;

      dejaCompte.add(userId);
      if (f.interne) stats.interne++;
      else stats.externe++;
    }

    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('Erreur getNbFormateursParType:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};


//Coûts par thème pour une formation
export const getCoutsParThemePourFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        // Thèmes liés à la formation
        const themes = await ThemeFormation.find({ formation: id })
        .select('_id titreFr titreEn')
        .lean();

        if (themes.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_theme_trouve', lang),
            });
        }

        const themeIds = themes.map(t => t._id);

        // Budgets liés aux thèmes
        const budgets = await BudgetFormation.find({ theme: { $in: themeIds } })
        .select('theme sections')
        .lean();

        const coutsParTheme = {};

        for (const budget of budgets) {
            const themeIdStr = budget.theme.toString();
            if (!coutsParTheme[themeIdStr]) {
                coutsParTheme[themeIdStr] = { coutPrevu: 0, coutReel: 0 };
            }

            const coutsBudget = calculerCoutsBudget(budget);

            coutsParTheme[themeIdStr].coutPrevu += coutsBudget.coutPrevu;
            coutsParTheme[themeIdStr].coutReel += coutsBudget.coutReel;
        }

        const result = themes.map(t => {
            const cout = coutsParTheme[t._id.toString()] || { coutPrevu: 0, coutReel: 0 };
            return {
                themeId: t._id,
                titreFr: t.titreFr,
                titreEn: t.titreEn,
                coutPrevu: cout.coutPrevu,
                coutReel: cout.coutReel,
            };
        });

        return res.status(200).json({ success: true, data: result });
    } catch (err) {
            return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getCoutReelTTCParTheme = async (req, res) => {
    const { programmeId, formationId } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    try {
        // Filtrage formations
        let formationFilter = {};
        if (formationId) {
            if (!mongoose.Types.ObjectId.isValid(formationId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            formationFilter._id = formationId;
        } else if (programmeId) {
            if (!mongoose.Types.ObjectId.isValid(programmeId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            formationFilter.programmeFormation = programmeId;
        }

        // Trouver formations
        const formations = await Formation.find(formationFilter).select('_id').lean();
        if (formations.length === 0) {
            return res.status(404).json({ success: false, message: t('formation_introuvable', lang) });
        }
        const formationIds = formations.map(f => f._id);

        // Trouver thèmes
        const themes = await ThemeFormation.find({ formation: { $in: formationIds } })
            .select('_id titreFr titreEn')
            .lean();
        if (themes.length === 0) {
            return res.status(404).json({ success: false, message: t('aucun_theme_trouve', lang) });
        }
        const themeIds = themes.map(t => t._id);

        // Trouver budgets
        const budgets = await BudgetFormation.find({ theme: { $in: themeIds } }).select('_id theme').lean();
        if (budgets.length === 0) {
            return res.status(404).json({ success: false, message: t('aucun_budget_trouve', lang) });
        }
        const budgetIds = budgets.map(b => b._id);

        // Trouver dépenses avec taxes peuplées
        const depenses = await Depense.find({
            budget: { $in: budgetIds },
            montantUnitaireReel: { $ne: null }
        })
        .populate({path:'taxes', options:{strictPopulate:false}})
        .lean();

        // Calculer montant TTC par dépense puis total par thème
        const coutParThemeMap = new Map();

        for (const depense of depenses) {
            const montantHT = depense.montantUnitaireReel * depense.quantite;

            // Somme taux taxes
            const tauxTotalTaxes = depense.taxes?.reduce((sum, taxe) => sum + (taxe.taux || 0), 0) || 0;

            const montantTTC = montantHT * (1 + tauxTotalTaxes / 100);

            const budgetThemeId = budgets.find(b => b._id.toString() === depense.budget.toString())?.theme.toString();

            if (budgetThemeId) {
                coutParThemeMap.set(
                    budgetThemeId,
                    (coutParThemeMap.get(budgetThemeId) || 0) + montantTTC
                );
            }
        }

        // Construire résultat final
        const result = themes.map(theme => ({
            themeId: theme._id,
            titreFr: theme.titreFr,
            titreEn: theme.titreEn,
            coutReelTTC: coutParThemeMap.get(theme._id.toString()) || 0
        }));

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (err) {
        console.error('Erreur dans getCoutReelTTCParTheme:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


export const getCoutReelEtPrevuTTCParTheme = async (req, res) => {
    const { programmeId, formationId } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    try {
        let formationFilter = {};
        if (formationId) {
            if (!mongoose.Types.ObjectId.isValid(formationId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            formationFilter._id = formationId;
        } else if (programmeId) {
            if (!mongoose.Types.ObjectId.isValid(programmeId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            formationFilter.programmeFormation = programmeId;
        }

        const formations = await Formation.find(formationFilter).select('_id').lean();
        if (formations.length === 0) {
            return res.status(404).json({ success: false, message: t('formation_introuvable', lang) });
        }
        const formationIds = formations.map(f => f._id);

        const themes = await ThemeFormation.find({ formation: { $in: formationIds } })
            .select('_id titreFr titreEn')
            .lean();
        if (themes.length === 0) {
            return res.status(404).json({ success: false, message: t('aucun_theme_trouve', lang) });
        }
        const themeIds = themes.map(t => t._id);

        const budgets = await BudgetFormation.find({ theme: { $in: themeIds } })
            .select('_id theme')
            .lean();
        if (budgets.length === 0) {
            return res.status(404).json({ success: false, message: t('aucun_budget_trouve', lang) });
        }
        const budgetIds = budgets.map(b => b._id);

        // Récupérer dépenses avec taxes peuplées
        const depenses = await Depense.find({
            budget: { $in: budgetIds }
        })
        .populate({path:'taxes', options:{strictPopulate:false}})
        .lean();

        // Maps pour cumuler montants par thème
        const coutReelTTCParTheme = new Map();
        const coutPrevuTTCParTheme = new Map();

        for (const depense of depenses) {
            // Somme taux taxes
            const tauxTotalTaxes = depense.taxes?.reduce((sum, taxe) => sum + (taxe.taux || 0), 0) || 0;

            // Montant réel TTC (montantUnitaireReel peut être null)
            const montantHTReel = (depense.montantUnitaireReel ?? 0) * (depense.quantite ?? 1);
            const montantTTCReel = montantHTReel * (1 + tauxTotalTaxes / 100);

            // Montant prévu TTC (montantUnitairePrevu toujours défini)
            const montantHTPrevu = depense.montantUnitairePrevu * (depense.quantite ?? 1);
            const montantTTCPrevu = montantHTPrevu * (1 + tauxTotalTaxes / 100);

            const themeId = budgets.find(b => b._id.toString() === depense.budget.toString())?.theme.toString();

            if (themeId) {
                coutReelTTCParTheme.set(themeId, (coutReelTTCParTheme.get(themeId) || 0) + montantTTCReel);
                coutPrevuTTCParTheme.set(themeId, (coutPrevuTTCParTheme.get(themeId) || 0) + montantTTCPrevu);
            }
        }

        const result = themes.map(theme => ({
            themeId: theme._id,
            titreFr: theme.titreFr,
            titreEn: theme.titreEn,
            coutReelTTC: coutReelTTCParTheme.get(theme._id.toString()) || 0,
            coutPrevuTTC: coutPrevuTTCParTheme.get(theme._id.toString()) || 0,
        }));

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (err) {
        console.error('Erreur dans getCoutReelEtPrevuTTCParTheme:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


export const getCoutsThemesOuFormations = async (req, res) => {
  const { programmeId, formationId } = req.query;
  const lang = req.headers['accept-language'] || 'fr';

  if (!programmeId && !formationId) {
    return res.status(400).json({ success: false, message: t('parametre_requis', lang) });
  }

  try {
    let formations = [];

    if (formationId) {
      if (!mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }

      formations = await Formation.find({ _id: formationId }).select('_id titreFr titreEn').lean();
    }else if (programmeId) {
      if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }

      formations = await Formation.find({ programmeFormation: programmeId }).select('_id titreFr titreEn').lean();
    }

    const formationIds = formations.map(f => f._id);
    const themes = await ThemeFormation.find({ formation: { $in: formationIds } }).select('_id titreFr titreEn formation').lean();

    const themeIds = themes.map(t => t._id);
    const budgets = await BudgetFormation.find({ theme: { $in: themeIds } }).select('_id theme').lean();
    const depenses = await Depense.find({ budget: { $in: budgets.map(b => b._id) } }).populate({path:'taxes',  options:{strictPopulate:false}}).lean();

    const budgetMap = new Map(budgets.map(b => [b.theme.toString(), b._id.toString()]));

    const dataMap = new Map();

    themes.forEach(theme => {
      const budgetId = budgetMap.get(theme._id.toString());
      if (!budgetId) return;

      const depensesDuTheme = depenses.filter(d => d.budget.toString() === budgetId);

      let totalPrevu = 0;
      let totalReel = 0;

      depensesDuTheme.forEach(dep => {
        const qte = dep.quantite || 1;
        const tauxTaxes = (dep.taxes || []).reduce((acc, tax) => acc + tax.taux, 0);
        const coeff = 1 + tauxTaxes / 100;

        const prevu = dep.montantUnitairePrevu * qte * coeff;
        const reel = dep.montantUnitaireReel != null ? dep.montantUnitaireReel * qte * coeff : 0;

        totalPrevu += prevu;
        totalReel += reel;
      });

      if (formationId) {
        //  Résultat par thème
        dataMap.set(theme._id.toString(), {
          themeId: theme._id,
          titreFr: theme.titreFr,
          titreEn: theme.titreEn,
          montantPrevuTTC: Math.round(totalPrevu),
          montantReelTTC: Math.round(totalReel)
        });
      } else {
        // Résultat par formation
        const formation = formations.find(f => f._id.toString() === theme.formation.toString());
        if (!formation) return;

        const key = formation._id.toString();
        const current = dataMap.get(key) || {
          formationId: formation._id,
          titreFr: formation.titreFr,
          titreEn: formation.titreEn,
          montantPrevuTTC: 0,
          montantReelTTC: 0
        };

        current.montantPrevuTTC += totalPrevu;
        current.montantReelTTC += totalReel;
        dataMap.set(key, current);
      }
    });

    const data = Array.from(dataMap.values()).map(d => ({
      ...d,
      montantPrevuTTC: Math.round(d.montantPrevuTTC),
      montantReelTTC: Math.round(d.montantReelTTC)
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Erreur getCoutsThemesOuFormations:', err);
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};



// Retourne le taux d'exécution des tâches pour chaque thème d'une formation.
export const getTauxExecutionParTheme = async (req, res) => {
    const { programmeId, formationId } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!programmeId && !formationId) {
        return res.status(400).json({
            success: false,
            message: t('parametre_requis', lang),
        });
    }

    try {
        let formationsIds = [];

        if (formationId) {
            if (!mongoose.Types.ObjectId.isValid(formationId)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }
            formationsIds = [formationId];
        } else if (programmeId) {
            if (!mongoose.Types.ObjectId.isValid(programmeId)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }

            const formations = await Formation.find({ programmeFormation: programmeId }).select('_id').lean();
            formationsIds = formations.map(f => f._id);
        }

        const themes = await ThemeFormation.find({ formation: { $in: formationsIds } })
            .select('titreFr titreEn nbTachesTotal nbTachesExecutees')
            .lean();

        if (!themes || themes.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_theme_trouve', lang),
            });
        }

        let totalTaches = 0;
        let totalExecutees = 0;

        const themesExecution = themes.map(theme => {
            const nbTaches = theme.nbTachesTotal || 0;
            const nbTachesExecutees = theme.nbTachesExecutees || 0;

            totalTaches += nbTaches;
            totalExecutees += nbTachesExecutees;

            const tauxExecution = nbTaches > 0
                ? Math.round((nbTachesExecutees / nbTaches) * 100)
                : 0;

            return {
                id: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                nbTaches,
                nbTachesExecutees,
                tauxExecution, // en %
            };
        });

        const tauxExecutionGlobal = totalTaches > 0
            ? Math.round((totalExecutees / totalTaches) * 100)
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                tauxExecutionGlobal,
                details: themesExecution,
            },
        });

    } catch (err) {
        console.error('Erreur dans getTauxExecutionParTheme:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getTauxExecutionParAxeStrategique = async (req, res) => {
    const { programmeId, formationId } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    try {
        let formations = [];

        if (formationId) {
            if (!mongoose.Types.ObjectId.isValid(formationId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            const formation = await Formation.findById(formationId).lean();
            if (!formation) {
                return res.status(404).json({ success: false, message: t('formation_introuvable', lang) });
            }
            formations = [formation];
        } else if (programmeId) {
            if (!mongoose.Types.ObjectId.isValid(programmeId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            formations = await Formation.find({ programmeFormation: programmeId }).lean();
        } else {
            // Pas de filtre → toutes les formations
            formations = await Formation.find().lean();
        }

        const axeMap = new Map(); // Map<AxeStrategiqueId, { axe, formations[] }>
        let totalGlobalTaches = 0;
        let totalGlobalExecutees = 0;

        for (const formation of formations) {
            const axeId = formation.axeStrategique?.toString();
            if (!axeId) continue;

            if (!axeMap.has(axeId)) {
                const axe = await AxeStrategique.findById(axeId).lean();
                if (axe) axeMap.set(axeId, { axe, formationIds: [] });
            }

            if (axeMap.has(axeId)) {
                axeMap.get(axeId).formationIds.push(formation._id);
            }
        }

        const resultats = [];

        for (const [axeId, { axe, formationIds }] of axeMap.entries()) {
            const themes = await ThemeFormation.find({ formation: { $in: formationIds } })
                .select('nbTachesTotal nbTachesExecutees')
                .lean();

            let totalTaches = 0;
            let totalTachesExecutees = 0;

            themes.forEach(theme => {
                totalTaches += theme.nbTachesTotal || 0;
                totalTachesExecutees += theme.nbTachesExecutees || 0;
            });

            totalGlobalTaches += totalTaches;
            totalGlobalExecutees += totalTachesExecutees;

            const taux = totalTaches > 0
                ? Math.round((totalTachesExecutees / totalTaches) * 100)
                : 0;

            resultats.push({
                id: axe._id,
                titreFr:axe.nomFr,
                titreEn:axe.nomEn,
                nbTaches:totalTaches,
                nbTachesExecutees:totalTachesExecutees,
                tauxExecution: taux
            });
        }

        const tauxExecutionGlobal = totalGlobalTaches > 0
            ? Math.round((totalGlobalExecutees / totalGlobalTaches) * 100)
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                tauxExecutionGlobal, // Global pour toutes les formations traitées
                details: resultats
            }
        });

    } catch (err) {
        console.error('Erreur dans getTauxExecutionParAxeStrategique:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};



//Taux d'execution des formations par programme
export const getThemesExecutionParProgramme = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const formations = await Formation.find({ programme: programmeId })
        .populate('axeStrategique', 'nomFr nomEn')
        .lean();

        const results = await Promise.all(formations.map(async formation => {
            const themes = await ThemeFormation.find({ formation: formation._id })
                .select('titreFr titreEn dateDebut dateFin nbTaches nbTachesExecutees')
                .lean();

            const themesWithTaux = themes.map(theme => {
                const total = theme.nbTaches || 0;
                const exec = theme.nbTachesExecutees || 0;
                const taux = total > 0 ? Math.round((exec / total) * 100) : 0;
                return { ...theme, tauxExecution: taux };
            });

            return {
                formationId: formation._id,
                formationTitreFr: formation.titreFr,
                formationTitreEn: formation.titreEn,
                axeStrategique: formation.axeStrategique,
                themes: themesWithTaux
            };
        }));

        return res.status(200).json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};






//Taux d'execution des formations par période
export const getThemesExecutionParPeriode = async (req, res) => {
    const { dateDebut, dateFin } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!dateDebut || !dateFin) {
        return res.status(400).json({ success: false, message: t('dates_requises', lang) });
    }

    try {
        const themes = await ThemeFormation.find({
            dateDebut: { $gte: new Date(dateDebut) },
            dateFin: { $lte: new Date(dateFin) }
        })
        .populate({
            path: 'formation',
            select: 'titreFr titreEn axeStrategique',
            populate: { path: 'axeStrategique', select: 'nomFr nomEn' }
        })
        .select('titreFr titreEn dateDebut dateFin nbTaches nbTachesExecutees formation')
        .lean();

        // Regrouper les thèmes par formation
        const grouped = {};

        for (const theme of themes) {
            const formationId = theme.formation?._id?.toString();
            if (!formationId) continue;

            if (!grouped[formationId]) {
                grouped[formationId] = {
                formationId: theme.formation._id,
                formationTitreFr: theme.formation.titreFr,
                formationTitreEn: theme.formation.titreEn,
                axeStrategique: theme.formation.axeStrategique,
                themes: []
                };
            }

            const total = theme.nbTaches || 0;
            const exec = theme.nbTachesExecutees || 0;
            const taux = total > 0 ? Math.round((exec / total) * 100) : 0;

            grouped[formationId].themes.push({
                themeId: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                dateDebut: theme.dateDebut,
                dateFin: theme.dateFin,
                tauxExecution: taux
            });
        }

        return res.status(200).json({ success: true, data: Object.values(grouped) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Taux d'execution des formations par axe stratégique
export const getThemesExecutionParAxeStrategique = async (req, res) => {
    const { axeId } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(axeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const formations = await Formation.find({ axeStrategique: axeId })
        .lean();

        const results = await Promise.all(formations.map(async formation => {
            const themes = await ThemeFormation.find({ formation: formation._id })
                .select('titreFr titreEn dateDebut dateFin nbTaches nbTachesExecutees')
                .lean();

            const themesWithTaux = themes.map(theme => {
                const total = theme.nbTaches || 0;
                const exec = theme.nbTachesExecutees || 0;
                const taux = total > 0 ? Math.round((exec / total) * 100) : 0;
                return { ...theme, tauxExecution: taux };
            });

            return {
                formationId: formation._id,
                formationTitreFr: formation.titreFr,
                formationTitreEn: formation.titreEn,
                axeStrategique: formation.axeStrategique, // ou compléter par une query si nécessaire
                themes: themesWithTaux
            };
        }));

        return res.status(200).json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

//Taux d'execution des formations à partir de la recherche d'une formation
export const searchThemesExecutionParFormation = async (req, res) => {
    const { keyword } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!keyword) {
        return res.status(400).json({ success: false, message: t('mot_cle_requis', lang) });
    }

    try {
        const formations = await Formation.find({
        $or: [
            { titreFr: { $regex: keyword, $options: 'i' } },
            { titreEn: { $regex: keyword, $options: 'i' } }
        ]
        }).populate('axeStrategique', 'nomFr nomEn').lean();

        const results = await Promise.all(formations.map(async formation => {
            const themes = await ThemeFormation.find({ formation: formation._id })
                .select('titreFr titreEn dateDebut dateFin nbTaches nbTachesExecutees')
                .lean();

            const themesWithTaux = themes.map(theme => {
                const total = theme.nbTaches || 0;
                const exec = theme.nbTachesExecutees || 0;
                const taux = total > 0 ? Math.round((exec / total) * 100) : 0;
                return { ...theme, tauxExecution: taux };
            });

            return {
                formationId: formation._id,
                formationTitreFr: formation.titreFr,
                formationTitreEn: formation.titreEn,
                axeStrategique: formation.axeStrategique,
                themes: themesWithTaux
            };
        }));

        return res.status(200).json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};



export const getUpcomingFormationsByProgramme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { programmeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr' ? "Identifiant de programme invalide" : "Invalid program ID",
    });
  }

  try {
    const formations = await Formation.find({ programmeFormation: programmeId })
      .lean();
    
    const formationIds = formations.map(f => f._id);

    const themes = await ThemeFormation.find({
      formation: { $in: formationIds }
    })
      .sort({ dateDebut: 1 }) // tri croissant par date
      .populate('formation')
      .lean();
      

    const themesByFormation = {};
    for (const theme of themes) {
      const formationId = theme.formation._id.toString();
      if (!themesByFormation[formationId]) themesByFormation[formationId] = [];
      themesByFormation[formationId].push(theme);
    }

    // Limiter aux 10 premières formations par date de début
    const upcomingFormations = Object.entries(themesByFormation)
      .map(([formationId, themes]) => {
        const sortedThemes = themes.sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));
        const firstTheme = sortedThemes[0];
        const lastTheme = sortedThemes[sortedThemes.length - 1];

        return {
          formation: themes[0].formation,
          dateDebut: firstTheme.dateDebut,
          dateFin: lastTheme.dateFin,
          themeIds: themes.map(t => t._id),
          nbTheme: themes.length
        };
      })
      .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut))
      .slice(0, 10);
      
    // Calcul du nombre de participants et de formateurs pour chaque formation
    const response = await Promise.all(
      upcomingFormations.map(async (f) => {
        const themeIds = f.themeIds;

        const lieux = await LieuFormation.find({
        theme: { $in: themeIds },
        }).select('cohortes').lean();

        const cohorteIds = lieux
        .flatMap(lieu => lieu.cohortes || [])
        .filter(id => mongoose.Types.ObjectId.isValid(id));

        const nbParticipants = await CohorteUtilisateur.countDocuments({
          cohorte: { $in: cohorteIds }
        });

        const nbFormateurs = await Formateur.countDocuments({
          theme: { $in: themeIds }
        });

        return {
          titreFr: f.formation.titreFr,
          titreEn: f.formation.titreEn,
          dateDebut: f.dateDebut,
          dateFin: f.dateFin,
          nbTheme: f.nbTheme,
          nbParticipants,
          nbFormateurs
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Erreur dans getUpcomingFormationsByProgramme:', err);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? "Erreur serveur" : "Server error",
    });
  }
};




const moisFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const moisEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const getTauxExecutionParMois = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { programmeId } = req.params;

  if (!programmeId || !mongoose.Types.ObjectId.isValid(programmeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const formations = await Formation.find({ programmeFormation: programmeId })
      .select('_id')
      .lean();

    const formationIds = formations.map(f => f._id);

    const themes = await ThemeFormation.find({ formation: { $in: formationIds } })
      .select('dateDebut nbTachesTotal nbTachesExecutees')
      .lean();

    const dataByMonth = {};

    themes.forEach(theme => {
      if (!theme.dateDebut) return;

      const date = new Date(theme.dateDebut);
      const monthIndex = date.getMonth(); // 0-11
      const year = date.getFullYear();
      const key = `${year}-${monthIndex}`;

      const nbTaches = theme.nbTachesTotal || 0;
      const nbTachesExecutees = theme.nbTachesExecutees || 0;

      if (!dataByMonth[key]) {
        dataByMonth[key] = {
          nbTaches: 0,
          nbTachesExecutees: 0,
          monthIndex,
          year
        };
      }

      dataByMonth[key].nbTaches += nbTaches;
      dataByMonth[key].nbTachesExecutees += nbTachesExecutees;
    });

    const result = Object.values(dataByMonth)
      .sort((a, b) => {
        const dateA = new Date(a.year, a.monthIndex);
        const dateB = new Date(b.year, b.monthIndex);
        return dateA - dateB;
      })
      .map(data => ({
        moisFr: `${moisFr[data.monthIndex]} ${data.year}`,
        moisEn: `${moisEn[data.monthIndex]} ${data.year}`,
        taux: data.nbTaches > 0
          ? Math.round((data.nbTachesExecutees / data.nbTaches) * 100)
          : 0
      }));

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('Erreur dans getTauxExecutionParMois:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message
    });
  }
};












