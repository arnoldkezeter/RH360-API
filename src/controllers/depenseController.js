import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Depense from '../models/Depense.js';
import { t } from '../utils/i18n.js';

// Ajouter une dépense
export const createDepense = async (req, res) => {
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
        const { budgetId } = req.params;
        const { nomFr, nomEn, type, quantite, montantUnitairePrevu, montantUnitaireReel, taxes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(budgetId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        if (!Array.isArray(taxes) || taxes.some(t => !mongoose.Types.ObjectId.isValid(t))) {
            return res.status(400).json({ success: false, message: t('taxe_invalide', lang) });
        }

        if (montantUnitairePrevu === undefined || isNaN(montantUnitairePrevu) || montantUnitairePrevu < 0) {
            return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
        }

        if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
            return res.status(400).json({ success: false, message: t('quantite_nombre_requis', lang) });
        }

        if (montantUnitaireReel !== undefined && (isNaN(montantUnitaireReel) || montantUnitaireReel < 0)) {
            return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
        }

        const depense = new Depense({
            nomFr,
            nomEn,
            type,
            budget: budgetId,
            quantite: quantite ?? 1,
            montantUnitairePrevu,
            montantUnitaireReel: montantUnitaireReel ?? 0,
            taxes
        });

        const saved = await depense.save();
        // Population conditionnelle
        const populateOptions = ['budget']; // budget toujours présent
        if (saved.taxes && saved.taxes.length > 0) {
        populateOptions.push('taxes');
        }
        await saved.populate(populateOptions);

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: saved,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


// Modifier une dépense
export const updateDepense = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, type, budgetId, quantite, montantUnitairePrevu, montantUnitaireReel, taxes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    if (budgetId && !mongoose.Types.ObjectId.isValid(budgetId)) {
        return res.status(400).json({ success: false, message: t('budget_invalide', lang) });
    }

    if (taxes && (!Array.isArray(taxes) || taxes.some(t => !mongoose.Types.ObjectId.isValid(t)))) {
        return res.status(400).json({ success: false, message: t('taxe_invalide', lang) });
    }

    if (montantUnitairePrevu !== undefined && (isNaN(montantUnitairePrevu) || montantUnitairePrevu < 0)) {
        return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
    }

    if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
        return res.status(400).json({ success: false, message: t('quantite_nombre_requis', lang) });
    }

    if (montantUnitaireReel !== undefined && (isNaN(montantUnitaireReel) || montantUnitaireReel < 0)) {
        return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
    }

    try {
        const depense = await Depense.findById(id);
        if (!depense) {
            return res.status(404).json({
                success: false,
                message: t('depense_non_trouve', lang),
            });
        }

        depense.nomFr = nomFr ?? depense.nomFr;
        depense.nomEn = nomEn ?? depense.nomEn;
        depense.type = type ?? depense.type;
        depense.budget = budgetId ?? depense.budget;
        depense.quantite = quantite ?? depense.quantite ?? 1;
        depense.montantUnitairePrevu = montantUnitairePrevu ?? depense.montantUnitairePrevu;
        depense.montantUnitaireReel = montantUnitaireReel ?? depense.montantUnitaireReel ?? 0;
        depense.taxes = taxes ?? depense.taxes;

        await depense.save();
        // Population conditionnelle
        const populateOptions = ['budget']; // budget toujours présent
        if (depense.taxes && depense.taxes.length > 0) {
            populateOptions.push('taxes');
        }
        await depense.populate(populateOptions);

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: depense,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


// Supprimer une dépense
export const deleteDepense = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const deleted = await Depense.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: t('depense_non_trouvee', lang) });
        }

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// Lister les dépenses (pagination + filtres)
export const getFilteredDepenses = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { budgetId } = req.params;
    const {
        type,
        search,
        page = 1,
        limit = 10,
    } = req.query;

    const filters = {};

    if (budgetId && mongoose.Types.ObjectId.isValid(budgetId)) {
        filters.budget = budgetId;
    }

    if (type) {
        filters.type = type;
    }

    if (search) {
        filters.$or = [
            { nomFr: { $regex: search, $options: 'i' } },
            { nomEn: { $regex: search, $options: 'i' } },
        ];
    }

    try {
        const [total, depenses] = await Promise.all([
            Depense.countDocuments(filters),
            Depense.find(filters)
                .populate({
                    path: 'taxes',
                    select: 'natureFr natureEn taux',
                    options:{strictPopulate:false}
                })
                .populate({
                    path: 'budget',
                    select: 'nomFr nomEn'
                })
                .skip((page - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .lean()
        ]);

       
        return res.status(200).json({
            success: true,
            data: {
                depenses: depenses,
                totalItems: total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                pageSize: parseInt(limit)
            }
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

