import FamilleMetier from '../models/FamilleMetier.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Ajouter
export const createFamilleMetier = async (req, res) => {
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
    const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

    const existsFr = await FamilleMetier.exists({ nomFr });
    if (existsFr) {
      return res.status(409).json({
        success: false,
        message: t('famille_metier_existante_fr', lang),
      });
    }

    const existsEn = await FamilleMetier.exists({ nomEn });
    if (existsEn) {
      return res.status(409).json({
        success: false,
        message: t('famille_metier_existante_en', lang),
      });
    }

    const famille = await FamilleMetier.create({
      nomFr,
      nomEn,
      descriptionFr,
      descriptionEn,
    });

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: famille,
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
export const updateFamilleMetier = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { id } = req.params;
  const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

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
    const famille = await FamilleMetier.findById(id);
    if (!famille) {
      return res.status(404).json({
        success: false,
        message: t('famille_metier_non_trouvee', lang),
      });
    }

    const existsFr = await FamilleMetier.findOne({ nomFr, _id: { $ne: id } });
    if (existsFr) {
      return res.status(409).json({
        success: false,
        message: t('famille_metier_existante_fr', lang),
      });
    }

    const existsEn = await FamilleMetier.findOne({ nomEn, _id: { $ne: id } });
    if (existsEn) {
      return res.status(409).json({
        success: false,
        message: t('famille_metier_existante_en', lang),
      });
    }

    famille.nomFr = nomFr;
    famille.nomEn = nomEn;
    famille.descriptionFr = descriptionFr;
    famille.descriptionEn = descriptionEn;
    await famille.save();

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: famille,
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
export const deleteFamilleMetier = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const famille = await FamilleMetier.findById(id);
    if (!famille) {
      return res.status(404).json({
        success: false,
        message: t('famille_metier_non_trouvee', lang),
      });
    }

    await FamilleMetier.deleteOne({ _id: id });

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

// Liste paginée
export const getFamillesMetier = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const lang = req.headers['accept-language'] || 'fr';
  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

  try {
    const total = await FamilleMetier.countDocuments();
    const familles = await FamilleMetier.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        familles,
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

// Par ID
export const getFamilleMetierById = async (req, res) => {
  const { id } = req.params;
  const lang = req.headers['accept-language'] || 'fr';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const famille = await FamilleMetier.findById(id).lean();
    if (!famille) {
      return res.status(404).json({
        success: false,
        message: t('famille_metier_non_trouvee', lang),
      });
    }

    return res.status(200).json({
      success: true,
      data: famille,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_interne', lang),
      error: error.message,
    });
  }
};

// Dropdown
export const getFamillesMetierForDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

  try {
    const familles = await FamilleMetier.find({}, '_id nomFr nomEn')
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        familles,
        totalItems:familles.length,
        currentPage:1,
        totalPages: 1,
        pageSize:familles.length 
      
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

// Recherche
export const searchFamilleMetierByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
          success: false,
          message: t('nom_requis', lang),
        });
    }

    try {
        const field = lang === 'en' ? 'nomEn' : 'nomFr';
        const familles = await FamilleMetier.find({
          [field]: { $regex: new RegExp(nom, 'i') },
        })
          .sort({ [field]: 1 })
          .lean();

        return res.status(200).json({
          success: true,
          data: {
            familles,
            totalItems:familles.length,
            currentPage:1,
            totalPages: 1,
            pageSize:familles.length 
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
