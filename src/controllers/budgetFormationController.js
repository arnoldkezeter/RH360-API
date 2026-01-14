import BudgetFormation from '../models/BudgetFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Formation from '../models/Formation.js'
import Depense from '../models/Depense.js';
import ThemeFormation from '../models/ThemeFormation.js';

// Créer un budget
export const createBudget = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
  
    try {
        const { formation, nomFr, nomEn, statut } = req.body;

        // Validation basique
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
            });
        }

      
        // Vérifier que le thème existe
        const formationExists = await Formation.findById(formation);
        if (!formationExists) {
                return res.status(404).json({ 
                success: false, 
                message: t('formation_non_trouve', lang)
            });
        }
        
        const budget = new BudgetFormation({
            formation,
            nomFr,
            nomEn,
            statut,
        });
        
        await budget.save();
        
        res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: budget
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

//Modifier un budget
export const updateBudget = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {

        const { budgetId } = req.params;
        const updates = req.body; // Peut contenir : budgetReel, sections
        
        //validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
      
        const budget = await BudgetFormation.findByIdAndUpdate(
            budgetId,
            updates,
            { new: true, runValidators: true }
        )
        .populate('formation')
        
        if (!budget) {
            return res.status(404).json({
            success: false,
            message: t('budget_non_trouve', lang)
            });
        }
    
        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: budget,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
  
//Supprimer un budget
export const deleteBudget = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const { budgetId} = req.params;

        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
    
        const budget = await BudgetFormation.findOneAndDelete({ _id: budgetId});
    
        if (!budget) {
            return res.status(404).json({
                success: false,
                message: t('budget_non_trouve'),
            });
        }
    
        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: err.message,
        });
    }
};

export const changeStatut = async(req, res) => {
    try {
      const { id } = req.params;
      const { statut } = req.body;
      
      const validStatuts = ['BROUILLON', 'VALIDE', 'EXECUTE', 'CLOTURE'];
      if (!validStatuts.includes(statut)) {
        return res.status(400).json({
          success: false,
          message: 'statut_invalide'
        });
      }
      
      const budget = await BudgetFormation.findByIdAndUpdate(
        id,
        { statut },
        { new: true }
      ).populate('formation').populate('naturesDepenses.taxe');
      
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: t('budget_non_touve', lang)
        });
      }
      
      res.json({
        success: true,
        message: t("modifier_succes", lang),
        data: budget
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: error.message
      });
    }
}

