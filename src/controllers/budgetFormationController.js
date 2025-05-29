import BudgetFormation from '../models/BudgetFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer un budget
export const createBudget = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
  
    try {
        const { theme } = req.body;

        // Validation basique
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
            });
        }

        // Créer le budget avec sections vides
        const newBudget = new BudgetFormation({
            theme,
            sections: [],
        });

        await newBudget.save();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: newBudget,
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

//Modifier un budget
export const updateBudget = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
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

        const budget = await BudgetFormation.findOne({ _id: budgetId});
        if (!budget) {
            return res.status(404).json({
                success: false,
                message: t('budget_non_trouve', lang),
            });
        }
    
        if (updates.theme !== undefined) {
            budget.theme = updates.theme;
        }
    
        await budget.save();
    
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
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
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

//Ajouter une dépense
export const addDepense = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { budgetId, sectionType } = req.params;
        const { natureDepenseFr, natureDepenseEn, montantUnitairePrevuHT,montantUnitaireReelHT, quantite, natureTaxe } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        //validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
            });
        }

        if(typeof montantUnitairePrevuHT === 'number' && !isNaN(montantUnitairePrevuHT)){
            return res.status(400).json({ message: t('montant_ht_nombre_requis', lang) });
        }

        if(typeof montantUnitaireReelHT === 'number' && !isNaN(montantUnitaireReelHT)){
            return res.status(400).json({ message: t('montant_ht_nombre_requis', lang) });
        }

        if(typeof quantite === 'number' && !isNaN(quantite)){
            return res.status(400).json({ message: t('quantite_nombre_requis', lang) });
        }
    
        // Trouver le budget par thème + type (budgetReel)
        const budget = await BudgetFormation.findOne({ _id : budgetId });
        if (!budget) {
            return res.status(404).json({
            success: false,
            message:t('budget_non_trouve', lang),
            });
        }
    
        let section = budget.sections.find(sec => sec.type === sectionType);
        if (!section) {
            section = { type: sectionType, lignes: [] };
            budget.sections.push(section);
        }
    
        section.lignes.push({
            natureDepenseFr,
            natureDepenseEn,
            montantUnitairePrevuHT,
            montantUnitaireReelHT,
            quantite,
            natureTaxe,
        });
    
        await budget.save();
    
        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: budget,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur'),
            error: err.message,
        });
    }
};

//Modifier  une dépense
export const updateDepense = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { budgetId, sectionType, ligneId } = req.params;
        const updates = req.body;

        //validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
            });
        }

        if(typeof updates.montantUnitairePrevuHT === 'number' && !isNaN(updates.montantUnitairePrevuHT)){
            return res.status(400).json({ message: t('montant_ht_nombre_requis', lang) });
        }

        if(typeof updates.montantUnitaireReelHT === 'number' && !isNaN(updates.montantUnitaireReelHT)){
            return res.status(400).json({ message: t('montant_ht_nombre_requis', lang) });
        }

        if(typeof quantite === 'number' && !isNaN(quantite)){
            return res.status(400).json({ message: t('quantite_nombre_requis', lang) });
        }

        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(ligneId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
    
        const budget = await BudgetFormation.findOne({ _id:budgetId });
        if (!budget) {
            return res.status(404).json({
                success: false,
                message: t('budget_non_trouve', lang),
            });
        }
    
        const section = budget.sections.find(sec => sec.type === sectionType);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: t('section_non_trouvee'),
            });
        }
    
        const ligne = section.lignes.id(ligneId);
        if (!ligne) {
            return res.status(404).json({
                success: false,
                message: t('depense_non_trouvee'),
            });
        }
    
        Object.keys(updates).forEach(key => {
            ligne[key] = updates[key];
        });
    
        await budget.save();
    
        return res.status(200).json({
            success: true,
            message: t('modifier_succes'),
            data: budget,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur'),
            error: err.message,
        });
    }
};

//Supprimer une dépense
export const deleteDepense = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { budgetId, sectionType, ligneId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(ligneId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
    
        const budget = await BudgetFormation.findOne({ _id:budgetId });
        if (!budget) {
            return res.status(404).json({
                success: false,
                message: t('budget_non_trouve', lang),
            });
        }
    
        const section = budget.sections.find(sec => sec.type === sectionType);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: t('section_non_trouvee', lang),
            });
        }
    
        const ligne = section.lignes.id(ligneId);
        if (!ligne) {
            return res.status(404).json({
                success: false,
                message: t('depense_non_trouvee', lang),
            });
        }
    
        ligne.remove();
    
        await budget.save();
    
        return res.status(200).json({
            success: true,
            message: t('supprimer_succes'),
            data: budget,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur'),
            error: err.message,
        });
    }
};

