import Departement from '../models/Departement.js';
import Region from '../models/Region.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer un département
export const createDepartement = async (req, res) => {
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
        const { code, nomFr, nomEn, region } = req.body;

        // Vérifier existence région
        if (!mongoose.Types.ObjectId.isValid(region._id)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        // const regionExists = await Region.findById(region);
        // if (!regionExists) {
        //     return res.status(404).json({ success: false, message: t('region_non_trouvee', lang) });
        // }

        // Optionnel: vérifier unicité du code (si code fourni)
        if (code) {
            const codeExists = await Departement.findOne({ code });
            if (codeExists) {
                return res.status(409).json({ success: false, message: t('departement_code_existante', lang) });
            }
        }

        // Vérifier unicité nomFr et nomEn dans la même région
        const nomFrExists = await Departement.findOne({ nomFr, region:region._id });
        if (nomFrExists) {
        return res.status(409).json({ success: false, message: t('departement_nom_fr_existante', lang) });
        }
        const nomEnExists = await Departement.findOne({ nomEn, region:region._id });
        if (nomEnExists) {
        return res.status(409).json({ success: false, message: t('departement_nom_en_existante', lang) });
        }

        const departement = await Departement.create({ code, nomFr, nomEn, region:region._id });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: departement,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier un département
export const updateDepartement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { code, nomFr, nomEn, region } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
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
        const departement = await Departement.findById(id);
        if (!departement) {
        return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }

        // Si région modifiée, vérifier validité
        if (region) {
            if (!mongoose.Types.ObjectId.isValid(region._id)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
           
            departement.region = region;
        }

        // Vérifier unicité code (sauf si modif du même enregistrement)
        if (code) {
            const codeExists = await Departement.findOne({ code, _id: { $ne: id } });
            if (codeExists) {
                return res.status(409).json({ success: false, message: t('departement_code_existante', lang) });
            }
            departement.code = code;
        }else{
            departement.code = code;
        }

        // Vérifier unicité nomFr dans la région
        if (nomFr) {
            const nomFrExists = await Departement.findOne({ nomFr, region: departement.region, _id: { $ne: id } });
            if (nomFrExists) {
                return res.status(409).json({ success: false, message: t('departement_nom_fr_existante', lang) });
            }
            departement.nomFr = nomFr;
        }

        // Vérifier unicité nomEn dans la région
        if (nomEn) {
            const nomEnExists = await Departement.findOne({ nomEn, region: departement.region, _id: { $ne: id } });
            if (nomEnExists) {
                return res.status(409).json({ success: false, message: t('departement_nom_en_existante', lang) });
            }
            departement.nomEn = nomEn;
        }

        await departement.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: departement,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer un département
export const deleteDepartement = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const departement = await Departement.findById(id);
        if (!departement) {
        return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }

        await Departement.deleteOne({ _id: id });

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée des départements
export const getDepartements = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Departement.countDocuments();

        const departements = await Departement.find()
        .populate({
            path: 'region',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                departements,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit 
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Récupérer un département par id
export const getDepartementById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const departement = await Departement.findById(id)
        .populate({
            path: 'region',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        if (!departement) {
            return res.status(404).json({ success: false, message: t('departement_non_trouve', lang) });
        }

        return res.status(200).json({ success: true, data: departement });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nomFr, nomEn ou code
export const searchDepartementsByNameOrCode = async (req, res) => {
    const { term } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!term) {
        return res.status(400).json({ success: false, message: t('terme_requis', lang) });
    }

    try {
        const regex = new RegExp(term, 'i');
        const results = await Departement.find({
        $or: [
            { nomFr: regex },
            { nomEn: regex },
            { code: regex }
        ]
        }).populate({
            path: 'region',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({ 
            success: true, 
            data: {
                departements:results,
                totalItems:results.length,
                currentPage:1,
                totalPages:1,
                pageSize:results.length 

            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste des départements par région
export const getDepartementsByRegion = async (req, res) => {
    const { regionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(regionId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const region = await Region.findById(regionId);
        if (!region) {
            return res.status(404).json({ success: false, message: t('region_non_trouvee', lang) });
        }

        const total = await Departement.countDocuments({ region: regionId });
        const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
        const departements = await Departement.find({ region: regionId })
        .populate({
            path: 'region',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({[sortField]:1})
        .lean();
        

        return res.status(200).json({ 
            success: true, 
            data: {
                departements,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit 
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getDepartementsForDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  const { regionId } = req.params;

  try {
    const departements = await Departement.find({ region: regionId }, '_id nomFr nomEn region')
        .populate({
            path: 'region',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .sort({ [sortField]: 1 })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        departements,
        totalItems:departements.length,
        currentPage:1,
        totalPages: 1,
        pageSize:departements.length 
      
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

//Liste des départements par région pour le dropdown
export const getDepatementsForDropdownByRegion = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {regionId} = req.params;
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        if (!mongoose.Types.ObjectId.isValid(regionId)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
        const depatements = await Depatement.find({region:regionId}, "_id nomFr nomEn")
            .populate([
                { path: 'region', select: 'nomFr nomEn',  options:{strictPopulate:false}}
            ])
            .sort({ [sortField]: 1 })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                depatements,
                totalItems:depatements.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:depatements.lenght
            },
        });
    } catch (err) {
      console.error('Erreur getDepatementsForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};
