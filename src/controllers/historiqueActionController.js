// controllers/historiqueActionController.js
import HistoriqueAction from '../models/HistoriqueAction.js';
import Utilisateur from '../models/Utilisateur.js';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';

// Ajouter une action
export const createHistoriqueAction = async (req, res) => {
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
        const { utilisateur, typeAction, description, moduleConcerne, donneesSupplementaires } = req.body;

        const historique = new HistoriqueAction({
            utilisateur,
            typeAction,
            description,
            moduleConcerne,
            donneesSupplementaires
        });

        await historique.save();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: historique,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Liste avec pagination
export const getHistoriqueActions = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const total = await HistoriqueAction.countDocuments();
        const actions = await HistoriqueAction.find()
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 })
            .populate({ path: 'utilisateur', select: 'nom prenom email' });

        return res.status(200).json({
            success: true,
            data: actions,
            pagination: {
                total,
                page: parseInt(page),
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

// Historique d’un utilisateur spécifique
export const getHistoriqueByUtilisateur = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const actions = await HistoriqueAction.find({ utilisateur: id })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: actions,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
