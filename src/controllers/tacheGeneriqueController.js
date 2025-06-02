import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import TacheGenerique from '../models/TacheGenerique.js';

// Ajouter une tâche générique
export const createTacheGenerique = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
        success: false,
        message: t('champs_obligatoires', lang),
        errors: errors.array().map(err => err.msg),
        });
    }

    const { titreFr, titreEn } = req.body;

    try {
        const existsFr = await TacheGenerique.findOne({ titreFr:titreFr });
        if (existsFr) {
            return res.status(400).json({ success: false, message: t('tache_fr_existant', lang) });
        }

        const existsEn = await TacheGenerique.findOne({ titreEn:titreEn });
        if (existsEn) {
            return res.status(400).json({ success: false, message: t('tache_en_existant', lang) });
        }

        const tache = new TacheGenerique(req.body);
        await tache.save();

        return res.status(201).json({ success: true, message: t('ajouter_succes', lang), data: tache });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une tâche générique
export const updateTacheGenerique = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({ success: false, errors: errors.array() });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const { titreFr, titreEn } = req.body;

    try {
        const existingFr = await TacheGenerique.findOne({ titreFr : titreFr, _id: { $ne: id } });
        if (existingFr) {
            return res.status(400).json({ success: false, message: t('tache_fr_existant', lang) });
        }

        const existingEn = await TacheGenerique.findOne({ titreEn : titreEn, _id: { $ne: id } });
        if (existingEn) {
            return res.status(400).json({ success: false, message: t('tache_en_existant', lang) });
        }

        const tache = await TacheGenerique.findById(id);
        if (!tache) {
            return res.status(404).json({ success: false, message: t('tache_non_trouvee', lang) });
        }

        tache.titreFr = req.body.titreFr;
        tache.titreEn = req.body.titreEn;
        tache.descriptionFr = req.body.descriptionFr;
        tache.descriptionEn = req.body.descriptionEn;
        tache.methodeValidation = req.body.methodeValidation;

        await tache.save();

        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: tache });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une tâche générique
export const deleteTacheGenerique = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const tache = await TacheGenerique.findByIdAndDelete(id);
        if (!tache) {
            return res.status(404).json({ success: false, message: t('tache_non_trouvee', lang) });
        }

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Lister avec pagination et recherche
export const getTachesGeneriquesPagines = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const total = await TacheGenerique.countDocuments();
        const taches = await TacheGenerique.find()
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: taches,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Tâches pour dropdown
export const getTachesGeneriquesDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const taches = await TacheGenerique.find({}, '_id titreFr titreEn').sort({ titreFr: 1 });
        return res.status(200).json({ success: true, data: taches });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Récupérer une tâche générique par ID
export const getTacheGeneriqueById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const tache = await TacheGenerique.findById(id);
        if (!tache) {
            return res.status(404).json({ success: false, message: t('tache_non_trouvee', lang) });
        }

        return res.status(200).json({ success: true, data: tache });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const searchTachesGeneriques = async (req, res) => {
    const { search = '' } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const query = {
            $or: [
                { titreFr: { $regex: search, $options: 'i' } },
                { titreEn: { $regex: search, $options: 'i' } },
            ]
        };

        const resultats = await TacheGenerique.find(query).limit(20);

        return res.status(200).json({ success: true, data: resultats });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
