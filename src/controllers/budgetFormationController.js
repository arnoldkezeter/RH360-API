import BudgetFormation from '../models/BudgetFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import ThemeFormation from '../models/ThemeFormation.js'
import Depense from '../models/Depense.js';

// Créer un budget
export const createBudget = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
  
    try {
        const { theme, nomFr, nomEn, statut } = req.body;

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
        const themeExists = await ThemeFormation.findById(theme);
        if (!themeExists) {
                return res.status(404).json({ 
                success: false, 
                message: t('theme_non_trouve', lang)
            });
        }
        
        const budget = new BudgetFormation({
            theme,
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
        .populate('theme')
        
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
      ).populate('theme').populate('naturesDepenses.taxe');
      
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
export const getBudgetFormationsByTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;
  const { query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const filter = { theme: themeId };

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

export const getBudgetThemesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
    const{themeId}=req.params

    try {
        if (!mongoose.Types.ObjectId.isValid(themeId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        const budgets = await BudgetFormation.find({theme:themeId}, `nomFr nomEn _id`).sort({ [sortField]: 1 }).lean();
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
export const getBudgetsThemesParFormationPaginated = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(formationId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const budgets = await BudgetFormation.find()
      .populate({
        path: 'theme',
        match: { formation: formationId },
        select: 'titreFr titreEn',
      })
      .lean();

    const validBudgets = budgets.filter(b => b.theme);
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
      if (!budget || !budget.theme) return;

      const tid = budget.theme._id.toString();
      if (!map.has(tid)) {
        map.set(tid, {
          theme: budget.theme,
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
      theme: e.theme,
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

// 2. Histogramme budget prévu / réel
export const getBudgetEcartParTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formationId, themeId } = req.params;

  if (formationId && !mongoose.Types.ObjectId.isValid(formationId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  if (themeId && !mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    let budgets;

    if (themeId) {
        budgets = await BudgetFormation.find({ theme: themeId })
        .populate('theme', 'titreFr titreEn')
        .lean();
    } else if(formationId) {
      budgets = await BudgetFormation.find()
        .populate({
          path: 'theme',
          match: { formation: formationId },
          select: 'titreFr titreEn',
        })
        .lean();
      budgets = budgets.filter(b => b.theme);
      
    }

    const depenses = await Depense.find({ budget: { $in: budgets.map(b => b._id) } })
      .populate({
          path: 'taxes',
          select: 'natureFr natureEn taux',
          options:{strictPopulate:false}
      })
      .lean();

    const map = new Map();

    depenses.forEach(d => {
      const budget = budgets.find(b => b._id.toString() === d.budget.toString());
      if (!budget || !budget.theme) return;

      const tid = budget.theme._id.toString();
      if (!map.has(tid)) {
        map.set(tid, {
          theme: budget.theme,
          budgetPrevu: 0,
          budgetReel: 0,
        });
      }

      const quant = d.quantite ?? 1;
      const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

      const prevu = d.montantUnitairePrevu * quant * (1 + tauxTotal / 100);
      const reel = (d.montantUnitaireReel ?? d.montantUnitairePrevu) * quant * (1 + tauxTotal / 100);

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
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// 3. Totaux budget
export const getTotauxBudgetParFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formationId, themeId } = req.params;

  if (formationId && !mongoose.Types.ObjectId.isValid(formationId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  if (themeId && !mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    let budgets;

    if (formationId) {
      budgets = await BudgetFormation.find()
        .populate({
          path: 'theme',
          match: { formation: formationId },
          select: '_id',
        })
        .lean();
      budgets = budgets.filter(b => b.theme);
    } else {
      budgets = await BudgetFormation.find({ theme: themeId }).lean();
    }

    const depenses = await Depense.find({ budget: { $in: budgets.map(b => b._id) } })
      .populate({
          path: 'taxes',
          select: 'natureFr natureEn taux',
          options:{strictPopulate:false}
      })
      .lean();

    let totalPrevu = 0, totalReel = 0;

    depenses.forEach(d => {
      const quant = d.quantite ?? 1;
      const tauxTotal = (d.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

      const prevu = d.montantUnitairePrevu * quant * (1 + tauxTotal / 100);
      const reel = (d.montantUnitaireReel ?? d.montantUnitairePrevu) * quant * (1 + tauxTotal / 100);

      totalPrevu += prevu;
      totalReel += reel;
    });
    
    return res.json({
      success: true,
      data: {
        totalBudgetPrevu: +totalPrevu.toFixed(2),
        totalBudgetReel: +totalReel.toFixed(2),
        totalEcart: +Math.abs(totalReel - totalPrevu).toFixed(2),
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// 4a. Coût total prévu par thème
export const getCoutTotalPrevuParTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const budgets = await BudgetFormation.find({ theme: themeId }).lean();
    const depenses = await Depense.find({ budget: { $in: budgets.map(b => b._id) } })
       .populate({
          path: 'taxes',
          options:{strictPopulate:false}
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
      data: { themeId, totalPrevu: +totalPrevu.toFixed(2) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// 4b. Coût total réel par thème
export const getCoutTotalReelParTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const budgets = await BudgetFormation.find({
      theme: themeId,
      statut: { $in: ['EXECUTE', 'CLOTURE'] }
    }).lean();

    const depenses = await Depense.find({ budget: { $in: budgets.map(b => b._id) } })
       .populate({
          path: 'taxes',
          select: 'taux',
          options:{strictPopulate:false}
      })
      .lean();

    const totalReel = depenses.reduce((acc, d) => {
      const quant = d.quantite ?? 1;
      const montantHT = (d.montantUnitaireReel ?? d.montantUnitairePrevu) * quant;
      const tauxTotal = (d.taxes || []).reduce((sum, taxe) => sum + (taxe.taux || 0), 0);
      return acc + montantHT * (1 + tauxTotal / 100);
    }, 0);

    return res.json({
      success: true,
      message: t('calcul_succes', lang),
      data: { themeId, totalReel: +totalReel.toFixed(2) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};


// Différentes dépenses d'un thème donné, filtrées par type (ACQUISITION_BIENS_SERVICES ou FRAIS_ADMINISTRATIF) avec pagination.
export const getFilteredDepenses = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { type, natureDepense, page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    try {
        if (!mongoose.Types.ObjectId.isValid(themeId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Rechercher les budgets liés au thème
        const budgets = await BudgetFormation.find({ theme: themeId })
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


  
  
  
  
  
  
