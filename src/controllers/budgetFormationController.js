import BudgetFormation from '../models/BudgetFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer un budget
export const createBudget = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
  
    try {
        const { theme, budgetReel } = req.body;

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
            budgetReel,
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
    
        if (updates.budgetReel !== undefined) {
            budget.budgetReel = updates.budgetReel;
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
        const { natureDepenseFr, natureDepenseEn, montantUnitaireHT, quantite, natureTaxe } = req.body;
        
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

        if(typeof montantUnitaireHT === 'number' && !isNaN(montantUnitaireHT)){
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
            montantUnitaireHT,
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

        if(typeof montantUnitaireHT === 'number' && !isNaN(montantUnitaireHT)){
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

        // Récupérer tous les budgets liés aux thèmes de la formation
        const budgets = await BudgetFormation.find()
        .populate({
            path: 'theme',
            match: { formation: formationId },
            select: 'titreFr titreEn',
        })
        .populate({
            path: 'sections.lignes.natureTaxe',
            select: 'taux',
        })
        .lean();

        // Regrouper les résultats par thèmeId + budgetReel
        const map = new Map();

        for (const budget of budgets) {
        if (!budget.theme) continue;

        const themeId = budget.theme._id.toString();
        const themeKey = `${themeId}_${budget.budgetReel ? 'reel' : 'prevu'}`;

        let totalHT = 0;
        let totalTTC = 0;

        budget.sections.forEach(section => {
            section.lignes.forEach(ligne => {
            const montantHT = (ligne.montantUnitaireHT || 0) * (ligne.quantite || 0);
            const taux = ligne.natureTaxe?.taux || 0;
            const montantTTC = montantHT + (montantHT * taux / 100);

            totalHT += montantHT;
            totalTTC += montantTTC;
            });
        });

        map.set(themeKey, {
            theme: {
            _id: budget.theme._id,
            titreFr: budget.theme.titreFr,
            titreEn: budget.theme.titreEn,
            },
            budgetReel: budget.budgetReel,
            totalHT: parseFloat(totalHT.toFixed(2)),
            totalTTC: parseFloat(totalTTC.toFixed(2)),
        });
        }

        const result = Array.from(map.values());

        // Pagination manuelle
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedResult = result.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            data: paginatedResult,
            currentPage: page,
            totalPages: Math.ceil(result.length / limit),
            totalItems: result.length,
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

        // Rechercher les budgets du thème concerné
        const budgets = await BudgetFormation.find({ theme: themeId })
        .populate('sections.lignes.natureTaxe')
        .lean();

        let allLignes = [];

        for (const budget of budgets) {
        for (const section of budget.sections) {
            if (type && section.type !== type) continue;

            for (const ligne of section.lignes) {
            const montantHT = (ligne.montantUnitaireHT || 0) * (ligne.quantite || 0);
            const taux = ligne.natureTaxe?.taux || 0;
            const montantTTC = montantHT + (montantHT * taux / 100);

            allLignes.push({
                budgetReel: budget.budgetReel,
                type: section.type,
                natureDepenseFr: ligne.natureDepenseFr,
                natureDepenseEn: ligne.natureDepenseEn,
                montantUnitaireHT: ligne.montantUnitaireHT,
                quantite: ligne.quantite,
                montantHT: parseFloat(montantHT.toFixed(2)),
                montantTTC: parseFloat(montantTTC.toFixed(2)),
                taxe: {
                    taux,
                    id: ligne.natureTaxe?._id || null,
                    natureFr:ligne.natureTaxe?.natureFr || undefined,
                    natureEn:ligne.natureTaxe?.natureEn || undefined
                },
            });
            }
        }
        }

        // Pagination manuelle
        const totalItems = allLignes.length;
        const startIndex = (pageInt - 1) * limitInt;
        const endIndex = startIndex + limitInt;
        const paginatedLignes = allLignes.slice(startIndex, endIndex);

        return res.status(200).json({
        success: true,
        data: paginatedLignes,
        currentPage: pageInt,
        totalPages: Math.ceil(totalItems / limitInt),
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

        // Recherche uniquement les budgets dont le thème appartient à la formation spécifiée
        const budgets = await BudgetFormation.find()
        .populate({
            path: 'theme',
            match: formationId ? { formation: formationId } : {}, // <- filtre ici directement
            select: 'titreFr titreEn formation'
        })
        .lean();
  
        const resultMap = new Map();
  
        for (const budget of budgets) {
            // Si le thème est null (filtré par le match), on ignore
            if (!budget.theme) continue;
    
            const total = budget.sections.reduce((acc, section) => {
            return acc + section.lignes.reduce((sum, ligne) => {
                return sum + (ligne.montantUnitaireHT || 0) * (ligne.quantite || 0);
            }, 0);
            }, 0);
    
            const themeId = budget.theme._id.toString();
    
            if (!resultMap.has(themeId)) {
                resultMap.set(themeId, {
                    themeId,
                    titreFr: budget.theme.titreFr,
                    titreEn: budget.theme.titreEn,
                    budgetPrevu: 0,
                    budgetReel: 0,
                });
            }
    
            const themeData = resultMap.get(themeId);
            if (budget.budgetReel) {
                themeData.budgetReel += total;
            } else {
                themeData.budgetPrevu += total;
            }
        }
  
        const result = Array.from(resultMap.values()).map(item => ({
            ...item,
            ecart: Math.abs(item.budgetReel - item.budgetPrevu),
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
            select: 'formation',
            })
            .lean();
    
        let totalBudgetReel = 0;
        let totalBudgetPrevu = 0;
    
        for (const budget of budgets) {
            if (!budget.theme) continue;
    
            const total = budget.sections.reduce((acc, section) => {
            return acc + section.lignes.reduce((sum, ligne) => {
                return sum + (ligne.montantUnitaireHT || 0) * (ligne.quantite || 0);
            }, 0);
            }, 0);
    
            if (budget.budgetReel) {
            totalBudgetReel += total;
            } else {
            totalBudgetPrevu += total;
            }
        }
    
        return res.status(200).json({
            success: true,
            data: {
            totalBudgetReel,
            totalBudgetPrevu,
            totalEcart: Math.abs(totalBudgetReel - totalBudgetPrevu),
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


  
  
  
  
  
  
