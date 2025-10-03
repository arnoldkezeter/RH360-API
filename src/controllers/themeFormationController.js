// controllers/themeFormationController.js
import PosteDeTravail from '../models/PosteDeTravail.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { calculerCoutTotalPrevu } from '../services/budgetFormationService.js';
import BudgetFormation from '../models/BudgetFormation.js';
import Depense from '../models/Depense.js';
import Utilisateur from '../models/Utilisateur.js';
import { addRoleToUser, removeRoleFromUserIfUnused } from '../utils/utilisateurRole.js';



// Ajouter
export const createThemeFormation = async (req, res) => {
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
        const { titreFr, titreEn, dateDebut, dateFin, responsable, formation, publicCible } = req.body;
        
        // Validation de l'ID de formation
        if (formation && !mongoose.Types.ObjectId.isValid(formation._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Validation de l'ID de responsable
        if (responsable && !mongoose.Types.ObjectId.isValid(responsable._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Validation et extraction des IDs du public cible
        const publicCibleIds = [];
        if (publicCible && Array.isArray(publicCible)) {
            for (const item of publicCible) {
                if (!mongoose.Types.ObjectId.isValid(item._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                publicCibleIds.push(item._id);
            }
        }

        // Vérification de l'existence du titre français
        const existsFr = await ThemeFormation.exists({ titreFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_fr', lang),
            });
        }

        // Vérification de l'existence du titre anglais
        const existsEn = await ThemeFormation.exists({ titreEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_en', lang),
            });
        }

        

        // Création du thème de formation
        const theme = await ThemeFormation.create({
            titreFr,
            titreEn,
            publicCible: publicCibleIds, // Utilisation des IDs extraits
            lieux: [],
            dateDebut,
            dateFin,
            formateurs: [],
            responsable: responsable?._id || undefined,
            supports: [],
            formation: formation?._id || undefined,
        });

        if (responsable?._id) {
            await addRoleToUser(responsable?._id, 'RESPONSABLE-FORMATION');
        }

        // Population des références pour la réponse
        const themePopule = await ThemeFormation.findById(theme._id)
             .populate({
                path: 'formation',
                populate: {
                    path: 'programmeFormation'
                }
            })
            .populate({path:'publicCible', option:{strictPopulate:false}})
            .populate({path:'responsable', option:{strictPopulate:false}});

        // Calcul de la durée de la formation
        let duree = null;
        if (dateDebut && dateFin) {
            const debut = new Date(dateDebut);
            const fin = new Date(dateFin);
            const diffTime = Math.abs(fin - debut);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            duree = diffDays;
        }

        // Ajout de la durée au thème peuplé
        const themeAvecDuree = {
            ...themePopule.toObject(),
            duree: duree
        };

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: themeAvecDuree,
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
export const updateThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

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
        const {
            titreFr,
            titreEn,
            dateDebut,
            dateFin,
            responsable,
            formation,
            publicCible
        } = req.body;

        // Validation de l'ID de formation si fourni
        if (formation && !mongoose.Types.ObjectId.isValid(formation._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Validation de l'ID de responsable si fourni
        if (responsable && !mongoose.Types.ObjectId.isValid(responsable._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Validation et extraction des IDs du public cible si fourni
        let publicCibleIds = [];
        if (publicCible && Array.isArray(publicCible)) {
            for (const item of publicCible) {
                if (!mongoose.Types.ObjectId.isValid(item._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                publicCibleIds.push(item._id);
            }
        }

        // Recherche du thème existant
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }
        const oldResponsableId = theme.responsable?.toString();
        // Vérification de l'unicité du titre français
        if (titreFr !== undefined) {
            const existsFr = await ThemeFormation.findOne({ titreFr, _id: { $ne: id } });
            if (existsFr) {
                return res.status(409).json({
                    success: false,
                    message: t('theme_existante_fr', lang),
                });
            }
        }

        // Vérification de l'unicité du titre anglais
        if (titreEn !== undefined) {
            const existsEn = await ThemeFormation.findOne({ titreEn, _id: { $ne: id } });
            if (existsEn) {
                return res.status(409).json({
                    success: false,
                    message: t('theme_existante_en', lang),
                });
            }
        }

        // Mise à jour des champs
        if (titreFr !== undefined) theme.titreFr = titreFr;
        if (titreEn !== undefined) theme.titreEn = titreEn;
        if (dateDebut !== undefined) theme.dateDebut = dateDebut;
        if (dateFin !== undefined) theme.dateFin = dateFin;
        if (responsable !== undefined) theme.responsable = responsable?._id || undefined;
        if (formation !== undefined) theme.formation = formation._id;
        if (publicCible !== undefined) theme.publicCible = publicCibleIds;

        // Sauvegarde des modifications
        await theme.save();
        // ✅ Nouveau formateur → rôle ajouté
        // if (responsable?._id && responsable._id.toString() !== oldResponsableId) {
            await addRoleToUser(responsable?._id, 'RESPONSABLE-FORMATION');
    
            // Ancien formateur → retirer le rôle si plus utilisé
            if (oldResponsableId) {
                await removeRoleFromUserIfUnused(oldResponsableId, 'RESPONSABLE-FORMATION', ThemeFormation, "responsable");
            }
        // }
        

        // Population des références pour la réponse
        const themePopule = await ThemeFormation.findById(theme._id)
            .populate({
                path: 'formation',
                populate: {
                    path: 'programmeFormation'
                }
            })
            .populate({path:'publicCible', option:{strictPopulate:false}})
            .populate({path:'responsable', option:{strictPopulate:false}});

        // Calcul de la durée de la formation
        let duree = null;
        if (themePopule.dateDebut && themePopule.dateFin) {
            const debut = new Date(themePopule.dateDebut);
            const fin = new Date(themePopule.dateFin);
            const diffTime = Math.abs(fin - debut);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            duree = diffDays;
        }

        // Ajout de la durée au thème peuplé
        const themeAvecDuree = {
            ...themePopule.toObject(),
            duree: duree
        };

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: themeAvecDuree,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer
export const deleteThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
        return res.status(404).json({
            success: false,
            message: t('theme_non_trouve', lang),
        });
        }
        const oldResponsableId = theme.responsable?.toString();
        await ThemeFormation.findByIdAndDelete(id);
        if (oldResponsableId) {
            await removeRoleFromUserIfUnused(oldResponsableId, 'RESPONSABLE-FORMATION', ThemeFormation, "responsable");
        }
       
        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
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


// Ajouter un formateur
export const ajouterFormateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { formateurId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        if (!theme.formateurs.includes(formateurId)) {
            theme.formateurs.push(formateurId);
            await theme.save();
        }

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un formateur
export const supprimerFormateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id, formateurId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.formateurs = theme.formateurs.filter(f => f.toString() !== formateurId);
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Liste pour dropdown
export const getThemeFormationsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
    const{formationId}=req.params

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        const themes = await ThemeFormation.find({formation:formationId}, `titreFr titreEn _id`).sort({ [sortField]: 1 }).lean();
        return res.status(200).json({
            success: true,
            data: {
                themeFormations: themes,
                totalItems: themes.length,
                currentPage: 1,
                totalPages: 1,
                pageSize:  themes.length
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


// Filtrer la liste des thèmes de formation
export const getFilteredThemes = async (req, res) => {
  const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
  const {
    formation,
    familleMetier,
    titre,
    debut,
    fin,
    page = 1,
    limit = 10,
  } = req.query;

  const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
  const filters = {};
  let publicCibleIds = [];

  try {
    if (formation) {
      if (!mongoose.Types.ObjectId.isValid(formation)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }
      filters.formation = formation;
    }

    if (familleMetier) {
      if (!mongoose.Types.ObjectId.isValid(familleMetier)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }
      const postes = await PosteDeTravail.find({ familleMetier }).select('_id');
      publicCibleIds = postes.map(p => p._id);
      filters.publicCible = { $in: publicCibleIds };
    }

    if (titre) {
      const field = lang === 'en' ? 'titreEn' : 'titreFr';
      filters[field] = { $regex: new RegExp(titre, 'i') };
    }

    if (debut && fin) {
      filters.dateDebut = { $gte: new Date(debut) };
      filters.dateFin = { $lte: new Date(fin) };
    }

    const total = await ThemeFormation.countDocuments(filters);

    const themes = await ThemeFormation.find(filters)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ [sortField]: 1 })
      .populate({
        path: 'formation',
        populate: { path: 'programmeFormation' }
      })
      .populate({ path: 'publicCible', options: { strictPopulate: false } })
      .populate({ path: 'responsable', options: { strictPopulate: false } })
      .lean();

    const themeIds = themes.map(t => t._id);

    const budgets = await BudgetFormation.find({ theme: { $in: themeIds } }).lean();
    const budgetIds = budgets.map(b => b._id);

    const depenses = await Depense.find({ budget: { $in: budgetIds } })
       .populate({
          path: 'taxes',
          select: 'taux',
          options:{strictPopulate:false}
      })
      .lean();

    const depensesByBudget = depenses.reduce((acc, dep) => {
      const bid = dep.budget.toString();
      if (!acc[bid]) acc[bid] = [];
      acc[bid].push(dep);
      return acc;
    }, {});

    const budgetsByTheme = budgets.reduce((acc, budget) => {
      const tid = budget.theme.toString();
      if (!acc[tid]) acc[tid] = [];
      acc[tid].push(budget);
      return acc;
    }, {});

    const enrichedThemes = themes.map(theme => {
      const themeId = theme._id.toString();
      const themeBudgets = budgetsByTheme[themeId] || [];

      let estimatif = 0;
      let reel = 0;

      themeBudgets.forEach(budget => {
        const depList = depensesByBudget[budget._id.toString()] || [];
        depList.forEach(dep => {
          const quantite = dep.quantite ?? 1;
          const tauxTotal = (dep.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

          const montantPrevuHT = dep.montantUnitairePrevu || 0;
          const montantReelHT = dep.montantUnitaireReel ?? (dep.montantUnitairePrevu || 0);

          const montantPrevuTTC = montantPrevuHT * quantite * (1 + tauxTotal / 100);
          const montantReelTTC = montantReelHT * quantite * (1 + tauxTotal / 100);

          estimatif += montantPrevuTTC;
          reel += montantReelTTC;
        });
      });

      const duree = (theme.dateDebut && theme.dateFin)
        ? Math.ceil((new Date(theme.dateFin) - new Date(theme.dateDebut)) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...theme,
        budgetEstimatif: Math.round(estimatif * 100) / 100,
        budgetReel: Math.round(reel * 100) / 100,
        duree,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        themeFormations: enrichedThemes,
        totalItems: total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        pageSize: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Erreur dans getFilteredThemes:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};



// Liste paginée des thèmes filtrés par familleMetier
export const getThemesByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!familleMetierId || !mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const publics = await PosteDeTravail.find({ familleMetier: familleMetierId }).select('_id');
        const publicIds = publics.map(p => p._id);

        const query = { publicCible: { $in: publicIds } };
        const total = await ThemeFormation.countDocuments(query);

        let themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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

// Liste paginée des thèmes par formation
export const getThemesByFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { formationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!formationId || !mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const query = { formation: formationId };
        const total = await ThemeFormation.countDocuments(query);

        const themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('formation')
        .populate('responsable')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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


export const getThemeFormations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const total = await ThemeFormation.countDocuments();
        const themes = await ThemeFormation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate('responsable')
            .populate('formation')
            .populate({ path: 'publicCible', options: { strictPopulate: false } })
            .populate({ path: 'formateurs', options: { strictPopulate: false } })
            .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
            .lean(); // lean pour améliorer les perfs

        // Calcul parallèle des coûts prévus
        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
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


// Recherche par titre
export const searchThemeFormationByTitre = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { titre } = req.query;
    const field = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const themes = await ThemeFormation.find({
        [field]: { $regex: new RegExp(titre, 'i') },
        })
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};







