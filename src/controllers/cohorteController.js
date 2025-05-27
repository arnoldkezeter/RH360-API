// controllers/cohorteController.js

import Cohorte from '../models/Cohorte.js';
import Utilisateur from '../models/Utilisateur.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

// Créer une cohorte
export const createCohorte = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

        const existsFr = await Cohorte.exists({ nomFr });
        if (existsFr) {
        return res.status(409).json({ success: false, message: t('cohorte_existante_fr', lang) });
        }
        const existsEn = await Cohorte.exists({ nomEn });
        if (existsEn) {
        return res.status(409).json({ success: false, message: t('cohorte_existante_en', lang) });
        }

        const cohorte = await Cohorte.create({ nomFr, nomEn, descriptionFr, descriptionEn });
        return res.status(201).json({ success: true, message: t('ajouter_succes', lang), data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une cohorte
export const updateCohorte = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: t('champs_obligatoires', lang), errors: errors.array().map(err => err.msg) });
    }

    try {
        const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;
        const cohorte = await Cohorte.findById(id);
        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        const existsFr = await Cohorte.findOne({ nomFr, _id: { $ne: id } });
        if (existsFr) return res.status(409).json({ success: false, message: t('cohorte_existante_fr', lang) });
        const existsEn = await Cohorte.findOne({ nomEn, _id: { $ne: id } });
        if (existsEn) return res.status(409).json({ success: false, message: t('cohorte_existante_en', lang) });

        cohorte.nomFr = nomFr;
        cohorte.nomEn = nomEn;
        cohorte.descriptionFr = descriptionFr;
        cohorte.descriptionEn = descriptionEn;

        await cohorte.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une cohorte
export const deleteCohorte = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const cohorte = await Cohorte.findById(id);
        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        await Cohorte.deleteOne({ _id: id });
        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Ajouter un utilisateur à une cohorte
export const addUserToCohorte = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const user = await Utilisateur.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: t('utilisateur_non_trouve', lang) });

        const cohorte = await Cohorte.findById(id);
        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        if (!cohorte.utilisateurs.includes(userId)) {
        cohorte.utilisateurs.push(userId);
        await cohorte.save();
        }

        return res.status(200).json({ success: true, message: t('ajouter_succes', lang), data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée
export const getCohortes = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Cohorte.countDocuments();
        const cohortes = await Cohorte.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate({ path: 'utilisateurs', select: 'nom prenom', options: { strictPopulate: false } })
        .lean();

        return res.status(200).json({
        success: true,
        data: cohortes,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Obtenir par ID
export const getCohorteById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const cohorte = await Cohorte.findById(id)
        .populate({ path: 'utilisateurs', select: 'nom prenom email', options: { strictPopulate: false } })
        .lean();

        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        return res.status(200).json({ success: true, data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Pour dropdown
export const getCohortesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const cohortes = await Cohorte.find({}, '_id nomFr nomEn').sort({ [sortField]: 1 }).lean();
        return res.status(200).json({ success: true, data: cohortes });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nom
export const searchCohorteByName = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({ success: false, message: t('nom_requis', lang) });
    }

    try {
        const field = lang === 'en' ? 'nomEn' : 'nomFr';
        const cohortes = await Cohorte.find({ [field]: { $regex: nom, $options: 'i' } })
        .sort({ [field]: 1 })
        .populate({ path: 'utilisateurs', select: 'nom prenom', options: { strictPopulate: false } })
        .lean();

        return res.status(200).json({ success: true, data: cohortes });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};
