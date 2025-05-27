import Commune from '../models/Commune.js';
import Departement from '../models/Departement.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer une commune
export const createCommune = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
        success: false,
        message: t('champs_obligatoires', lang),
        errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { code, nomFr, nomEn, departement } = req.body;

        if (!mongoose.Types.ObjectId.isValid(departement)) {
        return res.status(400).json({ success: false, message: t('departement_invalide', lang) });
        }

        const departementExists = await Departement.findById(departement);
        if (!departementExists) {
        return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }

        // Optionnel : vérifier unicité du code si fourni
        if (code) {
        const codeExists = await Commune.findOne({ code });
        if (codeExists) {
            return res.status(409).json({ success: false, message: t('commune_code_existante', lang) });
        }
        }

        // Vérifier unicité nomFr et nomEn dans le même département
        const nomFrExists = await Commune.findOne({ nomFr, departement });
        if (nomFrExists) {
        return res.status(409).json({ success: false, message: t('commune_nom_fr_existante', lang) });
        }
        const nomEnExists = await Commune.findOne({ nomEn, departement });
        if (nomEnExists) {
        return res.status(409).json({ success: false, message: t('commune_nom_en_existante', lang) });
        }

        const commune = await Commune.create({ code, nomFr, nomEn, departement });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: commune,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une commune
export const updateCommune = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { code, nomFr, nomEn, departement } = req.body;

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
        const commune = await Commune.findById(id);
        if (!commune) {
        return res.status(404).json({ success: false, message: t('commune_non_trouve', lang) });
        }

        // Si département modifié, vérifier validité
        if (departement) {
        if (!mongoose.Types.ObjectId.isValid(departement)) {
            return res.status(400).json({ success: false, message: t('departement_invalide', lang) });
        }
        const departementExists = await Departement.findById(departement);
        if (!departementExists) {
            return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }
        commune.departement = departement;
        }

        // Vérifier unicité code (sauf si modif même commune)
        if (code) {
        const codeExists = await Commune.findOne({ code, _id: { $ne: id } });
        if (codeExists) {
            return res.status(409).json({ success: false, message: t('commune_code_existante', lang) });
        }
        commune.code = code;
        }

        // Vérifier unicité nomFr dans le département
        if (nomFr) {
        const nomFrExists = await Commune.findOne({ nomFr, departement: commune.departement, _id: { $ne: id } });
        if (nomFrExists) {
            return res.status(409).json({ success: false, message: t('commune_nom_fr_existante', lang) });
        }
        commune.nomFr = nomFr;
        }

        // Vérifier unicité nomEn dans le département
        if (nomEn) {
        const nomEnExists = await Commune.findOne({ nomEn, departement: commune.departement, _id: { $ne: id } });
        if (nomEnExists) {
            return res.status(409).json({ success: false, message: t('commune_nom_en_existante', lang) });
        }
        commune.nomEn = nomEn;
        }

        await commune.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: commune,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une commune
export const deleteCommune = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const commune = await Commune.findById(id);
        if (!commune) {
        return res.status(404).json({ success: false, message: t('commune_non_trouve', lang) });
        }

        await Commune.deleteOne({ _id: id });

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée des communes
export const getCommunes = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
    const total = await Commune.countDocuments();

    const communes = await Commune.find()
        .populate('departement', lang === 'en' ? 'nomEn' : 'nomFr')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

    return res.status(200).json({
        success: true,
        data: communes,
        pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        }
    });
    } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Récupérer une commune par id
export const getCommuneById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const commune = await Commune.findById(id).populate('departement').lean();

        if (!commune) {
        return res.status(404).json({ success: false, message: t('commune_non_trouve', lang) });
        }

        return res.status(200).json({ success: true, data: commune });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nomFr, nomEn ou code
export const searchCommunesByNameOrCode = async (req, res) => {
    const { term } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!term) {
        return res.status(400).json({ success: false, message: t('terme_requis', lang) });
    }

    try {
        const regex = new RegExp(term, 'i');
        const results = await Commune.find({
        $or: [
            { nomFr: regex },
            { nomEn: regex },
            { code: regex }
        ]
        })
        .populate('departement')
        .limit(20)
        .lean();

        return res.status(200).json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste des communes par département
export const getCommunesByDepartement = async (req, res) => {
    const { departementId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(departementId)) {
        return res.status(400).json({ success: false, message: t('departement_invalide', lang) });
    }

    try {
        const departementExists = await Departement.findById(departementId);
        if (!departementExists) {
        return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }

        const communes = await Commune.find({ departement: departementId }).sort(lang === 'en' ? 'nomEn' : 'nomFr').lean();

        return res.status(200).json({ success: true, data: communes });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};
