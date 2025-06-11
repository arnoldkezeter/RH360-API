import Taxe from '../models/Taxe.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer une taxe
export const createTaxe = async (req, res) => {
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
        const { natureFr, natureEn, taux } = req.body;
        // if(typeof taux === 'number' && !isNaN(taux)){
        //     return res.status(400).json({ message: t('taux_nombre_requis', lang) });
        // }
        // Vérifier unicité natureFr et natureEn
        if (await Taxe.exists({ natureFr })) {
            return res.status(409).json({ success: false, message: t('taxe_existante_fr', lang) });
        }
        if (await Taxe.exists({ natureEn })) {
            return res.status(409).json({ success: false, message: t('taxe_existante_en', lang) });
        }

        const taxe = await Taxe.create({ natureFr, natureEn, taux });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: taxe
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une taxe
export const updateTaxe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { natureFr, natureEn, taux } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
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
        // if(typeof taux === 'number' && !isNaN(taux)){
        //     return res.status(400).json({ message: t('taux_nombre_requis', lang) });
        // }

        const taxe = await Taxe.findById(id);
        if (!taxe) {
            return res.status(404).json({ success: false, message: t('taxe_non_trouvee', lang) });
        }

        // Vérifier unicité natureFr et natureEn sauf cet enregistrement
        if (natureFr) {
            const existsFr = await Taxe.findOne({ natureFr, _id: { $ne: id } });
            if (existsFr) return res.status(409).json({ success: false, message: t('taxe_existante_fr', lang) });
                taxe.natureFr = natureFr;
        }

        if (natureEn) {
            const existsEn = await Taxe.findOne({ natureEn, _id: { $ne: id } });
            if (existsEn) return res.status(409).json({ success: false, message: t('taxe_existante_en', lang) });
                taxe.natureEn = natureEn;
        }

        if (taux !== undefined) taxe.taux = taux;

        await taxe.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: taxe
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une taxe
export const deleteTaxe = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const taxe = await Taxe.findById(id);
        if (!taxe) {
        return res.status(404).json({ success: false, message: t('taxe_non_trouvee', lang) });
        }

        await Taxe.deleteOne({ _id: id });

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée des taxes
export const getTaxes = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'natureEn' : 'natureFr';

    try {
        const total = await Taxe.countDocuments();

        const taxes = await Taxe.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                taxes,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Récupérer une taxe par id
export const getTaxeById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const taxe = await Taxe.findById(id).lean();

        if (!taxe) {
        return res.status(404).json({ success: false, message: t('taxe_non_trouvee', lang) });
        }

        return res.status(200).json({ 
            success: true, 
            data: {
                taxes:[taxe],
                totalItems:1,
                currentPage:1,
                totalPages: 1,
                pageSize:1 
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nature (natureFr ou natureEn selon la langue)
export const searchTaxesByNature = async (req, res) => {
    const { nature } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!nature) {
        return res.status(400).json({ success: false, message: t('nature_requise', lang) });
    }

    try {
        const queryField = lang === 'en' ? 'natureEn' : 'natureFr';

        const taxes = await Taxe.find({
        [queryField]: { $regex: nature, $options: 'i' }
        }).lean();

        return res.status(200).json({ 
            success: true, 
            data: {
                taxes,
                totalItems:taxes.length,
                currentPage:1,
                totalPages: 1,
                pageSize:taxes.length
            } 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};
