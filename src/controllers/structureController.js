import Structure from '../models/Structure.js';
import { validationResult} from 'express-validator';
import { t } from '../utils/i18n.js';
import Utilisateur from '../models/Utilisateur.js';
import mongoose from 'mongoose';



// Ajouter
export const createStructure = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, chefStructure } = req.body;

        // Vérifier l'unicité du nom
        const existsFr = await Structure.exists({ nomFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('structure_existante_fr', lang),
            });
        }

        const existsEn = await Structure.exists({ nomEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('structure_existante_en', lang),
            });
        }
        

        let chefId;
        if (chefStructure) {
        // Valider l'ObjectId
        if (!mongoose.Types.ObjectId.isValid(chefStructure)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            error: 'Invalid chefStructure ObjectId',
            });
        }

        // Vérifier si le chef existe
        const chef = await Utilisateur.findById(chefStructure);
        if (!chef) {
            return res.status(404).json({
            success: false,
            message: t('chef_structure_non_trouve', lang),
            });
        }

        chefId = chef._id;
        }

        // Création de la structure
        const structure = await Structure.create({
            nomFr, 
            nomEn, 
            descriptionFr, 
            descriptionEn,
            chefStructure: chefId,
        });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: structure,
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
export const updateStructure = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, chefStructure } = req.body;

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
        const structure = await Structure.findById(id);
        if (!structure) {
        return res.status(404).json({
            success: false,
            message: t('structure_non_trouve', lang),
        });
        }

        // Vérifier l'unicité du nom
        const existsFr = await Structure.findOne({ nomFr, _id: { $ne: structure._id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('structure_existante_fr', lang),
        });
        }

        const existsEn = await Structure.findOne({ nomEn, _id: { $ne: structure._id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('structure_existante_en', lang),
        });
        }


        if (chefStructure) {
            if (!mongoose.Types.ObjectId.isValid(chefStructure)) {
                return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
                });
            }

            const chef = await Utilisateur.findById(chefStructure);
            if (!chef) {
                return res.status(404).json({
                success: false,
                message: t('chef_structure_non_trouve', lang),
                });
            }
            structure.chefStructure = chefStructure;
        }else{
            structure.chefStructure = undefined;
        }

        if (nomFr) structure.nomFr = nomFr;
        if (nomEn) structure.nomEn = nomEn;
        if (descriptionFr !== undefined) structure.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) structure.descriptionEn = descriptionEn;

        await structure.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: structure,
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
export const deleteStructure = async (req, res) => {
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
        const structure = await Structure.findById(id);
        if (!structure) {
        return res.status(404).json({
            success: false,
            message: t('structure_non_trouve', lang),
        });
        }

        await Structure.deleteOne({ _id: id });

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
export const getStructures = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        const total = await Structure.countDocuments();
    
        const structures = await Structure.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate({
            path: 'chefStructure',
            select: 'nom prenom',
            options: { strictPopulate: false }, // au cas où chefStructure est null ou inexistant
            })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                structures,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
            },
        });
    } catch (err) {
        console.log(err.message)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
  

//Strucuture par Id
export const getStructureById = async (req, res) => {
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
  
        const structure = await Structure.findById(id)
            .populate({
            path: 'chefStructure',
            select: 'nom prenom email',
            options: { strictPopulate: false },
            })
            .lean();
    
        if (!structure) {
            return res.status(404).json({
            success: false,
            message: t('structure_non_trouvee', lang),
            });
        }
    
        return res.status(200).json({
            success: true,
            data: {
                structure,
                totalItems:1,
                currentPage:1,
                totalPages: 1,
                pageSize:1,
            },
        });
    
    } catch (error) {
        console.error('Erreur getStructureById:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: error.message,
        });
    }
};


//Recherher par nom
export const searchStructureByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;
  
    if (!nom) {
        return res.status(400).json({
            success: false,
            message: t('nom_requis', lang), // Assure-toi que cette clé existe bien dans les traductions
        });
    }
  
    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';
    
        const structures = await Structure.find({
            [queryField]: { $regex: new RegExp(nom, 'i') }, // Recherche insensible à la casse
        })
            .populate({
            path: 'chefStructure',
            select: 'nom prenom',
            options: { strictPopulate: false },
            })
            .sort({ [queryField]: 1 }) // Tri alphabétique par langue
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                structures,
                totalItems:structures.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:structures.lenght
            },
        });
    } catch (error) {
        console.error('Erreur recherche structure par nom:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
  };


//Charger pour les menu deroulant
export const getStructuresForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
      const structures = await Structure.find({}, '_id nomFr nomEn')
        .sort({ [sortField]: 1 })
        .lean();
  
      return res.status(200).json({
        success: true,
        data: {
                structures,
                totalItems:structures.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:structures.lenght
            },
      });
    } catch (err) {
      console.error('Erreur getStructuresForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};


  
  

