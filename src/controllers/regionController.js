import Region from '../models/Region.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer une région
export const createRegion = async (req, res) => {
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
        const { code, nomFr, nomEn } = req.body;

        // Vérifier unicité code, nomFr et nomEn
        if (await Region.exists({ code })) {
        return res.status(409).json({ success: false, message: t('region_code_existante', lang) });
        }
        if (await Region.exists({ nomFr })) {
        return res.status(409).json({ success: false, message: t('region_nom_fr_existante', lang) });
        }
        if (await Region.exists({ nomEn })) {
        return res.status(409).json({ success: false, message: t('region_nom_en_existante', lang) });
        }

        const region = await Region.create({ code, nomFr, nomEn });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: region,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une région
export const updateRegion = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { code, nomFr, nomEn } = req.body;

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
        const region = await Region.findById(id);
        if (!region) {
        return res.status(404).json({ success: false, message: t('region_non_trouvee', lang) });
        }

        // Vérifier unicité code, nomFr, nomEn sauf cet enregistrement
        if (code) {
        const existsCode = await Region.findOne({ code, _id: { $ne: id } });
        if (existsCode) return res.status(409).json({ success: false, message: t('region_code_existante', lang) });
        region.code = code;
        }

        if (nomFr) {
        const existsFr = await Region.findOne({ nomFr, _id: { $ne: id } });
        if (existsFr) return res.status(409).json({ success: false, message: t('region_nom_fr_existante', lang) });
        region.nomFr = nomFr;
        }

        if (nomEn) {
        const existsEn = await Region.findOne({ nomEn, _id: { $ne: id } });
        if (existsEn) return res.status(409).json({ success: false, message: t('region_nom_en_existante', lang) });
        region.nomEn = nomEn;
        }

        await region.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: region,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une région
export const deleteRegion = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const region = await Region.findById(id);
        if (!region) {
        return res.status(404).json({ success: false, message: t('region_non_trouvee', lang) });
        }

        await Region.deleteOne({ _id: id });

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée des régions
export const getRegions = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Region.countDocuments();

        const regions = await Region.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
        success: true,
            data:{ 
                regions,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Récupérer une région par id
export const getRegionById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const region = await Region.findById(id).lean();

        if (!region) {
        return res.status(404).json({ success: false, message: t('region_non_trouvee', lang) });
        }

        return res.status(200).json({ 
            success: true, 
            data: {
                regions:[region],
                totalItems:1,
                currentPage:1,
                totalPages:1,
                pageSize:1,
            } 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nom ou code
export const searchRegionsByNameOrCode = async (req, res) => {
    const { term } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!term) {
        return res.status(400).json({ success: false, message: t('terme_requis', lang) });
    }

    try {
        const regex = new RegExp(term, 'i');
        const results = await Region.find({
        $or: [
            { code: regex },
            { nomFr: regex },
            { nomEn: regex }
        ]
        }).lean();

        return res.status(200).json({ 
            success: true, 
            data: {
                regions:results,
                totalItems:results.length,
                currentPage:1,
                totalPages: 1,
                pageSize:results.length
            
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};
