import NoteService from '../models/NoteService.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';

// Créer une note de service
export const creerNoteService = async (req, res) => {
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
        const noteService = await NoteService.create(req.body);

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            noteService,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Valider une note de service
export const validerNoteService = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const { noteServiceId, fichierJoint } = req.body;

        const noteService = await NoteService.findByIdAndUpdate(
            noteServiceId,
            { valideParDG: true, fichierJoint },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: t('note_service_validee', lang),
            noteService,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
