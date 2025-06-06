import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { Chercheur } from '../models/Chercheur';
import { Groupe } from '../models/Groupe';
import { t } from '../utils/translation';
import { generateRandomPassword } from '../utils/password';
import { sendAccountEmail } from '../utils/email';

// Créer un chercheur
export const createChercheur = async (req, res) => {
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
        const { nom, prenom, email, genre, dateNaissance, lieuNaissance, telephone, domaine } = req.body;

        // Vérifier si l'email existe déjà
        const exists = await Chercheur.exists({ email });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('chercheur_email_existe', lang),
            });
        }

        const password = generateRandomPassword();
        // Créer un chercheur
        const chercheur = await Chercheur.create({
            nom,
            prenom,
            email,
            motDePasse: password,
            genre,
            dateNaissance,
            lieuNaissance,
            telephone,
            domaineRecherche:domaine,
        });

        await sendAccountEmail(email, email, password);

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            chercheur,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Mettre à jour un chercheur
export const updateChercheur = async (req, res) => {
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
        const chercheurData = req.body;

        const chercheur = await Chercheur.findByIdAndUpdate(id, chercheurData, { new: true });

        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            chercheur,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un chercheur
export const deleteChercheur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const { id } = req.params;

        const chercheur = await Chercheur.findByIdAndDelete(id);

        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
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

// Mettre à jour le mot de passe d'un chercheur
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
        const chercheur = await Chercheur.findById(id);
        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

        const match = await bcrypt.compare(ancienMotDePasse, chercheur.motDePasse);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: t('mot_de_passe_incorrect', lang),
            });
        }

        const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
        chercheur.motDePasse = hashedPassword;
        await chercheur.save();

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

// Récupérer tous les chercheurs
export const getChercheurs = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { page = 1, limit = 10, domaine, search } = req.query;

    try {
        const skip = (page - 1) * limit;

        // Base filters for Chercheur
        const chercheurFilters = {};

        // Add search filter
        if (search) {
            chercheurFilters.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { prenom: { $regex: search, $options: 'i' } },
            ];
        }

        // Filter by domaine
        if (domaine) {
            chercheurFilters.domaineRecherche = domaine;
        }

        // Fetch chercheurs
        const chercheurs = await Chercheur.find(chercheurFilters)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Chercheur.countDocuments(chercheurFilters);

        return res.status(200).json({
            success: true,
            data: {
                chercheurs,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
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
