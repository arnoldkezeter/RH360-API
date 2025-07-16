// controllers/posteDeTravailController.js
import PosteDeTravail from '../models/PosteDeTravail.js';
import FamilleMetier from '../models/FamilleMetier.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Ajouter un poste de travail
export const createPosteDeTravail = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, familleMetier } = req.body;

        // Vérifier l'unicité du nomFr et nomEn
        const existsFr = await PosteDeTravail.exists({ nomFr });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('poste_de_travail_existante_fr', lang),
        });
        }
        const existsEn = await PosteDeTravail.exists({ nomEn });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('poste_de_travail_existante_en', lang),
        });
        }

        // Valider familleMetier ObjectId et existence
        if (!mongoose.Types.ObjectId.isValid(familleMetier._id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
        }
        

        const poste = await PosteDeTravail.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            familleMetier,
        });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: poste,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Modifier un poste de travail
export const updatePosteDeTravail = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, familleMetier } = req.body;

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
        const poste = await PosteDeTravail.findById(id);
        if (!poste) {
        return res.status(404).json({
            success: false,
            message: t('poste_de_travail_non_trouve', lang),
        });
        }

        // Vérifier unicité nomFr et nomEn en excluant le poste actuel
        const existsFr = await PosteDeTravail.findOne({ nomFr, _id: { $ne: poste._id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('poste_de_travail_existante_fr', lang),
        });
        }
        const existsEn = await PosteDeTravail.findOne({ nomEn, _id: { $ne: poste._id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('poste_de_travail_existante_en', lang),
        });
        }

        if (familleMetier) {
            if (!mongoose.Types.ObjectId.isValid(familleMetier._id)) {
                return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
                });
            }
            poste.familleMetier = familleMetier;
        }

        if (nomFr) poste.nomFr = nomFr;
        if (nomEn) poste.nomEn = nomEn;
        if (descriptionFr !== undefined) poste.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) poste.descriptionEn = descriptionEn;

        await poste.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: poste,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Supprimer un poste de travail
export const deletePosteDeTravail = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const poste = await PosteDeTravail.findById(id);
        if (!poste) {
        return res.status(404).json({
            success: false,
            message: t('poste_de_travail_non_trouve', lang),
        });
        }

        await PosteDeTravail.deleteOne({ _id: id });

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

// Liste paginée des postes de travail
export const getPostesDeTravail = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await PosteDeTravail.countDocuments();

        const postes = await PosteDeTravail.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit 
            }
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Récupérer un poste par id
export const getPosteDeTravailById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const poste = await PosteDeTravail.findById(id)
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        if (!poste) {
        return res.status(404).json({
            success: false,
            message: t('poste_de_travail_non_trouve', lang),
        });
        }

        return res.status(200).json({
        success: true,
        data: poste,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Recherche par nomFr ou nomEn selon lang
export const searchPostesDeTravailByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
        success: false,
        message: t('nom_requis', lang),
        });
    }

    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';

        const postes = await PosteDeTravail.find({
        [queryField]: { $regex: nom, $options: 'i' },
        })
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
                totalItems:postes.length,
                currentPage:1,
                totalPages: 1,
                pageSize:postes.length 
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

// Liste des postes par familleMetier
export const getPostesByFamilleMetier = async (req, res) => {
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        
        const total = await PosteDeTravail.countDocuments({ familleMetier: familleMetierId });

        const postes = await PosteDeTravail.find({ familleMetier: familleMetierId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({[lang==='fr'?'nomFr':'nomEn']:1})
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit 
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


//Liste des poste de travail par famille pour dropdown
export const getPosteDeTravailsForDropdownByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {familleMetierId} = req.params;
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        if (!mongoose.Types.ObjectId.isValid(familleMetierId)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
        const posteDeTravails = await PosteDeTravail.find({familleMetier:familleMetierId}, "_id nomFr nomEn")
            .populate([
                { path: 'familleMetier', select: 'nomFr nomEn',  options:{strictPopulate:false}}
            ])
            .sort({ [sortField]: 1 })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails,
                totalItems:posteDeTravails.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:posteDeTravails.lenght
            },
        });
    } catch (err) {
      console.error('Erreur getPosteDeTravailsForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};
