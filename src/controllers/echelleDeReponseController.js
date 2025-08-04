import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import TypeEchelleReponse from '../models/TypeEchelleDeReponse.js';
import EchelleReponse from '../models/EchelleDeReponse.js';

// Ajouter un echelleReponse
export const ajouterEchelleReponse = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const {typeId} = req.params;
  const { nomFr, nomEn, ordre } = req.body;
  
  if (!nomFr || !nomEn || !typeId || !ordre) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  if (!mongoose.Types.ObjectId.isValid(typeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const type = await TypeEchelleReponse.findById(typeId);
    if (!type) {
      return res.status(404).json({
        success: false,
        message: t('echelle_non_trouvee', lang),
      });
    }

    const nouvelEchelleReponse = await EchelleReponse.create({ nomFr, nomEn, ordre, typeEchelle: typeId });

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: nouvelEchelleReponse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Modifier un echelleReponse
export const modifierEchelleReponse = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { typeId, echelleReponseId } = req.params;
  const { nomFr, nomEn, ordre } = req.body;
  if (!mongoose.Types.ObjectId.isValid(echelleReponseId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  if (!nomFr || !nomEn || !typeId || !ordre) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
    });
  }

  try {

    const typeEchelle = await TypeEchelleReponse.findById(typeId);
    if (!typeEchelle) {
      return res.status(404).json({
        success: false,
        message: t('echelle_non_trouvee', lang),
      });
    }

    const echelleReponse = await EchelleReponse.findById(echelleReponseId);
    if (!echelleReponse) {
      return res.status(404).json({
        success: false,
        message: t('ressource_non_trouvee', lang),
      });
    }

    echelleReponse.nomFr = nomFr;
    echelleReponse.nomEn = nomEn;
    echelleReponse.ordre = ordre;
    echelleReponse.typeEchelle = typeId;

    await echelleReponse.save();

    return res.status(200).json({
      success: true,
      message: t('modifier_succes', lang),
      data: echelleReponse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Supprimer un echelleReponse
export const supprimerEchelleReponse = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { echelleReponseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(echelleReponseId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const echelleReponse = await EchelleReponse.findById(echelleReponseId);
    if (!echelleReponse) {
      return res.status(404).json({
        success: false,
        message: t('echelle_non_trouvee', lang),
      });
    }

    await echelleReponse.deleteOne();

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

// Lister les echelleReponses pour un thème (pagination + recherche)
export const getEchelleReponsesByType = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { typeId } = req.params;
  const { query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!mongoose.Types.ObjectId.isValid(typeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const filter = { typeEchelle: typeId };

    if (query && query.trim() !== '') {
      filter.$or = [
        { nomFr: { $regex: new RegExp(query, 'i') } },
        { nomEn: { $regex: new RegExp(query, 'i') } },
      ];
    }

    const total = await EchelleReponse.countDocuments(filter);
    const echelleReponses = await EchelleReponse.find(filter)
      .skip((page - 1) * limit)
      .sort({["ordre"]:1})
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        echelleReponses : echelleReponses,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
      },
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

// Dropdown (id et noms)
export const getEchelleReponsesDropdown = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { typeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(typeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    const echelleReponses = await EchelleReponse.find({ typeEchelle: typeId }).select('_id nomFr nomEn').lean();

    return res.status(200).json({
      success: true,
      data: echelleReponses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};


export const getGroupedEchelleReponsesByType = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    // Récupérer toutes les échelles avec leur type
    const echelles = await EchelleReponse.find()
      .populate('typeEchelle', 'nomFr nomEn')
      .sort({["ordre"]:1})
      .lean();

    // Regrouper les échelles par type
    const grouped = {};
    for (const echelle of echelles) {
      const type = echelle.typeEchelle;
      if (!type) continue; // sécurité si typeEchelle absent

      const idType = type._id.toString();
      const nomType = lang === 'en' ? type.nomEn : type.nomFr;

      if (!grouped[idType]) {
        grouped[idType] = {
          idType,
          nomType,
          echelles: [],
        };
      }

      grouped[idType].echelles.push({
        idEchelle: echelle._id,
        nomEchelle: lang === 'en' ? echelle.nomEn : echelle.nomFr,
        ordre:echelle.ordre
      });
    }

    // Convertir en tableau
    const groupedArray = Object.values(grouped).sort((a, b) =>
      a.nomType.localeCompare(b.nomType)
    );

    return res.status(200).json({
      success: true,
      data: groupedArray,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

