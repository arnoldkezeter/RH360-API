import AxeStrategique from '../models/AxeStrategique.js';
import { validationResult} from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';



// Ajouter
export const createAxeStrategique = async (req, res) => {
    const lang = req.headers['accept-language']?.tolowercase() || 'fr';

    // Validation des champs obligatoires
    const errors = validationResult(req);
    console.log(errors)
    if (!errors.isEmpty()) {
        return res.status(400).json({
        success: false,
        message: t('champs_obligatoires', lang),
        errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

        // Vérifier l'unicité du nom
        const existsFr = await AxeStrategique.exists({ nomFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('axe_strategique_existante_fr', lang),
            });
        }

        const existsEn = await AxeStrategique.exists({ nomEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('axe_strategique_existante_en', lang),
            });
        }
        

        // Création de la axestrategique
        const axestrategique = await AxeStrategique.create({
            nomFr, 
            nomEn, 
            descriptionFr, 
            descriptionEn,
        });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: axestrategique,
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
export const updateAxeStrategique = async (req, res) => {
    const lang = req.headers['accept-language']?.tolowercase() || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

    // Vérification de la validité de l'identifiant
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    // Vérification des champs obligatoires
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({
        success: false,
        message: t('champs_obligatoires', lang),
        errors: errorMessages,
        });
    }

    try {
        const axestrategique = await AxeStrategique.findById(id);
        if (!axestrategique) {
        return res.status(404).json({
            success: false,
            message: t('axe_strategique_non_trouve', lang),
        });
        }

        // Vérifier l'unicité du nom
        const existsFr = await AxeStrategique.findOne({ nomFr, _id: { $ne: axestrategique._id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('axe_strategique_existante_fr', lang),
        });
        }

        const existsEn = await AxeStrategique.findOne({ nomEn, _id: { $ne: axestrategique._id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('axe_strategique_existante_en', lang),
        });
        }


        if (nomFr) axestrategique.nomFr = nomFr;
        if (nomEn) axestrategique.nomEn = nomEn;
        if (descriptionFr !== undefined) axestrategique.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) axestrategique.descriptionEn = descriptionEn;

        await axestrategique.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: axestrategique,
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
export const deleteAxeStrategique = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.tolowercase() || 'fr';

    // Vérification de la validité de l'identifiant
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const axestrategique = await AxeStrategique.findById(id);
        if (!axestrategique) {
        return res.status(404).json({
            success: false,
            message: t('axe_strategique_non_trouve', lang),
        });
        }

        await AxeStrategique.deleteOne({ _id: id });

        return res.status(200).json({
        success: true,
        message: t('supprimer_succes'),
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};


// Liste avec pagination
export const getAxesStrategique = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.tolowercase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        const total = await AxeStrategique.countDocuments();
    
        const axestrategiques = await AxeStrategique.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: axestrategiques,
            pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
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
  

//Strucuture par Id
export const getAxeStrategiqueById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase()?.tolowercase() || 'fr';
    const { id } = req.params;
    
  
    try {
        // Vérifie que l'ID est un ObjectId MongoDB valide
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
  
        const axestrategique = await AxeStrategique.findById(id)
            .lean();
    
        if (!axestrategique) {
            return res.status(404).json({
            success: false,
            message: t('axe_strategique_non_trouvee', lang),
            });
        }
    
        return res.status(200).json({
            success: true,
            data: axestrategique,
        });
    
    } catch (error) {
        console.error('Erreur getAxeStrategiqueById:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: error.message,
        });
    }
};


//Recherher par nom
export const searchAxeStrategiqueByName = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { nom } = req.query;
  
    if (!nom) {
      return res.status(400).json({
        success: false,
        message: t('nom_requis', lang), // Assure-toi que cette clé existe bien dans les traductions
      });
    }
  
    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';
    
        const axestrategiques = await AxeStrategique.find({
            [queryField]: { $regex: new RegExp(nom, 'i') }, // Recherche insensible à la casse
        })
            .sort({ [queryField]: 1 }) // Tri alphabétique par langue
            .lean();
    
        return res.status(200).json({
            success: true,
            data: axestrategiques,
        });
    } catch (error) {
        console.error('Erreur recherche axe strategique par nom:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
  };


//Charger pour les menu deroulant
export const getAxesStrategiqueForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
      const axestrategiques = await AxeStrategique.find({}, '_id nomFr nomEn')
        .sort({ [sortField]: 1 })
        .lean();
  
      return res.status(200).json({
        success: true,
        data: axestrategiques,
      });
    } catch (err) {
      console.error('Erreur getAxesStrategiqueForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};


  
  

