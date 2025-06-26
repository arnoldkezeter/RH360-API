import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import { Objectif } from '../models/Objectif.js';
import ThemeFormation from '../models/ThemeFormation.js';

// Ajouter un objectif
export const ajouterObjectif = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const {themeId} = req.params;
  const { nomFr, nomEn } = req.body;
  
  if (!nomFr || !nomEn || !themeId) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const theme = await ThemeFormation.findById(themeId);
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: t('theme_non_trouve', lang),
      });
    }

    const nouvelObjectif = await Objectif.create({ nomFr, nomEn, theme: themeId });

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: nouvelObjectif,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Modifier un objectif
export const modifierObjectif = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId, objectifId } = req.params;
  const { nomFr, nomEn } = req.body;
  if (!mongoose.Types.ObjectId.isValid(objectifId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  if (!nomFr || !nomEn || !themeId) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  try {

    const theme = await ThemeFormation.findById(themeId);
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: t('theme_non_trouve', lang),
      });
    }

    const objectif = await Objectif.findById(objectifId);
    if (!objectif) {
      return res.status(404).json({
        success: false,
        message: t('ressource_non_trouvee', lang),
      });
    }

    objectif.nomFr = nomFr;
    objectif.nomEn = nomEn;
    objectif.theme = themeId;

    await objectif.save();

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: objectif,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Supprimer un objectif
export const supprimerObjectif = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { objectifId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(objectifId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const objectif = await Objectif.findById(objectifId);
    if (!objectif) {
      return res.status(404).json({
        success: false,
        message: t('ressource_non_trouvee', lang),
      });
    }

    await objectif.deleteOne();

    return res.status(200).json({
      success: true,
      message: t('supprimer_succes', lang),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Lister les objectifs pour un thème (pagination + recherche)
export const getObjectifsByTheme = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;
  const { query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const filter = { theme: themeId };

    if (query && query.trim() !== '') {
      filter.$or = [
        { nomFr: { $regex: new RegExp(query, 'i') } },
        { nomEn: { $regex: new RegExp(query, 'i') } },
      ];
    }

    const total = await Objectif.countDocuments(filter);
    const objectifs = await Objectif.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        objectifThemes : objectifs,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
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

// Dropdown (id et noms)
export const getObjectifsDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const objectifs = await Objectif.find({ theme: themeId }).select('_id nomFr nomEn').lean();

    return res.status(200).json({
      success: true,
      data: objectifs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};
