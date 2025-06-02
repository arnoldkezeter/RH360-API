import ThemeFormation from '../models/ThemeFormation.js';
import SupportFormation from '../models/SupportFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads', 'supports');

export const createSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: t('fichier_requis', lang),
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { titreFr, titreEn, descriptionFr, descriptionEn, theme } = req.body;

        if (theme && !mongoose.Types.ObjectId.isValid(theme)) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme) : null;
        if (theme && !themeExists) {
            fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        const fichierRelatif = `/files/supports/${req.file.filename}`;

        const support = await SupportFormation.create({
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            fichier: fichierRelatif,
            theme,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: support,
        });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const updateSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const support = await SupportFormation.findById(id);
        if (!support) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                success: false,
                message: t('support_non_trouve', lang),
            });
        }

        const { titreFr, titreEn, descriptionFr, descriptionEn, theme } = req.body;

        if (theme && !mongoose.Types.ObjectId.isValid(theme)) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme) : null;
        if (theme && !themeExists) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        if (titreFr !== undefined) support.titreFr = titreFr;
        if (titreEn !== undefined) support.titreEn = titreEn;
        if (descriptionFr !== undefined) support.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) support.descriptionEn = descriptionEn;
        if (theme !== undefined) support.theme = theme;

        if (req.file) {
            // Supprimer l'ancien fichier
            if (support.fichier) {
                const nomFichier = path.basename(support.fichier);
                const ancienChemin = path.join(uploadsDir, nomFichier);
                fs.unlink(ancienChemin, (err) => { if (err) console.error(err); });
            }
            const fichierRelatif = `/files/supports/${req.file.filename}`;
            support.fichier = fichierRelatif;
        }

        await support.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: support,
        });

    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const deleteSupportFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const support = await SupportFormation.findById(id);
        if (!support) {
            return res.status(404).json({
                success: false,
                message: t('support_non_trouve', lang),
            });
        }

        if (support.fichier) {
            const nomFichier = path.basename(support.fichier); 
            const fichierPhysique = path.join(uploadsDir, nomFichier);
            fs.unlink(fichierPhysique, (err) => {
                if (err) console.error('Erreur suppression fichier:', err);
            });
        }

        await SupportFormation.deleteOne({ _id: id });

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


export const getSupportsFormation = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const total = await SupportFormation.countDocuments();

        const supports = await SupportFormation.find()
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
            data: supports,
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

export const getSupportFormationById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const support = await SupportFormation.findById(id)
            .populate({
                path: 'theme',
                select: lang === 'en' ? 'nomEn' : 'nomFr',
                options: { strictPopulate: false },
            })
            .lean();

        if (!support) {
            return res.status(404).json({
                success: false,
                message: t('support_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: support,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Recherche par titre (fr/en)
export const searchSupportFormationByTitle = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { titre } = req.query;

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const queryField = lang === 'en' ? 'titreEn' : 'titreFr';

        const supports = await SupportFormation.find({
            [queryField]: { $regex: new RegExp(titre, 'i') },
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
            data: supports,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Supports par thème
export const getSupportsByTheme = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { themeId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const skip = (page - 1) * limit;

        const supports = await SupportFormation.find({ theme: themeId })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await SupportFormation.countDocuments({ theme: themeId });

        return res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            data: supports,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Télécharger un support de formation
export const telechargerSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const support = await SupportFormation.findById(id);
        if (!support || !support.fichier) {
            return res.status(404).json({
                success: false,
                message: t('support_non_trouve', lang),
            });
        }

        const nomFichier = path.basename(support.fichier);
        const cheminFichier = path.join(process.cwd(), 'uploads', 'supports', nomFichier);

        if (!fs.existsSync(cheminFichier)) {
            return res.status(404).json({
                success: false,
                message: t('fichier_introuvable', lang),
            });
        }

        return res.download(cheminFichier, nomFichier);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
