import ThemeFormation from '../models/ThemeFormation.js';
import SupportFormation from '../models/SupportFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';


export const createSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: t('fichier_requis', lang),
        });
    }

    // Vérifie et crée dynamiquement le dossier d’upload s’il n’existe pas
    const uploadsDir = path.join(process.cwd(), 'public/uploads/supports');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, theme } = req.body;

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
        const tailleFichier = req.file.size;

        let support = await SupportFormation.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            fichier: fichierRelatif,
            taille: tailleFichier,
            theme,
        });

        support = await SupportFormation.findById(support._id)
            .populate({
                path: 'theme',
                select: 'titreFr titreEn dateDebut dateFin',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: support,
        });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        console.error('Erreur lors de la création du support :', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const updateSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    // Vérifie et crée dynamiquement le dossier d’upload s’il n’existe pas
    const uploadsDir = path.join(process.cwd(), 'public/uploads/supports');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
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

        const { nomFr, nomEn, descriptionFr, descriptionEn, theme } = req.body;

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
         const tailleFichier = req.file.size; // Taille en octets
        if (nomFr !== undefined) support.nomFr = nomFr;
        if (nomEn !== undefined) support.nomEn = nomEn;
        if (descriptionFr !== undefined) support.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) support.descriptionEn = descriptionEn;
        if (theme !== undefined) support.theme = theme;
        if (taille !== undefined) support.taille = tailleFichier;

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
        // Peupler le champ `theme`
        support = await SupportFormation.findById(support._id)
            .populate({
                path: 'theme',
                select: 'titreFr titreEn dateDebut dateFin',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: support,
        });

    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const deleteSupportFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

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
        const uploadsDir = path.join(process.cwd(), 'public/uploads/supports');
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
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getFilteredSupportsFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { page = 1, limit = 10, titre, themeId } = req.query;

  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const filter = {};

  // Filtrage par titre
  if (titre) {
    const queryField = lang === 'en' ? 'nomEn' : 'nomFr';
    filter[queryField] = { $regex: new RegExp(titre, 'i') };
  }

  // Filtrage par thème
  if (themeId) {
    if (!mongoose.Types.ObjectId.isValid(themeId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }
    filter.theme = themeId;
  }

  try {
    const total = await SupportFormation.countDocuments(filter);

    const supports = await SupportFormation.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ [sortField]: 1 })
      .populate({
        path: 'theme',
        select: 'titreFr titreEn dateDebut dateFin',
        options: { strictPopulate: false },
      })
      .lean();

    return res.status(200).json({
        success: true,
        data: {
            supportFormations: supports,
            totalItems: total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            pageSize: parseInt(limit),
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


//Télécharger un support de formation
export const telechargerSupportFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
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
        const cheminFichier = path.join(process.cwd(), 'public/uploads', 'supports', nomFichier);
        
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


export const getSupportFormationById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
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
