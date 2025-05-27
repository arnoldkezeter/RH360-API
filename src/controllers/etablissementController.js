import Etablissement from '../models/Etablissement.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

export const createEtablissement = async (req, res) => {
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
        const { nomFr, nomEn } = req.body;
    
        const existsFr = await Etablissement.findOne({ nomFr });
        if (existsFr) {
            return res.status(409).json({
            success: false,
            message: t('etablissement_existante_fr', lang),
            });
        }
  
        const existsEn = nomEn && await Etablissement.findOne({ nomEn });
        if (nomEn && existsEn) {
            return res.status(409).json({
            success: false,
            message: t('etablissement_existante_en', lang),
            });
        }
  
        const etablissement = await Etablissement.create({ nomFr, nomEn });
        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: etablissement,
        });
  
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const updateEtablissement = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn } = req.body;
  
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
        const etablissement = await Etablissement.findById(id);
        if (!etablissement) {
            return res.status(404).json({
            success: false,
            message: t('etablissement_non_trouvee', lang),
            });
        }
  
        const existsFr = await Etablissement.findOne({ nomFr, _id: { $ne: id } });
        if (existsFr) {
            return res.status(409).json({
            success: false,
            message: t('etablissement_existante_fr', lang),
            });
        }
  
        if (nomEn) {
            const existsEn = await Etablissement.findOne({ nomEn, _id: { $ne: id } });
            if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('etablissement_existante_en', lang),
            });
            }
        }
  
        etablissement.nomFr = nomFr;
        etablissement.nomEn = nomEn;
        await etablissement.save();
  
        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: etablissement,
        });
  
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const deleteEtablissement = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const etablissement = await Etablissement.findById(id);
        if (!etablissement) {
        return res.status(404).json({
            success: false,
            message: t('etablissement_non_trouvee', lang),
        });
        }

        await Etablissement.deleteOne({ _id: id });
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

export const getEtablissements = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Etablissement.countDocuments();
        const etablissements = await Etablissement.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
        success: true,
        data: etablissements,
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

export const getEtablissementById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const etablissement = await Etablissement.findById(id).lean();
        if (!etablissement) {
        return res.status(404).json({
            success: false,
            message: t('etablissement_non_trouvee', lang),
        });
        }

        return res.status(200).json({
        success: true,
        data: etablissement,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

export const getEtablissementsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const etablissements = await Etablissement.find({}, '_id nomFr nomEn')
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
        success: true,
        data: etablissements,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

export const searchEtablissementByName = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
        success: false,
        message: t('nom_requis', lang),
        });
    }

    try {
        // const field = lang === 'en' ? 'nomEn' : 'nomFr';
        const field = 'nomFr';
        const etablissements = await Etablissement.find({
        [field]: { $regex: new RegExp(nom, 'i') },
        }).sort({ [field]: 1 }).lean();

        return res.status(200).json({
        success: true,
        data: etablissements,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};
  
  
  
  
  
  
  