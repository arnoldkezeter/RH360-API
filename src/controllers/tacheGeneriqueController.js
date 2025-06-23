import { validationResult } from "express-validator";
import mongoose from "mongoose";
import { t } from "../utils/i18n.js";
import TacheGenerique from "../models/TacheGenerique.js";

// Ajouter une tâche générique
export const createTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t("champs_obligatoires", lang),
      errors: errors.array().map((err) => err.msg),
    });
  }

  try {
    const { nomFr, nomEn, descriptionFr, descriptionEn, methodeValidation } =
      req.body;

    // Vérification d'unicité
    const exists = await TacheGenerique.exists({ $or: [{ nomFr }, { nomEn }] });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: t("tache_generique_existante", lang),
      });
    }

    const tache = await TacheGenerique.create({
      nomFr,
      nomEn,
      descriptionFr,
      descriptionEn,
      methodeValidation,
    });

    return res.status(201).json({
      success: true,
      message: t("ajouter_succes", lang),
      data: tache,
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};

// Modifier une tâche générique
export const updateTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;
  const { nomFr, nomEn, descriptionFr, descriptionEn, methodeValidation } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t("champs_obligatoires", lang),
      errors: errors.array().map((err) => err.msg),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id);
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    const exists = await TacheGenerique.findOne({
      $or: [{ nomFr }, { nomEn }],
      _id: { $ne: id },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: t("tache_generique_existante", lang),
      });
    }

    if (nomFr) tache.nomFr = nomFr;
    if (nomEn) tache.nomEn = nomEn;
    if (descriptionFr !== undefined) tache.descriptionFr = descriptionFr;
    if (descriptionEn !== undefined) tache.descriptionEn = descriptionEn;
    if (methodeValidation) tache.methodeValidation = methodeValidation;

    await tache.save();

    return res.status(200).json({
      success: true,
      message: t("modifier_succes", lang),
      data: tache,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};

// Supprimer une tâche générique
export const deleteTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id);
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    await TacheGenerique.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: t("supprimer_succes", lang),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};

// Lister les tâches génériques avec pagination
export const getTachesGeneriques = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { nom } = req.query; // Chaine de recherche optionnelle
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortField = lang === "en" ? "nomEn" : "nomFr";

  try {
    let query = {};
    let total;

    // Si une chaîne de recherche est fournie
    if (nom) {
      query = { [sortField]: { $regex: new RegExp(nom, "i") } };
      total = await TacheGenerique.countDocuments(query);
    } else {
      // Si aucune chaîne de recherche, compte tous les éléments
      total = await TacheGenerique.countDocuments();
    }

    // Récupération des tâches avec pagination ou recherche
    const taches = await TacheGenerique.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        tacheGeneriques:taches,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Erreur getTachesGeneriques:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};


// Tâche générique par ID
export const getTacheGeneriqueById = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id).lean();
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    return res.status(200).json({
      success: true,
      data: tache,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};


// Charger les tâches pour les menus déroulants
export const getTachesGeneriquesForDropdown = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const sortField = lang === "en" ? "nomEn" : "nomFr";

  try {
    const taches = await TacheGenerique.find({}, "_id nomFr nomEn")
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({
      success: true,
       data: {
        tacheGeneriques:taches,
        totalItems: taches.length,
        currentPage: 1,
        totalPages: 1,
        pageSize: taches.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: error.message,
    });
  }
};
