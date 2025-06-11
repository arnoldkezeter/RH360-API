import Service from '../models/Service.js';
import Utilisateur from '../models/Utilisateur.js';
import Structure from '../models/Structure.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer un service
export const createService = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, chefService, structure, nbPlaceStage } = req.body;
        // Vérifier unicité nomFr et nomEn
        const existsFr = await Service.exists({ nomFr });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('service_existante_fr', lang),
        });
        }
        const existsEn = await Service.exists({ nomEn });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('service_existante_en', lang),
        });
        }

        // Validation chefService et structure s'ils sont fournis
        if (chefService && !mongoose.Types.ObjectId.isValid(chefService._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
       

        if (structure && !mongoose.Types.ObjectId.isValid(structure._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        

        const service = await Service.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            chefService,
            structure,
            nbPlaceStage,
        });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: service,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Modifier un service
export const updateService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, chefService, structure, nbPlaceStage } = req.body;

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
        const service = await Service.findById(id);
        if (!service) {
        return res.status(404).json({
            success: false,
            message: t('service_non_trouve', lang),
        });
        }

        // Vérifier unicité nomFr et nomEn sauf pour ce service
        const existsFr = await Service.findOne({ nomFr, _id: { $ne: service._id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('service_existante_fr', lang),
        });
        }
        const existsEn = await Service.findOne({ nomEn, _id: { $ne: service._id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('service_existante_en', lang),
        });
        }

        if (chefService) {
            if (!mongoose.Types.ObjectId.isValid(chefService._id)) {
                return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
                });
            }
        
            service.chefService = chefService;
        }

        if (structure) {
            if (!mongoose.Types.ObjectId.isValid(structure._id)) {
                return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
                });
            }
            
            service.structure = structure;
        }

        if (nomFr) service.nomFr = nomFr;
        if (nomEn) service.nomEn = nomEn;
        if (descriptionFr !== undefined) service.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) service.descriptionEn = descriptionEn;
        if (nbPlaceStage !== undefined) service.nbPlaceStage = nbPlaceStage;

        await service.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: service,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Supprimer un service
export const deleteService = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const service = await Service.findById(id);
        if (!service) {
        return res.status(404).json({
            success: false,
            message: t('service_non_trouve', lang),
        });
        }

        await Service.deleteOne({ _id: id });

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

// Liste paginée des services
export const getServices = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Service.countDocuments();

        const services = await Service.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate([
            { path: 'chefService', select: 'nom', options: { strictPopulate: false }},
            { path: 'structure', select: 'nomFr nomEn', options: { strictPopulate: false }}
        ])
        .lean();

        return res.status(200).json({
        success: true,
        data: {
            services,
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

// Récupérer un service par id
export const getServiceById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const service = await Service.findById(id)
        .populate([
            { path: 'chefService', select: 'nom', options: { strictPopulate: false }},
            { path: 'structure', select: 'nomFr nomEn', options: { strictPopulate: false }}
        ])
        .lean();

        if (!service) {
        return res.status(404).json({
            success: false,
            message: t('service_non_trouve', lang),
        });
        }

        return res.status(200).json({
            success: true,
            data:{ 
                services:[service],
                totalItems:1,
                currentPage:1,
                totalPages: 1,
                pageSize:1
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

// Recherche par nomFr ou nomEn selon la langue
export const searchServicesByName = async (req, res) => {
    const { nom } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!nom) {
        return res.status(400).json({
        success: false,
        message: t('nom_requis', lang),
        });
    }

    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';

        const services = await Service.find({
        [queryField]: { $regex: nom, $options: 'i' },
        })
        .populate([
            { path: 'chefService', select: 'nom' },
            { path: 'structure', select: 'nomFr nomEn' }
        ])
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                services,
                totalItems:services.length,
                currentPage:1,
                totalPages: 1,
                pageSize:services.length
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

// Liste des services par structure
export const getServicesByStructure = async (req, res) => {
    const { structureId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(structureId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const total = await Service.countDocuments();
        
        const services = await Service.find({ structure: structureId })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate([
            { path: 'chefService', select: 'nom' },
            { path: 'structure', select: 'nomFr nomEn' }
        ])
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                services,
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