// Récupérer tous les budgets par thème avec pagination
export const getBudgetFormationsByFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formationId } = req.params;
  const { query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(formationId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const filter = {formation: formationId };

    if (query && query.trim() !== '') {
      filter.$or = [
        { nomFr: { $regex: new RegExp(query, 'i') } },
        { nomEn: { $regex: new RegExp(query, 'i') } },
      ];
    }

    const total = await BudgetFormation.countDocuments(filter);
    const budgetFormations = await BudgetFormation.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        budgetFormations : budgetFormations,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

export const getBudgetFormationForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
    const{formationId}=req.params

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        const budgets = await BudgetFormation.find({formation:formationId}, `nomFr nomEn _id`).sort({ [sortField]: 1 }).lean();
        return res.status(200).json({
            success: true,
            data: {
                budgetFormations: budgets,
                totalItems: budgets.length,
                currentPage: 1,
                totalPages: 1,
                pageSize:  budgets.length
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


// 1. Budgets par thème avec pagination
export const getBudgetsFormationsByFormationPaginated = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(formationId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const budgets = await BudgetFormation.find({ formation: formationId })
      .populate({
        path: 'formation',
        select: 'titreFr titreEn',
      })
      .lean();

    const validBudgets = budgets.filter(b => b.formation);
    const budgetIds = validBudgets.map(b => b._id);

    const depenses = await Depense.find({ budget: { $in: budgetIds } })
       .populate({
          path: 'taxes',
          select: 'taux',
          options:{strictPopulate:false}
      })
      .lean();

    const map = new Map();

    depenses.forEach(d => {
      const budget = validBudgets.find(b => b._id.toString() === d.budget.toString());
      if (!budget || !budget.formation) return;

      const tid = budget.formation._id.toString();
      if (!map.has(tid)) {
        map.set(tid, {
          formation: budget.formation,
          totalPrevuHT: 0, totalPrevuTTC: 0, totalReelHT: 0, totalReelTTC: 0
        });
      }

      const quant = d.quantite ?? 1;
      const prevuHT = d.montantUnitairePrevu;
      const reelHT = d.montantUnitaireReel ?? prevuHT;
      const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

      const mpHT = prevuHT * quant;
      const mrHT = reelHT * quant;

      const mpTTC = mpHT * (1 + tauxTotal / 100);
      const mrTTC = mrHT * (1 + tauxTotal / 100);

      const entry = map.get(tid);
      entry.totalPrevuHT += mpHT;
      entry.totalPrevuTTC += mpTTC;
      entry.totalReelHT += mrHT;
      entry.totalReelTTC += mrTTC;
    });

    const all = Array.from(map.values()).map(e => ({
      formation: e.formation,
      totalPrevuHT: +e.totalPrevuHT.toFixed(2),
      totalPrevuTTC: +e.totalPrevuTTC.toFixed(2),
      totalReelHT: +e.totalReelHT.toFixed(2),
      totalReelTTC: +e.totalReelTTC.toFixed(2),
    }));

    const totalItems = all.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginated = all.slice((page - 1) * limit, page * limit);

    return res.json({ success: true, data: { budgetFormations: paginated, currentPage: page, totalPages, totalItems } });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// Histogramme budget prévu / réel par thème
export const getBudgetEcartParTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (themeId && !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        let themes;

        if (themeId) {
            // Récupérer un seul thème
            const theme = await ThemeFormation.findById(themeId)
                .select('_id titreFr titreEn')
                .lean();
            
            if (!theme) {
                return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
            }
            
            themes = [theme];
        } else {
            // Si pas de themeId, récupérer tous les thèmes (optionnel)
            themes = await ThemeFormation.find()
                .select('_id titreFr titreEn')
                .lean();
        }

        // Récupérer toutes les dépenses des thèmes
        const depenses = await Depense.find({ themeFormation: { $in: themes.map(t => t._id) } })
            .populate({
                path: 'taxes',
                select: 'natureFr natureEn taux',
                options: { strictPopulate: false }
            })
            .lean();

        const map = new Map();

        depenses.forEach(d => {
            const theme = themes.find(t => t._id.toString() === d.themeFormation.toString());
            if (!theme) return;

            const tid = theme._id.toString();
            if (!map.has(tid)) {
                map.set(tid, {
                    theme: theme,
                    budgetPrevu: 0,
                    budgetReel: 0,
                });
            }

            const quant = d.quantite ?? 1;
            const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

            const prevu = d.montantUnitairePrevu * quant * (1 + tauxTotal / 100);
            const reel = (d.montantUnitaireReel ?? 0) * quant * (1 + tauxTotal / 100);

            const entry = map.get(tid);
            entry.budgetPrevu += prevu;
            entry.budgetReel += reel;
        });

        const resArr = Array.from(map.values()).map(e => ({
            themeId: e.theme._id,
            titreFr: e.theme.titreFr,
            titreEn: e.theme.titreEn,
            budgetPrevu: +e.budgetPrevu.toFixed(2),
            budgetReel: +e.budgetReel.toFixed(2),
            ecart: +Math.abs(e.budgetReel - e.budgetPrevu).toFixed(2),
        }));

        return res.json({ success: true, data: resArr });
    } catch (err) {
        console.error('Erreur dans getBudgetEcartParTheme:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Totaux budget par thème
export const getTotauxBudgetParTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (themeId && !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        let themes;

        if (themeId) {
            // Vérifier que le thème existe
            const theme = await ThemeFormation.findById(themeId).lean();
            if (!theme) {
                return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
            }
            themes = [theme];
        } else {
            // Tous les thèmes (optionnel)
            themes = await ThemeFormation.find().lean();
        }

        // Récupérer toutes les dépenses des thèmes
        const depenses = await Depense.find({ themeFormation: { $in: themes.map(t => t._id) } })
            .populate({
                path: 'taxes',
                select: 'natureFr natureEn taux',
                options: { strictPopulate: false }
            })
            .lean();

        let totalPrevu = 0, totalReel = 0;

        depenses.forEach(d => {
            const quant = d.quantite ?? 1;
            const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

            const prevu = d.montantUnitairePrevu * quant * (1 + tauxTotal / 100);
            const reel = (d.montantUnitaireReel ?? 0) * quant * (1 + tauxTotal / 100);

            totalPrevu += prevu;
            totalReel += reel;
        });

        return res.json({
            success: true,
            data: {
                totalBudgetPrevu: +totalPrevu.toFixed(2),
                totalBudgetReel: +totalReel.toFixed(2),
                totalEcart: (totalReel - totalPrevu).toFixed(2),
                tauxExecution: totalPrevu > 0 ? +((totalReel / totalPrevu) * 100).toFixed(2) : 0
            }
        });
    } catch (err) {
        console.error('Erreur dans getTotauxBudgetParTheme:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Coût total prévu par thème
export const getCoutTotalPrevuParTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que le thème existe
        const theme = await ThemeFormation.findById(themeId).select('_id titreFr titreEn').lean();
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Récupérer toutes les dépenses du thème
        const depenses = await Depense.find({ themeFormation: themeId })
            .populate({
                path: 'taxes',
                select: 'taux',
                options: { strictPopulate: false }
            })
            .lean();

        const totalPrevu = depenses.reduce((acc, d) => {
            const quant = d.quantite ?? 1;
            const tauxTotal = (d.taxes || []).reduce((sum, taxe) => sum + (taxe.taux || 0), 0);
            return acc + d.montantUnitairePrevu * quant * (1 + tauxTotal / 100);
        }, 0);

        return res.json({
            success: true,
            message: t('calcul_succes', lang),
            data: { 
                themeId: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                totalPrevu: +totalPrevu.toFixed(2) 
            }
        });
    } catch (err) {
        console.error('Erreur dans getCoutTotalPrevuParTheme:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Coût total réel par thème
export const getCoutTotalReelParTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que le thème existe
        const theme = await ThemeFormation.findById(themeId).select('_id titreFr titreEn').lean();
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Récupérer toutes les dépenses du thème avec montant réel
        const depenses = await Depense.find({ 
            themeFormation: themeId,
            montantUnitaireReel: { $ne: null } // Seulement les dépenses avec montant réel
        })
            .populate({
                path: 'taxes',
                select: 'taux',
                options: { strictPopulate: false }
            })
            .lean();

        const totalReel = depenses.reduce((acc, d) => {
            const quant = d.quantite ?? 1;
            const montantHT = d.montantUnitaireReel * quant;
            const tauxTotal = (d.taxes || []).reduce((sum, taxe) => sum + (taxe.taux || 0), 0);
            return acc + montantHT * (1 + tauxTotal / 100);
        }, 0);

        return res.json({
            success: true,
            message: t('calcul_succes', lang),
            data: { 
                themeId: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                totalReel: +totalReel.toFixed(2),
                nbDepensesReelles: depenses.length
            }
        });
    } catch (err) {
        console.error('Erreur dans getCoutTotalReelParTheme:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Analyse budgétaire complète d'un thème
export const getAnalyseBudgetaireTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que le thème existe
        const theme = await ThemeFormation.findById(themeId)
            .select('_id titreFr titreEn dateDebut dateFin')
            .lean();
        
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Récupérer toutes les dépenses du thème
        const depenses = await Depense.find({ themeFormation: themeId })
            .populate({
                path: 'taxes',
                select: 'natureFr natureEn taux',
                options: { strictPopulate: false }
            })
            .lean();

        let totalPrevu = 0;
        let totalReel = 0;
        let nbDepenses = depenses.length;
        let nbDepensesReelles = 0;
        
        const depensesParType = {
            ACQUISITION_BIENS_SERVICES: { prevu: 0, reel: 0, count: 0 },
            FRAIS_ADMINISTRATIF: { prevu: 0, reel: 0, count: 0 }
        };

        depenses.forEach(d => {
            const quant = d.quantite ?? 1;
            const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);
            const coeff = 1 + tauxTotal / 100;

            const prevu = d.montantUnitairePrevu * quant * coeff;
            const reel = d.montantUnitaireReel !== null 
                ? d.montantUnitaireReel * quant * coeff 
                : 0;

            totalPrevu += prevu;
            totalReel += reel;

            if (d.montantUnitaireReel !== null) {
                nbDepensesReelles++;
            }

            // Agrégation par type
            if (depensesParType[d.type]) {
                depensesParType[d.type].prevu += prevu;
                depensesParType[d.type].reel += reel;
                depensesParType[d.type].count++;
            }
        });

        const tauxExecution = totalPrevu > 0 ? (totalReel / totalPrevu) * 100 : 0;
        const ecart = totalReel - totalPrevu;
        const pourcentageEcart = totalPrevu > 0 ? (ecart / totalPrevu) * 100 : 0;

        return res.json({
            success: true,
            data: {
                theme: {
                    id: theme._id,
                    titreFr: theme.titreFr,
                    titreEn: theme.titreEn,
                    dateDebut: theme.dateDebut,
                    dateFin: theme.dateFin
                },
                budget: {
                    totalPrevu: +totalPrevu.toFixed(2),
                    totalReel: +totalReel.toFixed(2),
                    ecart: +ecart.toFixed(2),
                    pourcentageEcart: +pourcentageEcart.toFixed(2),
                    tauxExecution: +tauxExecution.toFixed(2)
                },
                depenses: {
                    total: nbDepenses,
                    avecMontantReel: nbDepensesReelles,
                    sansMontantReel: nbDepenses - nbDepensesReelles
                },
                parType: {
                    acquisitionBiensServices: {
                        prevu: +depensesParType.ACQUISITION_BIENS_SERVICES.prevu.toFixed(2),
                        reel: +depensesParType.ACQUISITION_BIENS_SERVICES.reel.toFixed(2),
                        count: depensesParType.ACQUISITION_BIENS_SERVICES.count
                    },
                    fraisAdministratif: {
                        prevu: +depensesParType.FRAIS_ADMINISTRATIF.prevu.toFixed(2),
                        reel: +depensesParType.FRAIS_ADMINISTRATIF.reel.toFixed(2),
                        count: depensesParType.FRAIS_ADMINISTRATIF.count
                    }
                }
            }
        });
    } catch (err) {
        console.error('Erreur dans getAnalyseBudgetaireTheme:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

//Comparaison budgétaire entre plusieurs thèmes
export const comparerBudgetsThemes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeIds } = req.body; // Array d'IDs de thèmes

    if (!Array.isArray(themeIds) || themeIds.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: t('theme_ids_requis', lang) 
        });
    }

    if (themeIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const themes = await ThemeFormation.find({ _id: { $in: themeIds } })
            .select('_id titreFr titreEn')
            .lean();

        if (themes.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: t('themes_non_trouves', lang) 
            });
        }

        const depenses = await Depense.find({ themeFormation: { $in: themeIds } })
            .populate({
                path: 'taxes',
                select: 'taux',
                options: { strictPopulate: false }
            })
            .lean();

        const comparaison = themes.map(theme => {
            const depensesDuTheme = depenses.filter(
                d => d.themeFormation.toString() === theme._id.toString()
            );

            let totalPrevu = 0;
            let totalReel = 0;

            depensesDuTheme.forEach(d => {
                const quant = d.quantite ?? 1;
                const tauxTotal = (d.taxes || []).reduce((sum, taxe) => sum + (taxe.taux || 0), 0);
                const coeff = 1 + tauxTotal / 100;

                totalPrevu += d.montantUnitairePrevu * quant * coeff;
                totalReel += (d.montantUnitaireReel ?? 0) * quant * coeff;
            });

            return {
                themeId: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                budgetPrevu: +totalPrevu.toFixed(2),
                budgetReel: +totalReel.toFixed(2),
                ecart: +(totalReel - totalPrevu).toFixed(2),
                tauxExecution: totalPrevu > 0 ? +((totalReel / totalPrevu) * 100).toFixed(2) : 0
            };
        });

        return res.json({ success: true, data: comparaison });
    } catch (err) {
        console.error('Erreur dans comparerBudgetsThemes:', err);
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


// Différentes dépenses d'un thème donné, filtrées par type (ACQUISITION_BIENS_SERVICES ou FRAIS_ADMINISTRATIF) avec pagination.
export const getFilteredDepenses = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { formationId } = req.params;
    const { type, natureDepense, page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Rechercher les budgets liés au thème
        const budgets = await BudgetFormation.find({ formation: formationId })
            .populate('naturesDepenses.taxe', 'taux natureFr natureEn')
            .lean();

        const depensesFiltrees = [];

        for (const budget of budgets) {
            for (const natureDepenseItem of budget.naturesDepenses || []) {
                // Filtrer par type si fourni
                if (type && natureDepenseItem.type !== type) continue;

                // Filtrer par nature de dépense si fourni
                if (
                    natureDepense &&
                    ![natureDepenseItem.nomFr, natureDepenseItem.nomEn]
                        .filter(Boolean)
                        .some((nature) => nature.toLowerCase().includes(natureDepense.toLowerCase()))
                ) {
                    continue;
                }

                const taux = natureDepenseItem.taxe?.taux || 0;
                const quantite = natureDepenseItem.quantite ?? 1;

                const prevuHT = natureDepenseItem.montantUnitairePrevu || 0;
                const reelHT = natureDepenseItem.montantUnitaireReel || 0;

                const montantPrevuHT = quantite ? prevuHT * quantite : prevuHT;
                const montantReelHT = quantite ? reelHT * quantite : reelHT;

                const montantPrevuTTC = montantPrevuHT + (montantPrevuHT * taux) / 100;
                const montantReelTTC = montantReelHT + (montantReelHT * taux) / 100;

                depensesFiltrees.push({
                    type: natureDepenseItem.type,
                    nomFr: natureDepenseItem.nomFr,
                    nomEn: natureDepenseItem.nomEn,
                    montantUnitairePrevu: natureDepenseItem.montantUnitairePrevu,
                    montantUnitaireReel: natureDepenseItem.montantUnitaireReel,
                    quantite: natureDepenseItem.quantite,
                    montantPrevuHT: parseFloat(montantPrevuHT.toFixed(2)),
                    montantPrevuTTC: parseFloat(montantPrevuTTC.toFixed(2)),
                    montantReelHT: parseFloat(montantReelHT.toFixed(2)),
                    montantReelTTC: parseFloat(montantReelTTC.toFixed(2)),
                    taxe: natureDepenseItem.taxe
                        ? {
                              id: natureDepenseItem.taxe._id,
                              taux,
                              natureFr: natureDepenseItem.taxe.natureFr,
                              natureEn: natureDepenseItem.taxe.natureEn,
                          }
                        : null,
                });
            }
        }

        // Tri des dépenses par montant prévu TTC (par ordre décroissant)
        depensesFiltrees.sort((a, b) => b.montantPrevuTTC - a.montantPrevuTTC);

        const totalItems = depensesFiltrees.length;
        const totalPages = Math.ceil(totalItems / limitInt);
        const paginated = depensesFiltrees.slice((pageInt - 1) * limitInt, pageInt * limitInt);

        return res.status(200).json({
            success: true,
            data: {
                budgetFormations: paginated,
                totalItems: totalItems,
                currentPage: pageInt,
                totalPages: totalPages,
                pageSize: limitInt,
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


  
  
  
  
  
  
