import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import Utilisateur from '../models/Utilisateur.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { Formateur } from '../models/Formateur.js';
import { addRoleToUser, removeRoleFromUserIfUnused } from '../utils/utilisateurRole.js';
import { generateRandomPassword } from '../utils/password.js';


// Ajouter un formateur
export const ajouterFormateur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { themeId } = req.params;
  const { utilisateurId, interne, nom, prenom, email, genre } = req.body;

  // Validation commune
  if (typeof interne !== 'boolean' || !themeId) {
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

  // Interne : utilisateurId obligatoire
  if (interne && (!utilisateurId || !mongoose.Types.ObjectId.isValid(utilisateurId))) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  // Externe sans utilisateurId : nom, prenom, email, genre obligatoires
  if (!interne && !utilisateurId && (!nom || !prenom || !email || !genre)) {
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
        message: t('ressource_non_trouvee', lang),
      });
    }

    let utilisateur;

    if (interne) {
      // ── Cas interne : utilisateur existant obligatoire ──────────────────
      utilisateur = await Utilisateur.findById(utilisateurId);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: t('ressource_non_trouvee', lang),
        });
      }

    } else if (utilisateurId && mongoose.Types.ObjectId.isValid(utilisateurId)) {
      // ── Cas externe : utilisateur existant sélectionné ──────────────────
      utilisateur = await Utilisateur.findById(utilisateurId);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: t('ressource_non_trouvee', lang),
        });
      }

    } else {
      // ── Cas externe : nouvel utilisateur à créer ─────────────────────────
      // Vérifier si l'email est déjà pris
      const emailExistant = await Utilisateur.findOne({ email });
      if (emailExistant) {
        return res.status(400).json({
          success: false,
          message: t('email_existant', lang),
        });
      }
      const password = generateRandomPassword();
      utilisateur = await Utilisateur.create({
        nom,
        prenom,
        email,
        genre,
        motDePasse:password,
        estExterneAutoCreated: true, 
        roles: [],
      });
    }

    // Vérifier doublon formateur
    const exist = await Formateur.findOne({ utilisateur: utilisateur._id, theme: themeId });
    if (exist) {
      return res.status(400).json({
        success: false,
        message: t('formateur_existant', lang),
      });
    }

    const nouveauFormateur = await Formateur.create({
      utilisateur: utilisateur._id,
      theme: themeId,
      interne,
    });

    await addRoleToUser(utilisateur._id, 'FORMATEUR');

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
    console.log(error)
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
  const { utilisateurId, interne, nom, prenom, email, genre } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(formateurId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  // Même règle de validation que pour l'ajout
  if (interne && (!utilisateurId || !mongoose.Types.ObjectId.isValid(utilisateurId))) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  if (!interne && !utilisateurId && (!nom || !prenom || !email || !genre)) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
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
    let utilisateur;

    if (interne) {
      // ── Cas interne ──────────────────────────────────────────────────────
      utilisateur = await Utilisateur.findById(utilisateurId);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: t('utilisateur_non_trouve', lang),
        });
      }

    } else if (utilisateurId && mongoose.Types.ObjectId.isValid(utilisateurId)) {
      // ── Cas externe : utilisateur existant sélectionné ──────────────────
      utilisateur = await Utilisateur.findById(utilisateurId);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: t('utilisateur_non_trouve', lang),
        });
      }

      // Mettre à jour ses infos si fournies
      if (nom || prenom || email || genre) {
        if (email && email !== utilisateur.email) {
          const emailExistant = await Utilisateur.findOne({ email, _id: { $ne: utilisateur._id } });
          if (emailExistant) {
            return res.status(400).json({
              success: false,
              message: t('email_existant', lang),
            });
          }
        }
        if (nom)    utilisateur.nom    = nom;
        if (prenom) utilisateur.prenom = prenom;
        if (email)  utilisateur.email  = email;
        if (genre)  utilisateur.genre  = genre;
        await utilisateur.save();
      }

    } else {
      // ── Cas externe : on réutilise l'ancien utilisateur auto-créé
      //    ou on en crée un nouveau ─────────────────────────────────────────
      const ancienUtilisateur = oldUserId
        ? await Utilisateur.findById(oldUserId)
        : null;

      if (ancienUtilisateur?.estExterneAutoCreated) {
        // Mettre à jour l'utilisateur auto-créé existant
        if (email && email !== ancienUtilisateur.email) {
          const emailExistant = await Utilisateur.findOne({
            email,
            _id: { $ne: ancienUtilisateur._id },
          });
          if (emailExistant) {
            return res.status(400).json({
              success: false,
              message: t('email_existant', lang),
            });
          }
        }
        if (nom)    ancienUtilisateur.nom    = nom;
        if (prenom) ancienUtilisateur.prenom = prenom;
        if (email)  ancienUtilisateur.email  = email;
        if (genre)  ancienUtilisateur.genre  = genre;
        await ancienUtilisateur.save();
        utilisateur = ancienUtilisateur;

      } else {
        // Créer un nouvel utilisateur externe
        const emailExistant = await Utilisateur.findOne({ email });
        if (emailExistant) {
          return res.status(400).json({
            success: false,
            message: t('email_existant', lang),
          });
        }
        utilisateur = await Utilisateur.create({
          nom,
          prenom,
          email,
          genre,
          estExterneAutoCreated: true,
          roles: [],
        });
      }
    }

    const newUserId = utilisateur._id.toString();
    const utilisateurAChange = newUserId !== oldUserId;

    formateur.utilisateur = utilisateur._id;
    if (typeof interne === 'boolean') formateur.interne = interne;
    await formateur.save();

    const formateurPopule = await Formateur.findById(formateur._id)
      .populate('utilisateur')
      .populate('theme')
      .lean();

    // Gestion des rôles si l'utilisateur a changé
    if (utilisateurAChange) {
      await addRoleToUser(newUserId, 'FORMATEUR');

      if (oldUserId) {
        await removeRoleFromUserIfUnused(oldUserId, 'FORMATEUR', Formateur);

        // ✅ Supprimer l'ancien utilisateur s'il était auto-créé et n'est plus utilisé
        const ancienUtilisateur = await Utilisateur.findById(oldUserId);
        if (ancienUtilisateur?.estExterneAutoCreated) {
          const encoreUtilise = await Formateur.findOne({ utilisateur: oldUserId });
          if (!encoreUtilise) {
            await ancienUtilisateur.deleteOne();
          }
        }
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

    if (oldUserId) {
      await removeRoleFromUserIfUnused(oldUserId, 'FORMATEUR', Formateur);

      // ✅ Supprimer l'utilisateur auto-créé s'il n'est plus utilisé ailleurs
      const utilisateur = await Utilisateur.findById(oldUserId);
      if (utilisateur?.estExterneAutoCreated) {
        const encoreUtilise = await Formateur.findOne({ utilisateur: oldUserId });
        if (!encoreUtilise) {
          await utilisateur.deleteOne();
        }
      }
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
