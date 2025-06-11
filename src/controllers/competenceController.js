import Competence from '../models/Competence.js';
import FamilleMetier from '../models/FamilleMetier.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

// Ajouter une compétence
export const createCompetence = async (req, res) => {
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
    const { code, nomFr, nomEn, descriptionFr, descriptionEn, familleMetier } = req.body;

    const existsFr = await Competence.exists({ nomFr });
    if (existsFr) {
      return res.status(409).json({ success: false, message: t('competence_existante_fr', lang) });
    }

    const existsEn = await Competence.exists({ nomEn });
    if (existsEn) {
      return res.status(409).json({ success: false, message: t('competence_existante_en', lang) });
    }

    if (!mongoose.Types.ObjectId.isValid(familleMetier._id)) {
      return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const competence = await Competence.create({
      code,
      nomFr,
      nomEn,
      descriptionFr,
      descriptionEn,
      familleMetier
    });

    res.status(201).json({ success: true, message: t('ajouter_succes', lang), data: competence });
  } catch (err) {
    res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// Modifier une compétence
export const updateCompetence = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { id } = req.params;

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
    const competence = await Competence.findById(id);
    if (!competence) {
      return res.status(404).json({ success: false, message: t('competence_non_trouvee', lang) });
    }

    const { code, nomFr, nomEn, descriptionFr, descriptionEn, familleMetier } = req.body;

    const existsFr = await Competence.findOne({ nomFr, _id: { $ne: id } });
    if (existsFr) {
      return res.status(409).json({ success: false, message: t('competence_existante_fr', lang) });
    }

    const existsEn = await Competence.findOne({ nomEn, _id: { $ne: id } });
    if (existsEn) {
      return res.status(409).json({ success: false, message: t('competence_existante_en', lang) });
    }

    if (familleMetier) {
      if (!mongoose.Types.ObjectId.isValid(familleMetier._id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
      }


      competence.familleMetier = familleMetier;
    }

    competence.code = code;
    competence.nomFr = nomFr;
    competence.nomEn = nomEn;
    competence.descriptionFr = descriptionFr;
    competence.descriptionEn = descriptionEn;

    await competence.save();

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: competence,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};

// Supprimer une compétence
export const deleteCompetence = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const competence = await Competence.findById(id);
    if (!competence) {
      return res.status(404).json({ success: false, message: t('competence_non_trouvee', lang) });
    }

    await Competence.deleteOne({ _id: id });

    return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// Liste paginée
export const getCompetences = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const lang = req.headers['accept-language'] || 'fr';
  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

  try {
    const total = await Competence.countDocuments();
    const competences = await Competence.find()
      .populate('familleMetier', 'nomFr nomEn')
      .sort({ [sortField]: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        competences,
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

// Par ID
export const getCompetenceById = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
  }

  try {
    const competence = await Competence.findById(id)
      .populate('familleMetier', 'nomFr nomEn')
      .lean();

    if (!competence) {
      return res.status(404).json({ success: false, message: t('competence_non_trouvee', lang) });
    }

    return res.status(200).json({ success: true, data: competence });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// Dropdown
export const getCompetencesForDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

  try {
    const competences = await Competence.find({}, '_id nomFr nomEn')
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({ 
      success: true, 
      data: {
        competences,
        totalItems:competences.length,
        currentPage:1,
        totalPages: 1,
        pageSize:competences.length 
      } 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
  }
};

// Rechercher des compétences par nom
export const searchCompetenceByName = async (req, res) => {
    const { nom } = req.query;
    const lang = req.headers['accept-language'] || 'fr';
    const searchField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    if (!nom || nom.trim() === '') {
        return res.status(400).json({
            success: false,
            message: t('nom_requis', lang)
        });
    }
  
    try {
        const regex = new RegExp(nom, 'i'); // insensible à la casse
    
        const results = await Competence.find({ [searchField]: { $regex: regex } })
            .select('nomFr nomEn code').populate('familleMetier', 'nomFr nomEn')
            .limit(10)
            .lean();
    
        res.status(200).json({ 
          success: true,
          data: {
            competences:results,
            totalItems:results.length,
            currentPage:1,
            totalPages:1,
            pageSize:results.length 
          } 
        });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message
      });
    }
};


// Liste des départements par région
export const getCompetenceByFamille = async (req, res) => {
    const { familleId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(familleId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const famille = await FamilleMetier.findById(familleId);
        if (!famille) {
            return res.status(404).json({ success: false, message: t('famille_metier_non_trouvee', lang) });
        }

        const total = await Competence.countDocuments();

        const competences = await Competence.find({ familleMetier: familleId })
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

        return res.status(200).json({ 
            success: true, 
            data: {
                competences,
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
  
