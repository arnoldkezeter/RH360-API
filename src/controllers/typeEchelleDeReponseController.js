import TypeEchelleReponse from '../models/TypeEchelleDeReponse.js';
import { validationResult} from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';



// Ajouter
export const createTypeEchelleReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

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
        const existsFr = await TypeEchelleReponse.exists({ nomFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('type_echelle_existante_fr', lang),
            });
        }

        const existsEn = await TypeEchelleReponse.exists({ nomEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('type_echelle_existante_en', lang),
            });
        }
        

        // Création de la TypeEchelleReponse
        const typeEchelleReponse = await TypeEchelleReponse.create({
            nomFr, 
            nomEn, 
            descriptionFr, 
            descriptionEn 
        });

        return res.status(201).json({
          success: true,
          message: t('ajouter_succes', lang),
          data: typeEchelleReponse,
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
export const updateTypeEchelleReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
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
        const typeEchelleReponse = await TypeEchelleReponse.findById(id);
        if (!typeEchelleReponse) {
        return res.status(404).json({
            success: false,
            message: t('type_echelle_non_trouve', lang),
        });
        }

        // Vérifier l'unicité du nom
        const existsFr = await TypeEchelleReponse.findOne({ nomFr, _id: { $ne: TypeEchelleReponse._id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('type_echelle_existante_fr', lang),
        });
        }

        const existsEn = await TypeEchelleReponse.findOne({ nomEn, _id: { $ne: TypeEchelleReponse._id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('type_echelle_existante_en', lang),
        });
        }


        if (nomFr) typeEchelleReponse.nomFr = nomFr;
        if (nomEn) typeEchelleReponse.nomEn = nomEn;
        if (descriptionFr !== undefined) typeEchelleReponse.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) typeEchelleReponse.descriptionEn = descriptionEn;

        await typeEchelleReponse.save();

        return res.status(200).json({
          success: true,
          message: t('modifier_succes', lang),
          data: typeEchelleReponse,
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
export const deleteTypeEchelleReponse = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    // Vérification de la validité de l'identifiant
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const typeEchelleReponse = await TypeEchelleReponse.findById(id);
        if (!typeEchelleReponse) {
        return res.status(404).json({
            success: false,
            message: t('type_echelle_non_trouve', lang),
        });
        }

        await typeEchelleReponse.deleteOne({ _id: id });

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
export const getTypeEchelleReponses = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : null; // si non défini, on ne limite pas
    const search = req.query.search?.trim();
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    // Construire le filtre de recherche
    const filter = {};
    if (search) {
        const regex = new RegExp(search, 'i'); // insensible à la casse
        filter.$or = [{ nomFr: regex }, { nomEn: regex }];
    }

    try {
        const total = await TypeEchelleReponse.countDocuments(filter);

        let query = TypeEchelleReponse.find(filter).sort({ [sortField]: 1 }).lean();
        if (limit) {
            query = query.skip((page - 1) * limit).limit(limit);
        }

        const typeEchelleReponses = await query;

        return res.status(200).json({
            success: true,
            data: {
                typeEchelleReponses,
                totalItems: total,
                currentPage: page,
                totalPages: limit ? Math.ceil(total / limit) : 1,
                pageSize: limit || total
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


//Strucuture par Id
export const getTypeEchelleReponseById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    
  
    try {
        // Vérifie que l'ID est un ObjectId MongoDB valide
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
  
        const typeEchelleReponse = await TypeEchelleReponse.findById(id)
            .lean();
    
        if (!TypeEchelleReponse) {
            return res.status(404).json({
            success: false,
            message: t('type_echelle_non_trouvee', lang),
            });
        }
    
        return res.status(200).json({
            success: true,
            data: {
                typeEchelleReponses:TypeEchelleReponse,
                totalItems:1,
                currentPage:1,
                totalPages: 1,
                pageSize:1
            },
        });
    
    } catch (error) {
        console.error('Erreur getTypeEchelleReponseById:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: error.message,
        });
    }
};

//Charger pour les menu deroulant
export const getTypeEchelleReponsesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
      const typeEchelleReponses = await TypeEchelleReponse.find({}, '_id nomFr nomEn')
        .sort({ [sortField]: 1 })
        .lean();
  
        return res.status(200).json({
            success: true,
            data: {
                typeEchelleReponses,
                totalItems:typeEchelleReponses.length,
                currentPage:1,
                totalPages: typeEchelleReponses.length,
                pageSize:1
            },
        });
    } catch (err) {
        console.error('Erreur getTypeEchelleReponsesForDropdown:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};



  
  

