import ObjectifTheme from '../models/ObjectifTheme.js';
import ThemeFormation from '../models/themeFormation.js'; // pour vérifier la validité du thème
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Ajouter un objectifTheme
export const createObjectifTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    // Validation des champs obligatoires
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { nomFr, nomEn, descriptionFr, descriptionEn, theme } = req.body;

        // Vérifier que le thème est un ObjectId valide
        if (!mongoose.Types.ObjectId.isValid(theme)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            error: 'Invalid theme ObjectId',
        });
        }

        // Vérifier que le thème existe
        const themeExists = await ThemeFormation.findById(theme);
        if (!themeExists) {
        return res.status(404).json({
            success: false,
            message: t('theme_non_trouve', lang),
        });
        }

        // Vérifier l'unicité des noms FR et EN dans ce thème
        const existsFr = await ObjectifTheme.exists({ nomFr, theme });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('objectif_theme_existante_fr', lang),
        });
        }
        const existsEn = await ObjectifTheme.exists({ nomEn, theme });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('objectif_theme_existante_en', lang),
            });
        }

        // Création de l'objectifTheme
        const objectifTheme = await ObjectifTheme.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            theme,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: objectifTheme,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Modifier un objectifTheme
export const updateObjectifTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, theme } = req.body;

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
        const objectifTheme = await ObjectifTheme.findById(id);
        if (!objectifTheme) {
            return res.status(404).json({
                success: false,
                message: t('objectif_theme_non_trouve', lang),
            });
        }

        if (theme) {
            if (!mongoose.Types.ObjectId.isValid(theme)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }
            const themeExists = await ThemeFormation.findById(theme);
            if (!themeExists) {
                return res.status(404).json({
                    success: false,
                    message: t('theme_non_trouve', lang),
                });
            }
            objectifTheme.theme = theme;
        }

        if (nomFr) {
            const existsFr = await ObjectifTheme.findOne({ nomFr, theme: objectifTheme.theme, _id: { $ne: id } });
            if (existsFr) {
                    return res.status(409).json({
                    success: false,
                    message: t('objectif_theme_existante_fr', lang),
                });
            }
            objectifTheme.nomFr = nomFr;
        }

        if (nomEn) {
            const existsEn = await ObjectifTheme.findOne({ nomEn, theme: objectifTheme.theme, _id: { $ne: id } });
            if (existsEn) {
                return res.status(409).json({
                    success: false,
                    message: t('objectif_theme_existante_en', lang),
                });
            }
            objectifTheme.nomEn = nomEn;
        }

        if (descriptionFr !== undefined) objectifTheme.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) objectifTheme.descriptionEn = descriptionEn;

        await objectifTheme.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: objectifTheme,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un objectifTheme
export const deleteObjectifTheme = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const objectifTheme = await ObjectifTheme.findById(id);
        if (!objectifTheme) {
            return res.status(404).json({
                success: false,
                message: t('objectif_theme_non_trouve', lang),
            });
        }

        await ObjectifTheme.deleteOne({ _id: id });

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

// Liste paginée des objectifsTheme
export const getObjectifsTheme = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await ObjectifTheme.countDocuments();

        const objectifs = await ObjectifTheme.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate({
            path: 'theme',
            select: lang === 'en' ? 'nomEn' : 'nomFr',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: objectifs,
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

// Récupérer objectifTheme par ID
export const getObjectifThemeById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const objectifTheme = await ObjectifTheme.findById(id)
        .populate({
            path: 'theme',
            select: lang === 'en' ? 'nomEn' : 'nomFr',
            options: { strictPopulate: false },
        })
        .lean();

        if (!objectifTheme) {
        return res.status(404).json({
            success: false,
            message: t('objectif_theme_non_trouve', lang),
        });
        }

        return res.status(200).json({
            success: true,
            data: objectifTheme,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Rechercher objectifTheme par nom (FR ou EN selon langue)
export const searchObjectifThemeByName = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
            success: false,
            message: t('nom_requis', lang),
        });
    }

    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';

        const objectifs = await ObjectifTheme.find({
        [queryField]: { $regex: new RegExp(nom, 'i') },
        })
        .populate({
            path: 'theme',
            select: lang === 'en' ? 'nomEn' : 'nomFr',
            options: { strictPopulate: false },
        })
        .sort({ [queryField]: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            data: objectifs,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Objectifs par thème avec pagination
export const getObjectifsByTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { themeId } = req.params; // L'id du thème passé en paramètre d'URL
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validation de l'id du thème
    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const filter = { theme: themeId };

        const total = await ObjectifTheme.countDocuments(filter);

        const objectifs = await ObjectifTheme.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ nomFr: 1 }) // tri alphabétique sur le nomFr
        .lean();

        return res.status(200).json({
            success: true,
            data: objectifs,
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