// Récupérer tous les budgets par theme de chaque formation avec pagination
export const getBudgetsThemesParFormationPaginated = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { formationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        // Rechercher tous les budgets dont le thème est lié à la formation
        const budgets = await BudgetFormation.find()
            .populate({
                path: 'theme',
                match: { formation: formationId },
                select: 'titreFr titreEn formation',
            })
            .populate({
                path: 'sections.lignes.natureTaxe',
                select: 'taux',
            })
            .lean();

        const resultMap = new Map();

        for (const budget of budgets) {
            if (!budget.theme) continue;

            const themeId = budget.theme._id.toString();
            const key = themeId;

            let totalPrevuHT = 0;
            let totalPrevuTTC = 0;
            let totalReelHT = 0;
            let totalReelTTC = 0;

            for (const section of budget.sections) {
                for (const ligne of section.lignes) {
                    const quantite = ligne.quantite || 0;
                    const taux = ligne.natureTaxe?.taux || 0;

                    const montantPrevuHT = (ligne.montantUnitairePrevuHT || 0) * quantite;
                    const montantPrevuTTC = montantPrevuHT + (montantPrevuHT * taux / 100);

                    const montantReelHT = (ligne.montantUnitaireReelHT || 0) * quantite;
                    const montantReelTTC = montantReelHT + (montantReelHT * taux / 100);

                    totalPrevuHT += montantPrevuHT;
                    totalPrevuTTC += montantPrevuTTC;
                    totalReelHT += montantReelHT;
                    totalReelTTC += montantReelTTC;
                }
            }

            resultMap.set(key, {
                theme: {
                    _id: budget.theme._id,
                    titreFr: budget.theme.titreFr,
                    titreEn: budget.theme.titreEn,
                },
                totalPrevuHT: parseFloat(totalPrevuHT.toFixed(2)),
                totalPrevuTTC: parseFloat(totalPrevuTTC.toFixed(2)),
                totalReelHT: parseFloat(totalReelHT.toFixed(2)),
                totalReelTTC: parseFloat(totalReelTTC.toFixed(2)),
            });
        }

        const results = Array.from(resultMap.values());
        const totalItems = results.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginated = results.slice((page - 1) * limit, page * limit);

        return res.status(200).json({
            success: true,
            data: paginated,
            currentPage: page,
            totalPages,
            totalItems,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Différentes dépenses d’un thème donné, filtrées par type (BIENS_SERVICES ou FRAIS_ADMINISTRATIF) avec pagination.
export const getDepensesParThemeEtType = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { themeId } = req.params;
    const { type, page = 1, limit = 10 } = req.query;

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
            .populate('sections.lignes.natureTaxe', 'taux natureFr natureEn')
            .lean();

        const lignesFiltres = [];

        for (const budget of budgets) {
            for (const section of budget.sections || []) {
                if (type && section.type !== type) continue;

                for (const ligne of section.lignes || []) {
                    const quantite = ligne.quantite || 0;
                    const taux = ligne.natureTaxe?.taux || 0;

                    const montantPrevuHT = (ligne.montantUnitairePrevuHT || 0) * quantite;
                    const montantReelHT = (ligne.montantUnitaireReelHT || 0) * quantite;
                    const montantPrevuTTC = montantPrevuHT + (montantPrevuHT * taux / 100);
                    const montantReelTTC = montantReelHT + (montantReelHT * taux / 100);

                    lignesFiltres.push({
                        budgetReel: budget.budgetReel,
                        type: section.type,
                        natureDepenseFr: ligne.natureDepenseFr,
                        natureDepenseEn: ligne.natureDepenseEn,
                        montantUnitairePrevuHT: ligne.montantUnitairePrevuHT,
                        montantUnitaireReelHT: ligne.montantUnitaireReelHT,
                        quantite: ligne.quantite,
                        montantPrevuHT: parseFloat(montantPrevuHT.toFixed(2)),
                        montantPrevuTTC: parseFloat(montantPrevuTTC.toFixed(2)),
                        montantReelHT: parseFloat(montantReelHT.toFixed(2)),
                        montantReelTTC: parseFloat(montantReelTTC.toFixed(2)),
                        taxe: ligne.natureTaxe ? {
                            id: ligne.natureTaxe._id,
                            taux,
                            natureFr: ligne.natureTaxe.natureFr,
                            natureEn: ligne.natureTaxe.natureEn,
                        } : null,
                    });
                }
            }
        }

        const totalItems = lignesFiltres.length;
        const totalPages = Math.ceil(totalItems / limitInt);
        const paginated = lignesFiltres.slice((pageInt - 1) * limitInt, pageInt * limitInt);

        return res.status(200).json({
            success: true,
            data: paginated,
            currentPage: pageInt,
            totalPages,
            totalItems,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};



//Histogramme budget prévu / réel
export const getBudgetEcartParTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { formationId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const budgets = await BudgetFormation.find()
            .populate({
                path: 'theme',
                match: { formation: formationId },
                select: 'titreFr titreEn formation'
            })
            .populate('sections.lignes.natureTaxe', 'taux') // uniquement les taux requis
            .lean();

        const resultMap = new Map();

        for (const budget of budgets) {
            const theme = budget.theme;
            if (!theme) continue; // filtré par match

            let totalPrevu = 0;
            let totalReel = 0;

            for (const section of budget.sections || []) {
                for (const ligne of section.lignes || []) {
                    const quantite = ligne.quantite || 0;
                    const taux = ligne.natureTaxe?.taux || 0;

                    const prevuHT = (ligne.montantUnitairePrevuHT || 0) * quantite;
                    const prevuTTC = prevuHT + (prevuHT * taux / 100);

                    const reelHT = (ligne.montantUnitaireReelHT || 0) * quantite;
                    const reelTTC = reelHT + (reelHT * taux / 100);

                    totalPrevu += prevuTTC;
                    totalReel += reelTTC;
                }
            }

            const themeId = theme._id.toString();
            if (!resultMap.has(themeId)) {
                resultMap.set(themeId, {
                    themeId,
                    titreFr: theme.titreFr,
                    titreEn: theme.titreEn,
                    budgetPrevu: 0,
                    budgetReel: 0,
                });
            }

            const entry = resultMap.get(themeId);
            entry.budgetPrevu += parseFloat(totalPrevu.toFixed(2));
            entry.budgetReel += parseFloat(totalReel.toFixed(2));
        }

        const result = Array.from(resultMap.values()).map(item => ({
            ...item,
            ecart: parseFloat(Math.abs(item.budgetReel - item.budgetPrevu).toFixed(2)),
        }));

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Total budget par formation
export const getTotauxBudgetParFormation = async (req, res) => {
    const { formationId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const budgets = await BudgetFormation.find()
            .populate({
                path: 'theme',
                match: { formation: formationId },
                select: '_id formation'
            })
            .populate({
                path: 'sections.lignes.natureTaxe',
                select: 'taux'
            })
            .lean();

        let totalBudgetReel = 0;
        let totalBudgetPrevu = 0;

        for (const budget of budgets) {
            if (!budget.theme) continue;

            for (const section of budget.sections || []) {
                for (const ligne of section.lignes || []) {
                    const quantite = ligne.quantite || 0;
                    const taux = ligne.natureTaxe?.taux || 0;

                    const prevuHT = (ligne.montantUnitairePrevuHT || 0) * quantite;
                    const prevuTTC = prevuHT + (prevuHT * taux / 100);

                    const reelHT = (ligne.montantUnitaireReelHT || 0) * quantite;
                    const reelTTC = reelHT + (reelHT * taux / 100);

                    totalBudgetPrevu += prevuTTC;
                    totalBudgetReel += reelTTC;
                }
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                totalBudgetReel: parseFloat(totalBudgetReel.toFixed(2)),
                totalBudgetPrevu: parseFloat(totalBudgetPrevu.toFixed(2)),
                totalEcart: parseFloat(Math.abs(totalBudgetReel - totalBudgetPrevu).toFixed(2)),
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


// Calculer le coût total prévu d’un thème de formation
export const getCoutTotalPrevuParTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { themeId } = req.params;

    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const budgets = await BudgetFormation.find({ theme: themeId });

        const totalPrevu = budgets.reduce((acc, budget) => {
            const lignesTotal = budget.lignes.reduce((sum, ligne) => {
                const montant = ligne.montantUnitaireHT || 0;
                const quantite = ligne.quantite || 0;
                return sum + (montant * quantite);
            }, 0);
            return acc + lignesTotal;
        }, 0);

        return res.status(200).json({
            success: true,
            message: t('calcul_succes', lang),
            data: { themeId, totalPrevu },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Calculer le coût total réel d’un thème de formation
export const getCoutTotalReelParTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { themeId } = req.params;

    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const budgets = await BudgetFormation.find({ theme: themeId, estReel: true });

        const totalReel = budgets.reduce((acc, budget) => {
            const lignesTotal = budget.lignes.reduce((sum, ligne) => {
                const montant = ligne.montantUnitaireHT || 0;
                const quantite = ligne.quantite || 0;
                return sum + (montant * quantite);
            }, 0);
            return acc + lignesTotal;
        }, 0);

        return res.status(200).json({
            success: true,
            message: t('calcul_succes', lang),
            data: { themeId, totalReel },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


  
  
  
  
  
  
