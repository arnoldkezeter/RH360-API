import TacheStagiaire from "../models/tacheStagiaire.js";
import { t } from "../utils/i18n.js";
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

// Créer une tâche
export const creerTache = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, date, status, stagiaire } = req.body;
        

        const tache = await TacheStagiaire.create({ nomFr, nomEn, descriptionFr, descriptionEn, date, status, stagiaire });

        return res.status(201).json({ 
            success: true, 
            message: t('ajouter_succes', lang), 
            data:tache 
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Modifier une tâche
export const modifierTache = async (req, res) => {
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
            data:tache 
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Supprimer une tâche
export const supprimerTache = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
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
export const getFilteredTaches = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const {
      dateDebut,
      dateFin,
      statut,
      search = '',
      page = 1,
      limit = 10
    } = req.query;
    const {stagiaireId} = req.params

    const filter = {};

    // Filtrer par stagiaire
    if (stagiaireId) {
      filter.stagiaire = stagiaireId;
    }

    // Filtrer par date
    if (dateDebut || dateFin) {
      filter.date = {};
      if (dateDebut) filter.date.$gte = new Date(dateDebut);
      if (dateFin) filter.date.$lte = new Date(dateFin);
    }

    // Filtrer par statut
    if (statut) {
      filter.status = statut;
    }

    // Recherche sur le nomFr ou nomEn
    if (search && search.trim() !== '') {
      filter.$or = [
        { nomFr: { $regex: search, $options: 'i' } },
        { nomEn: { $regex: search, $options: 'i' } }
      ];
    }

    // Récupération des tâches avec pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const taches = await TacheStagiaire.find(filter)
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TacheStagiaire.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        tachesStagiaire:taches,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        pageSize: Number(limit),
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};


// Récupérer les statistiques sur les tâches

export const statistiquesTaches = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const locale = lang === 'en' ? enUS : fr;

    try {
        const { dateDebut, dateFin } = req.query;
        const { stagiaireId } = req.params;

        const filter = {};

        // ✅ Conversion correcte du stagiaireId
        if (stagiaireId && mongoose.Types.ObjectId.isValid(stagiaireId)) {
            filter.stagiaire = new mongoose.Types.ObjectId(stagiaireId);
        }

        // ✅ Sécurisation du filtre de dates
        if (dateDebut || dateFin) {
            filter.date = {};
            if (dateDebut) filter.date.$gte = new Date(dateDebut);
            if (dateFin) filter.date.$lte = new Date(dateFin);
        }

        // ✅ Statistiques simples
        const totalTaches = await TacheStagiaire.countDocuments(filter);
        const totalAbsences = await TacheStagiaire.countDocuments({ ...filter, status: 'ABSENT' });
        const totalCompletees = await TacheStagiaire.countDocuments({ ...filter, status: 'COMPLETE' });

        // ✅ État des tâches journalier (agrégation)
        const etatJournalier = await TacheStagiaire.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    total: { $sum: 1 },
                    complet: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETE'] }, 1, 0] } },
                    enCours: { $sum: { $cond: [{ $eq: ['$status', 'EN_COURS'] }, 1, 0] } },
                    absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const mapped = etatJournalier.map((item) => {
            const date = new Date(item._id);
            const jour = format(date, 'EEE', { locale }); // Exemple : "lun." ou "Tue"

            return {
                date: item._id,
                jour,
                total: item.total,
                complet: item.complet,
                enCours: item.enCours,
                absent: item.absent,
            };
        });

        return res.status(200).json({
            success: true,
            statistiques: {
                totalTaches,
                totalAbsences,
                totalCompletees,
                progression: totalTaches > 0 ? totalCompletees / totalTaches : 0,
                etatJournalier: mapped,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


