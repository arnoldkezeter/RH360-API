import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { LieuFormation } from '../models/LieuFormation.js';

// Ajouter un lieu de formation
export const ajouterLieuFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;
  const { lieu, cohortes } = req.body;

  if (!lieu || !Array.isArray(cohortes) || cohortes.length === 0) {
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


    const nouveauLieu = new LieuFormation({
      lieu,
      cohortes,
      theme: themeId,
    });

    await nouveauLieu.save();

    const lieuFormationPopule = await LieuFormation.findById(nouveauLieu._id)
    .populate('cohortes')
    .lean(); 

    return res.status(201).json({
      success: true,
      message: t('ajouter_sucess', lang),
      data: lieuFormationPopule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Modifier un lieu de formation
export const modifierLieuFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { lieuId } = req.params;
  const { lieu, cohortes } = req.body;

  if (!lieu || !Array.isArray(cohortes) || cohortes.length === 0) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  if (!mongoose.Types.ObjectId.isValid(lieuId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const lieuFormation = await LieuFormation.findById(lieuId);
    if (!lieuFormation) {
      return res.status(404).json({
        success: false,
        message: t('lieu_non_trouve', lang),
      });
    }

    


    lieuFormation.lieu = lieu;
    lieuFormation.cohortes = cohortes;

    await lieuFormation.save();

    const lieuFormationPopule = await LieuFormation.findById(lieuFormation._id)
    .populate('cohortes')
    .lean(); 

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: lieuFormationPopule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Supprimer un lieu de formation
export const supprimerLieuFormation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { lieuId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(lieuId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const lieuFormation = await LieuFormation.findById(lieuId);
    if (!lieuFormation) {
      return res.status(404).json({
        success: false,
        message: t('lieu_non_trouve', lang),
      });
    }

    await lieuFormation.deleteOne();

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

// Lister les lieux de formation (avec pagination) pour un thème
export const getLieuxFormation = async (req, res) => {
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
        if (query && query.trim() !== '') {
            // Recherche par nom de lieu (insensible à la casse)
            const lieuxTrouves = await LieuFormation.find({
                theme: themeId,
                lieu: { $regex: new RegExp(query, 'i') }
            })
            .populate('cohortes')
            .lean();

            // Retourner le tableau, vide si pas de résultat
            return res.status(200).json({
                success: true,
                data: {
                lieuFormations: lieuxTrouves,
                totalItems: lieuxTrouves.length,
                currentPage: 1,
                totalPages: 1,
                pageSize: lieuxTrouves.length,
                },
            });
        } else {
        // Pas de recherche, retour paginé
            const total = await LieuFormation.countDocuments({ theme: themeId });

            const lieux = await LieuFormation.find({ theme: themeId })
                .populate({
                    path: 'cohortes',
                    select: 'nomFr nomEn participants',
                })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            return res.status(200).json({
                success: true,
                data: {
                    lieuFormations: lieux,
                    totalItems: total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    pageSize: limit,
                },
            });
        }
    } catch (error) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: error.message,
        });
    }
};


// Lister les lieux de formation pour un dropdown (sans pagination, juste _id et lieu)
export const getLieuxDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieux = await LieuFormation.find({ theme: themeId })
        .select('_id lieu')
        .lean();

        return res.status(200).json({
        success: true,
        data: {
                lieuFormations:lieux
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
