// controllers/themeFormationController.js
import PosteDeTravail from '../models/PosteDeTravail.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { calculerCoutTotalPrevu } from '../services/budgetFormationService.js';

// Ajouter
export const createThemeFormation = async (req, res) => {
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
        const { titreFr, titreEn, dateDebut, dateFin, responsable, formation } = req.body;

        const existsFr = await ThemeFormation.exists({ titreFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_fr', lang),
            });
        }

        const existsEn = await ThemeFormation.exists({ titreEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_en', lang),
            });
        }

        const theme = await ThemeFormation.create({
            titreFr,
            titreEn,
            publicCible:[],
            lieux:[],
            dateDebut,
            dateFin,
            formateurs:[],
            responsable,
            supports:[],
            formation,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Modifier
export const updateThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        const existsFr = await ThemeFormation.findOne({ titreFr, _id: { $ne: id } });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_fr', lang),
            });
        }

        const existsEn = await ThemeFormation.findOne({ titreEn, _id: { $ne: id } });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('theme_existante_en', lang),
            });
        }

        const {
            titreFr,
            titreEn,
            dateDebut,
            dateFin,
            responsable,
            formation
        } = req.body;

        if (titreFr !== undefined) theme.titreFr = titreFr;
        if (titreEn !== undefined) theme.titreEn = titreEn;
        if (dateDebut !== undefined) theme.dateDebut = dateDebut;
        if (dateFin !== undefined) theme.dateFin = dateFin;
        if (responsable !== undefined) theme.responsable = responsable;
        if (formation !== undefined) theme.formation = formation;

        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer
export const deleteThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
        return res.status(404).json({
            success: false,
            message: t('theme_non_trouve', lang),
        });
        }

        await ThemeFormation.findByIdAndDelete(id);
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


// Ajouter un public cible
export const ajouterPublicCible = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { publicCibleId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(publicCibleId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        if (!theme.publicCible.includes(publicCibleId)) {
            theme.publicCible.push(publicCibleId);
            await theme.save();
        }

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un public cible
export const supprimerPublicCible = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id, publicCibleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(publicCibleId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.publicCible = theme.publicCible.filter(pc => pc.toString() !== publicCibleId);
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Ajouter un formateur
export const ajouterFormateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { formateurId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        if (!theme.formateurs.includes(formateurId)) {
            theme.formateurs.push(formateurId);
            await theme.save();
        }

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un formateur
export const supprimerFormateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id, formateurId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.formateurs = theme.formateurs.filter(f => f.toString() !== formateurId);
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Ajouter un lieu de formation
export const ajouterLieuFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { lieu, cohorte } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(cohorte)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    if (!lieu) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.lieux.push({ lieu, cohorte });
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un lieu de formation
export const supprimerLieuFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id, lieuId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(lieuId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.lieux = theme.lieux.filter(l => l._id.toString() !== lieuId);
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Liste pour dropdown
export const getThemeFormationsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const themes = await ThemeFormation.find({}, `titreFr titreEn _id`).sort({ [sortField]: 1 }).lean();
        return res.status(200).json({
            success: true,
            data: themes,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Liste paginée des thèmes filtrés par familleMetier
export const getThemesByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!familleMetierId || !mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const publics = await PosteDeTravail.find({ familleMetier: familleMetierId }).select('_id');
        const publicIds = publics.map(p => p._id);

        const query = { publicCible: { $in: publicIds } };
        const total = await ThemeFormation.countDocuments(query);

        let themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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

// Liste paginée des thèmes par formation
export const getThemesByFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { formationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!formationId || !mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const query = { formation: formationId };
        const total = await ThemeFormation.countDocuments(query);

        const themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('formation')
        .populate('responsable')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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


export const getThemeFormations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const total = await ThemeFormation.countDocuments();
        const themes = await ThemeFormation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate('responsable')
            .populate('formation')
            .populate({ path: 'publicCible', options: { strictPopulate: false } })
            .populate({ path: 'formateurs', options: { strictPopulate: false } })
            .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
            .lean(); // lean pour améliorer les perfs

        // Calcul parallèle des coûts prévus
        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
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


// Recherche par titre
export const searchThemeFormationByTitre = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { titre } = req.query;
    const field = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const themes = await ThemeFormation.find({
        [field]: { $regex: new RegExp(titre, 'i') },
        })
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .populate({ path: 'lieux.cohorte', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};







