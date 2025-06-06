// controllers/MandatRechercheController.js

import MandatRecherche from '../models/MandatRecherche.js';
import Chercheur from '../models/Chercheur.js';
import { t } from '../utils/i18n.js';
import { validationResult } from 'express-validator';
import { sendMandatNotificationEmail } from '../utils/sendMailNotificationChercheur.js';


// Enregistrer un mandat
export const createMandat = async (req, res) => {
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
        const { chercheur, statut, superviseur, structure, dateDebut, dateFin, noteService } = req.body;

        // Création du mandat
        const mandat = new MandatRecherche({
            chercheur,
            statut,
            superviseur,
            structure,
            dateDebut,
            dateFin,
            noteService,
        });

        await mandat.save();

        // Mise à jour du chercheur avec le mandat enregistré
        const chercheurDoc = await Chercheur.findById(chercheur);
        if (!chercheurDoc) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

        // Ajouter l'ID du mandat au chercheur
        chercheurDoc.mandats = chercheurDoc.mandats || [];
        chercheurDoc.mandats.push(mandat._id);
        await chercheurDoc.save();

        await sendMandatNotificationEmail(chercheurDoc.email, lang, chercheurDoc.nom, chercheurDoc.prenom)

        // Réponse au client
        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: mandat,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


// Modifier un mandat
export const updateMandat = async (req, res) => {
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
        const { id } = req.params;
        const updateData = req.body;

        const updatedMandat = await MandatRecherche.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedMandat) {
            return res.status(404).json({ 
                success:false,
                message: t('mandat_non_trouve', lang) 
            });
        }

        return res.status(200).json({ 
            success:true,
            message:t('modifier_succes', lang), 
            data: updatedMandat 
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Supprimer un mandat
export const deleteMandat = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { id } = req.params;

        const deletedMandat = await MandatRecherche.findByIdAndDelete(id);

        if (!deletedMandat) {
            return res.status(404).json({
                success:false,
                message:'mandat_non_trouve' 
            });
        }

        return res.status(200).json({
            success:true,
            message: t('supprimer_succes') 
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

// Lister les mandats avec filtres et pagination
export const getMandats = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { periodeStart, periodeEnd, etablissement, structure, page = 1, limit = 10 } = req.query;

        const filters = {};

        // Filtrer par période
        if (periodeStart && periodeEnd) {
            filters.dateDebut = { $gte: new Date(periodeStart) };
            filters.dateFin = { $lte: new Date(periodeEnd) };
        }

        // Filtrer par structure
        if (structure) filters.structure = structure;

        // Filtrer par établissement (lié au chercheur)
        if (etablissement) {
            // Récupérer les IDs des chercheurs associés à l'établissement
            const chercheurs = await Chercheur.find({ etablissement }).select('_id');
            const chercheurIds = chercheurs.map(c => c._id);

            // Ajouter le filtre pour les chercheurs
            filters.chercheur = { $in: chercheurIds };
        }

        // Pagination et tri
        const mandats = await MandatRecherche.find(filters)
            .populate('chercheur', 'nom prenom') // Récupérer les informations du chercheur
            .sort({ createdAt: -1 }) // Tri par date de création décroissante
            .skip((page - 1) * limit) // Sauter les enregistrements des pages précédentes
            .limit(parseInt(limit)); // Limiter le nombre de résultats par page

        // Compter le nombre total d'éléments
        const total = await MandatRecherche.countDocuments(filters);

        // Réponse
        return res.status(200).json({
            success: true,
            data: {
                mandats,
                page,
                limit,
                total,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang), // Traduction du message d'erreur
            error: error.message,
        });
    }
};


// Rechercher un mandat en fonction du nom ou prénom du chercheur
export const searchMandatsByChercheur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const { query, page = 1, limit = 10 } = req.query;

        if (!query) {
            return res.status(400).json({ 
                success:false,
                message: t('nom_requis', lang) 
            });
        }

        const chercheurs = await Chercheur.find({
            $or: [
                { nom: { $regex: query, $options: 'i' } },
                { prenom: { $regex: query, $options: 'i' } },
            ],
        });

        const chercheurIds = chercheurs.map(c => c._id);

        const mandats = await MandatRecherche.find({ chercheur: { $in: chercheurIds } })
            .populate('chercheur', 'nom prenom')
            .sort({ createdAt: -1 })


        return res.status(200).json({
            success:true,
            data: mandats,
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};
