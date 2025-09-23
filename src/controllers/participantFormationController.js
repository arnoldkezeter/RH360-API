import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import Utilisateur from '../models/Utilisateur.js';
import { ParticipantFormation } from '../models/ParticipantFormation.js';

// Ajouter un participant individuel
export const ajouterParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang)
        });
    }

    if (!mongoose.Types.ObjectId.isValid(themeId) || !mongoose.Types.ObjectId.isValid(participantId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }

    try {
        const theme = await ThemeFormation.findById(themeId);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Vérifier si le participant existe déjà
        const exist = await ParticipantFormation.findOne({ theme: themeId, participant: participantId });
        if (exist) {
            return res.status(400).json({
                success: false,
                message: t('participant_deja_ajoute', lang)
            });
        }

        const nouveauParticipant = new ParticipantFormation({
            theme: themeId,
            participant: participantId
        });

        await nouveauParticipant.save();

        const participantPopule = await ParticipantFormation.findById(nouveauParticipant._id)
            .populate('participant', 'nom prenom email')
            .lean();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: participantPopule
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

// Supprimer un participant
export const supprimerParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, participantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId) || !mongoose.Types.ObjectId.isValid(participantId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }

    try {
        // Vérifier que le participant est bien lié au thème
        const participant = await ParticipantFormation.findOne({
            theme: themeId,
            _id: participantId
        });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: t('participant_non_trouve', lang)
            });
        }

        await participant.deleteOne();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

// Lister les participants d’un thème (avec pagination et filtrage)
export const getParticipantFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { query, page, limit } = req.query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }

    try {
        let filter = { theme: themeId };

        if (query && query.trim() !== '') {
            // Rechercher par nom/prénom du participant
            const utilisateurs = await Utilisateur.find({
                $or: [
                    { nom: { $regex: query, $options: 'i' } },
                    { prenom: { $regex: query, $options: 'i' } }
                ]
            }).select('_id');

            filter.participant = { $in: utilisateurs.map(u => u._id) };
        }

        const total = await ParticipantFormation.countDocuments(filter);

        const participants = await ParticipantFormation.find(filter)
            .populate('participant', 'nom prenom email')
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize)
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                participantFormations:participants,
                totalItems: total,
                currentPage: pageNumber,
                totalPages: Math.ceil(total / pageSize),
                pageSize
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

export const rechercherParticipantTheme = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { query } = req.query;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }

    if (!query || query.trim() === '') {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang)
        });
    }

    try {
        // Requête optimisée : on fait l'aggregation directement sur ParticipantFormation
        const participants = await ParticipantFormation.aggregate([
            { $match: { theme: mongoose.Types.ObjectId(themeId) } },
            {
                $lookup: {
                    from: 'utilisateurs', // collection MongoDB des participants
                    localField: 'participant',
                    foreignField: '_id',
                    as: 'participantInfo'
                }
            },
            { $unwind: '$participantInfo' },
            {
                $match: {
                    $or: [
                        { 'participantInfo.nom': { $regex: query, $options: 'i' } },
                        { 'participantInfo.prenom': { $regex: query, $options: 'i' } },
                        { 'participantInfo.email': { $regex: query, $options: 'i' } }
                    ]
                }
            },
            {
                $project: {
                    _id: 0,
                    participantId: '$participantInfo._id',
                    nom: '$participantInfo.nom',
                    prenom: '$participantInfo.prenom',
                    email: '$participantInfo.email'
                }
            },
            { $limit: 50 } // limiter les résultats pour plus de performance
        ]);

        return res.status(200).json({
            success: true,
            data: {
                participantFormations:participants,
                totalItems: participants.lenght,
                currentPage: 1,
                totalPages: 1,
                pageSize:participants.lenght
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

