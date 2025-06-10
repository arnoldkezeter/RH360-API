import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Formation from '../models/Formation.js';
import { getStatsGroupedByField } from '../services/evaluationAChaudReponseService.js';

// Soumettre une réponse à une évaluation
export const submitEvaluationAChaudReponse = async (req, res) => {
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
        const { formation, utilisateur, modele } = req.body;

        const dejaRepondu = await EvaluationAChaudReponse.findOne({ formation, utilisateur, modele });
        if (dejaRepondu) {
            return res.status(400).json({ 
                success: false, 
                message: t('evaluation_deja_repondu', lang) 
            });
        }

        const reponse = new EvaluationAChaudReponse(req.body);
        await reponse.save();

        return res.status(201).json({ 
            success: true, 
            message: t('ajoute_succes', lang), 
            data: reponse 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Obtenir les réponses d’un utilisateur
export const getReponsesParUtilisateur = async (req, res) => {
    const { utilisateurId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ utilisateur: utilisateurId })
        .populate('modele', 'titreFr titreEn')
        .populate('formation', 'themeFr themeEn');

        return res.status(200).json({ 
            success: true, 
            data: reponses 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Obtenir les réponses d'une session de formation
export const getReponsesParSession = async (req, res) => {
    const { formationId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ formation: formationId })
        .populate('utilisateur', 'nom prenom email')
        .populate('modele', 'titreFr titreEn');

        return res.status(200).json({ 
            success: true, 
            data: reponses 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Statistiques globales

export const getStatsParRubrique = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.rubrique',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const getStatsParQuestion = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.question',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const getStatsParSousQuestion = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.sousQuestion',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

//Taux de personne ayant participer au sondage
export const getTauxReponseFormation = async (req, res) => {
    const { formationId } = req.params;
    try {
        const formation = await Formation.findById(formationId).populate('participants');

        const nbAttendus = formation?.participants?.length || 0;

        const nbReponses = await EvaluationAChaudReponse.countDocuments({ formation: formationId });

        const taux = nbAttendus > 0 ? (nbReponses / nbAttendus) * 100 : 0;

        return res.status(200).json({
            success: true,
            data: { totalAttendus: nbAttendus, totalReponses: nbReponses, taux }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Reponses d'un utilisateur
export const getReponsesUtilisateur = async (req, res) => {
    const { utilisateurId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ utilisateur: utilisateurId })
            .populate('formation', 'intituleFr intituleEn')
            .populate('modele', 'titreFr titreEn');

        return res.status(200).json({ success: true, data: reponses });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Générer des stats sur les réponses utilisateur
export const getStatsByField = async (req, res) => {
    const { formationId } = req.params;
    const { field } = req.query; // exemple: ?field=sexe

    const result = await getStatsGroupedByField(formationId, field);

    return res.status(result.success ? 200 : 500).json(result);
};


//Par participant (utilisateur spécifique)
export const getStatsParParticipant = async (req, res) => {
    const { utilisateurId, formationId } = req.params;

    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            {
                $match: {
                    formation: new mongoose.Types.ObjectId(formationId),
                    utilisateur: new mongoose.Types.ObjectId(utilisateurId)
                }
            },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: {
                        rubrique: '$reponses.rubrique',
                        question: '$reponses.question',
                        sousQuestion: '$reponses.sousQuestion'
                    },
                    moyenne: { $avg: '$reponses.note' },
                    total: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};











