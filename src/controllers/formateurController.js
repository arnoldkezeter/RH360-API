import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import Utilisateur from '../models/Utilisateur.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { Formateur } from '../models/Formateur.js';
import { addRoleToUser, removeRoleFromUserIfUnused } from '../utils/utilisateurRole.js';


// Ajouter un formateur
export const ajouterFormateur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const{themeId} = req.params;
  const { utilisateurId, interne } = req.body;
  
  if (!utilisateurId || !themeId || typeof interne !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(utilisateurId) ||
    !mongoose.Types.ObjectId.isValid(themeId)
  ) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const utilisateur = await Utilisateur.findById(utilisateurId);
    const theme = await ThemeFormation.findById(themeId);

    if (!utilisateur || !theme) {
      return res.status(404).json({
        success: false,
        message: t('ressource_non_trouvee', lang),
      });
    }

    const exist = await Formateur.findOne({ utilisateur: utilisateurId, theme: themeId });
    if (exist) {
      return res.status(400).json({
        success: false,
        message: t('formateur_existant', lang),
      });
    }

    const nouveauFormateur = await Formateur.create({ utilisateur: utilisateurId, theme: themeId, interne });
    await addRoleToUser(utilisateurId, 'FORMATEUR');
    const formateurPopule = await Formateur.findById(nouveauFormateur._id)
      .populate('utilisateur')
      .populate('theme')
      .lean();

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: formateurPopule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Modifier un formateur
export const modifierFormateur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formateurId } = req.params;
  const { utilisateurId, interne } = req.body;
  if (!mongoose.Types.ObjectId.isValid(formateurId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const formateur = await Formateur.findById(formateurId);
    if (!formateur) {
      return res.status(404).json({
        success: false,
        message: t('formateur_non_trouvee', lang),
      });
    }

    const utilisateur = await Utilisateur.findById(utilisateurId);
    if (!utilisateur) {
      return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang),
      });
    }
    const oldUserId = formateur.utilisateur?.toString();
    if (typeof interne === 'boolean') formateur.interne = interne;
    formateur.utilisateur = utilisateurId

    await formateur.save();

    const formateurPopule = await Formateur.findById(formateur._id)
      .populate('utilisateur')
      .populate('theme')
      .lean();

    // ✅ Nouveau formateur → rôle ajouté
    if (utilisateurId && utilisateurId.toString() !== oldUserId) {
      await addRoleToUser(utilisateurId, 'FORMATEUR');

      // Ancien formateur → retirer le rôle si plus utilisé
      if (oldUserId) {
        await removeRoleFromUserIfUnused(oldUserId, 'FORMATEUR', Formateur);
      }
    }

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: formateurPopule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Supprimer un formateur
export const supprimerFormateur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { formateurId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(formateurId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const formateur = await Formateur.findById(formateurId);
    if (!formateur) {
      return res.status(404).json({
        success: false,
        message: t('formateur_non_trouvee', lang),
      });
    }
    const oldUserId = formateur.utilisateur?.toString();
    await formateur.deleteOne();
    // ✅ Nouveau formateur → rôle ajouté
    if (oldUserId) {
      await removeRoleFromUserIfUnused(oldUserId, 'FORMATEUR', Formateur);
    }
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

// Lister les formateurs d’un thème (avec pagination + recherche utilisateur)
export const getFormateursByTheme = async (req, res) => {
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
      const utilisateurs = await Utilisateur.find({
        $or: [
          { nom: { $regex: new RegExp(query, 'i') } },
          { prenom: { $regex: new RegExp(query, 'i') } },
          { email: { $regex: new RegExp(query, 'i') } },
        ],
      }).select('_id');

      filter.utilisateur = { $in: utilisateurs.map((u) => u._id) };
    }

    const total = await Formateur.countDocuments(filter);

    const formateurs = await Formateur.find(filter)
      .populate('utilisateur')
      .populate('theme')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        formateurs,
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

// Dropdown : liste des formateurs pour un thème
export const getFormateursDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const formateurs = await Formateur.find({ theme: themeId })
      .populate('utilisateur', 'nom prenom email')
      .lean();

    return res.status(200).json({
      success: true,
      data: formateurs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};
