import Stagiaire from '../models/Stagiaire.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import { generateRandomPassword } from '../utils/generatePassword.js';
import { sendAccountEmail } from '../utils/sendMail.js';
import { Groupe } from '../models/Groupe.js';

// Ajouter un stagiaire et enregistrer une demande de stage
export const createStagiaire = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    // Validation des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        
        const { nom, prenom, email, genre, dateNaissance, lieuNaissance, telephone, parcours } = req.body;

        // Vérifier si l'email existe déjà
        const exists = await Stagiaire.exists({ email });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('stagiaire_email_existe', lang),
            });
        }

        const password = generateRandomPassword();
        // Créer un stagiaire
        const stagiaire = await Stagiaire.create({
            nom,
            prenom,
            email,
            motDePasse : password,
            genre,
            dateNaissance,
            lieuNaissance,
            telephone,
            parcours
        });

        
        await sendAccountEmail(email, email, password);

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            stagiaire,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const updateStagiaire = async (req, res) => {
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
        const stagiaireData = req.body;

        const stagiaire = await Stagiaire.findByIdAndUpdate(id, stagiaireData, { new: true });

        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            stagiaire,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const deleteStagiaire = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const { id } = req.params;

        const stagiaire = await Stagiaire.findByIdAndDelete(id);

        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }

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

export const updatePassword = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const stagiaire = await Stagiaire.findById(id);
        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }

        const match = await bcrypt.compare(ancienMotDePasse, stagiaire.motDePasse);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: t('mot_de_passe_incorrect', lang),
            });
        }

        const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
        stagiaire.motDePasse = hashedPassword;
        await stagiaire.save();

        return res.status(200).json({
            success: true,
            message: t('mot_de_passe_modifie', lang),
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getStagiaires = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { page = 1, limit = 10, dateDebut, dateFin, serviceId, etablissement, statut, search } = req.query;

    try {
        const skip = (page - 1) * limit;

        // Base filters for Stagiaire
        const stagiaireFilters = {};
        const stageFilters = {};

        // Add search filter
        if (search) {
            stagiaireFilters.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { prenom: { $regex: search, $options: 'i' } },
            ];
        }

        // Filter by etablissement
        if (etablissement) {
            stagiaireFilters['parcours.etablissement'] = etablissement;
        }

        // Filter for Stage (used in populate)
        if (statut) {
            stageFilters.statut = statut;
        }

        if (serviceId) {
            stageFilters['stagiaires.servicesAffectes.service'] = serviceId;
        }

        if (dateDebut && dateFin) {
            stageFilters['stagiaires.servicesAffectes.dateDebut'] = { $gte: new Date(dateDebut) };
            stageFilters['stagiaires.servicesAffectes.dateFin'] = { $lte: new Date(dateFin) };
        }

        // Fetch stagiaires
        const stagiaires = await Stagiaire.find(stagiaireFilters)
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'stages',
                match: stageFilters,
                select: 'typeStage statut stagiaires dateDebut dateFin',
            });

        // Fetch group stages separately
        const groupStages = await Groupe.find({
            stagiaires: { $in: stagiaires.map((s) => s._id) },
        })
            .populate({
                path: 'stage',
                match: stageFilters,
                select: 'typeStage statut dateDebut dateFin',
            })
            .populate({
                path: 'serviceFinal.service',
                select: 'nomFr nomEn',
            });

        // Map results
        const result = stagiaires.map((stagiaire) => {
            // Combine individual and group stages
            const individualStages = stagiaire.stages || [];
            const groupStageDetails = groupStages
                .filter((group) => group.stagiaires.includes(stagiaire._id))
                .map((group) => group.stage);

            const allStages = [...individualStages, ...groupStageDetails];

            // Get the most recent stage
            const dernierStage = allStages.sort(
                (a, b) => new Date(b.dateDebut) - new Date(a.dateDebut)
            )[0] || {};

            return {
                _id: stagiaire._id,
                nom: stagiaire.nom,
                prenom: stagiaire.prenom,
                statut: dernierStage.statut || 'EN_ATTENTE',
                periode: dernierStage.dateDebut && dernierStage.dateFin
                    ? { dateDebut: dernierStage.dateDebut, dateFin: dernierStage.dateFin }
                    : null,
                service: dernierStage.stagiaires?.[0]?.servicesAffectes?.[0]?.service || null,
            };
        });

        const total = await Stagiaire.countDocuments(stagiaireFilters);

        return res.status(200).json({
            success: true,
            data: {
                stagiaires: result,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Une erreur est survenue lors de la récupération des stagiaires (${lang})`,
            error: error.message,
        });
    }
};








