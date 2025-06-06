import TacheStagiaire from "../models/tacheStagiaire";
import { t } from "../utils/i18n";
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Créer une tâche
export const creerTache = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, date, status, stagiaire } = req.body;
        

        const tache = await TacheStagiaire.create({ nomFr, nomEn, descriptionFr, descriptionEn, date, status, stagiaire });

        return res.status(201).json({ 
            success: true, 
            message: t('ajouter_succes', lang), 
            tache 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Modifier une tâche
export const modifierTache = async (req, res) => {
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
        const { tacheId } = req.params;
        const { nomFr, nomEn, descriptionFr, descriptionEn, date, status } = req.body;

        const tache = await TacheStagiaire.findById(tacheId);

        if (!tache) {
            return res.status(404).json({ 
                success: false, 
                message: t('tache_non_trouvee')
            });
        }

        if (tache.bloque) {
            return res.status(403).json({ 
                success: false, 
                message: t('tache_verrouiller', lang) 
            });
        }

        // Mise à jour des champs
        if (nomFr) tache.nomFr = nomFr;
        if (nomEn) tache.nomEn = nomEn;
        if (descriptionFr) tache.descriptionFr = descriptionFr;
        if (descriptionEn) tache.descriptionEn = descriptionEn;
        if (date) tache.date = date;
        if (status) tache.status = status;

        await tache.save();

        return res.status(200).json({ 
            success: true, 
            message: t('modifier_succes', lang), 
            tache 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Supprimer une tâche
export const supprimerTache = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { tacheId } = req.params;

        const tache = await TacheStagiaire.findById(tacheId);

        if (!tache) {
            return res.status(404).json({ 
                success: false, 
                message: t('tache_non_trouvee', lang) 
            });
        }

        await tache.deleteOne();

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

// Lister les tâches avec pagination et filtre
export const getTaches = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { stagiaireId, dateDebut, dateFin, page = 1, limit = 10 } = req.query;

        const filter = {};

        if (stagiaireId) filter.stagiaire = stagiaireId;
        if (dateDebut || dateFin) {
            filter.date = {};
            if (dateDebut) filter.date.$gte = new Date(dateDebut);
            if (dateFin) filter.date.$lte = new Date(dateFin);
        }

        const taches = await TacheStagiaire.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ date: 1 });

        const total = await TacheStagiaire.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: {
                taches,
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Récupérer les statistiques sur les tâches
export const statistiquesTaches = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { stagiaireId, dateDebut, dateFin } = req.query;

        const filter = {};

        if (stagiaireId) filter.stagiaire = stagiaireId;
        if (dateDebut || dateFin) {
            filter.date = {};
            if (dateDebut) filter.date.$gte = new Date(dateDebut);
            if (dateFin) filter.date.$lte = new Date(dateFin);
        }

        const totalTaches = await TacheStagiaire.countDocuments(filter);
        const totalAbsences = await TacheStagiaire.countDocuments({ ...filter, status: 'ABSENT' });
        const totalCompletees = await TacheStagiaire.countDocuments({ ...filter, status: 'COMPLETE' });

        // État des tâches journalier
        const etatJournalier = await TacheStagiaire.aggregate([
            { $match: filter },
            {
                $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                total: { $sum: 1 },
                complet: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETE'] }, 1, 0] } },
                enCours: { $sum: { $cond: [{ $eq: ['$status', 'EN COURS'] }, 1, 0] } },
                absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
                },
            },
            { $sort: { date: 1 } }, // Trier par date croissante
        ]);

        return res.status(200).json({
        success: true,
        statistiques: {
            totalTaches,
            totalAbsences,
            totalCompletees,
            progression: totalCompletees / totalTaches || 0,
            etatJournalier: etatJournalier.map((item) => ({
                date: item.date,
                total: item.total,
                complet: item.complet,
                enCours: item.enCours,
                absent: item.absent,
            })),
        },
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};
