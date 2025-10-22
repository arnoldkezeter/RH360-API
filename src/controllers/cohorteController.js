// controllers/cohorteController.js

import Cohorte from '../models/Cohorte.js';
import Utilisateur from '../models/Utilisateur.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';

// Créer une cohorte
export const createCohorte = async (req, res) => {
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

        const existsFr = await Cohorte.exists({ nomFr });
        if (existsFr) {
        return res.status(409).json({ success: false, message: t('cohorte_existante_fr', lang) });
        }
        const existsEn = await Cohorte.exists({ nomEn });
        if (existsEn) {
        return res.status(409).json({ success: false, message: t('cohorte_existante_en', lang) });
        }

        const cohorte = await Cohorte.create({ nomFr, nomEn, descriptionFr, descriptionEn });
        return res.status(201).json({ success: true, message: t('ajouter_succes', lang), data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une cohorte
export const updateCohorte = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: t('champs_obligatoires', lang), errors: errors.array().map(err => err.msg) });
    }

    try {
        const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;
        const cohorte = await Cohorte.findById(id);
        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        const existsFr = await Cohorte.findOne({ nomFr, _id: { $ne: id } });
        if (existsFr) return res.status(409).json({ success: false, message: t('cohorte_existante_fr', lang) });
        const existsEn = await Cohorte.findOne({ nomEn, _id: { $ne: id } });
        if (existsEn) return res.status(409).json({ success: false, message: t('cohorte_existante_en', lang) });

        cohorte.nomFr = nomFr;
        cohorte.nomEn = nomEn;
        cohorte.descriptionFr = descriptionFr;
        cohorte.descriptionEn = descriptionEn;

        await cohorte.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Supprimer une cohorte
export const deleteCohorte = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const cohorte = await Cohorte.findById(id);
        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        await Cohorte.deleteOne({ _id: id });
        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée
export const getCohortes = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Cohorte.countDocuments();
        const cohortes = await Cohorte.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                cohortes,
                totalItems:total, 
                currentPage:page, 
                totalpages: Math.ceil(total / limit), 
                pageSize:limit
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Obtenir par ID
export const getCohorteById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const cohorte = await Cohorte.findById(id)
        .lean();

        if (!cohorte) return res.status(404).json({ success: false, message: t('cohorte_non_trouvee', lang) });

        return res.status(200).json({ success: true, data: cohorte });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Pour dropdown
export const getCohortesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const cohortes = await Cohorte.find({}, '_id nomFr nomEn').sort({ [sortField]: 1 }).lean();
        return res.status(200).json({ 
            success: true, 
            data: {
                cohortes, 
                totalItems:cohortes.length, 
                currentPage:1, 
                totalpages: 1, 
                pageSize:cohortes.length
            }
        
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nom
export const searchCohorteByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({ success: false, message: t('nom_requis', lang) });
    }

    try {
        const field = lang === 'en' ? 'nomEn' : 'nomFr';
        const cohortes = await Cohorte.find({ [field]: { $regex: nom, $options: 'i' } })
        .sort({ [field]: 1 })
        .lean();

        return res.status(200).json({ 
            success: true, 
            data: {
                cohortes, 
                totalItems:cohortes.length, 
                currentPage:1, 
                totalpages: 1, 
                pageSize:cohortes.length
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};



export const addUserToCohorte = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { utilisateurId, cohorteId } = req.body;

  if (!utilisateurId) {
    return res.status(400).json({
      success: false,
      message: t('aucun_utilisateur_fourni', lang),
    });
  }

  if (!mongoose.Types.ObjectId.isValid(cohorteId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  if (!mongoose.Types.ObjectId.isValid(utilisateurId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    // Vérifier si l'utilisateur est déjà lié à cette cohorte
    const existant = await CohorteUtilisateur.findOne({
      utilisateur: utilisateurId,
      cohorte: cohorteId,
    });

    if (existant) {
      return res.status(409).json({
        success: false,
        message: t('utilisateur_deja_dans_cohorte', lang),
        result: {
          added: false,
          alreadyExists: true,
        },
      });
    }

    // Créer la relation CohorteUtilisateur
    const nouvelleRelation = await CohorteUtilisateur.create({
      utilisateur: utilisateurId,
      cohorte: cohorteId,
    });

    // Ajouter l'utilisateur aux participants de la cohorte
    await Cohorte.findByIdAndUpdate(cohorteId, {
      $addToSet: { participants: utilisateurId },
    });

    // Peupler les informations de la cohorte et de l'utilisateur
    const relationPeuplee = await CohorteUtilisateur.findById(nouvelleRelation._id)
      .populate('utilisateur', 'nom prenom email')

    return res.status(200).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: relationPeuplee,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};



export const removeUserFromCohorte = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { cohorteUtilisateurId } = req.params;
 

  if (!mongoose.Types.ObjectId.isValid(cohorteUtilisateurId)) {
    return res.status(400).json({ 
      success: false, 
      message: t('identifiant_invalide', lang) 
    });
  }


  try {
  
    const cohorteUtilisateur = await CohorteUtilisateur.findByIdAndDelete(cohorteUtilisateurId);
    
    if (!cohorteUtilisateur) {
        return res.status(404).json({
            success: false,
            message: t('cohorte_non_trouvee', lang),
        });
    }

    const cohorteId = cohorteUtilisateur.cohorte
    const utilisateurId = cohorteUtilisateur.utilisateur
    // Retirer l'utilisateur des participants de la cohorte
    await Cohorte.findByIdAndUpdate(
      cohorteId,
      { $pull: { participants: utilisateurId } }
    );

    return res.status(200).json({
      success: true,
      message: t('supprimer_succes', lang),
      result: {
        removed: true,
        utilisateurId: utilisateurId
      }
    });

  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message
    });
  }
};


// Lister les utilisateurs d'une cohorte
export const getUsersByCohorte = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { cohorteId } = req.params;
    const page = parseInt(req.query.page) || 1;       
    const limit = parseInt(req.query.limit) || 10;    
    const skip = (page - 1) * limit;
    const search = req.query.search || ''; // Chaîne de recherche optionnelle

    if (!mongoose.Types.ObjectId.isValid(cohorteId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Construire le filtre de recherche
        const filter = { cohorte: cohorteId };
        if (search.trim() !== '') {
            filter.$or = [
                { 'utilisateur.nom': { $regex: search, $options: 'i' } },
                { 'utilisateur.prenom': { $regex: search, $options: 'i' } }
            ];
        }

        // Compter le nombre total d’utilisateurs correspondant au filtre
        const total = await CohorteUtilisateur.countDocuments(filter).populate({
            path: 'utilisateur',
            match: search.trim() !== '' ? {
                $or: [
                    { nom: { $regex: search, $options: 'i' } },
                    { prenom: { $regex: search, $options: 'i' } }
                ]
            } : {}
        });

        // Récupérer les utilisateurs avec pagination
        const utilisateurs = await CohorteUtilisateur.find({ cohorte: cohorteId })
            .populate({
                path: 'utilisateur',
                select: 'nom prenom email',
                match: search.trim() !== '' ? {
                    $or: [
                        { nom: { $regex: search, $options: 'i' } },
                        { prenom: { $regex: search, $options: 'i' } }
                    ]
                } : {}
            })
            .skip(skip)
            .limit(limit)
            .lean();

        // Filtrer les entrées dont utilisateur est null (si search ne correspond à rien)
        const filteredUsers = utilisateurs.filter(u => u.utilisateur);

        return res.status(200).json({
            success: true,
            data: {
                participants: filteredUsers,
                totalItems: total,
                currentPage: page,
                pageSize: limit,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Lister les cohortes d'un utilisateur
export const getCohortesByUser = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { utilisateurId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(utilisateurId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

  

    try {
        const cohortes = await CohorteUtilisateur.find({ utilisateur: utilisateurId })
        .populate('cohorte');
        res.status(200).json(cohortes);
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

