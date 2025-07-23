import CategorieProfessionnelle from '../models/CategorieProfessionnelle.js';
import Grade from '../models/Grade.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Créer une catégorie professionnelle
export const createCategorieProfessionnelle = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, grades } = req.body;

        // Vérifier unicité nomFr et nomEn
        if (await CategorieProfessionnelle.exists({ nomFr })) {
            return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_fr', lang) });
        }
        if (await CategorieProfessionnelle.exists({ nomEn })) {
            return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_en', lang) });
        }

        // Vérifier les grades
        let gradeIds = [];
        if (grades && Array.isArray(grades)) {
            for (const grade of grades) {
                if (!mongoose.Types.ObjectId.isValid(grade._id)) {
                    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
                }
                const exists = await Grade.exists({ _id: grade._id });
                if (!exists) {
                    return res.status(404).json({ success: false, message: t('grade_non_trouve', lang) });
                }
                gradeIds.push(grade._id);
            }
        } else {
            return res.status(400).json({ success: false, message: t('grades_requis', lang) });
        }

        const categorie = await CategorieProfessionnelle.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            grades: gradeIds
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: categorie
        });

    } catch (err) {
        console.error('Erreur createCategorieProfessionnelle:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Modifier une catégorie professionnelle
export const updateCategorieProfessionnelle = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, grades } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const categorie = await CategorieProfessionnelle.findById(id);
        if (!categorie) {
            return res.status(404).json({ success: false, message: t('categorie_professionnelle_non_trouvee', lang) });
        }

        // Vérifier unicité nomFr et nomEn sauf cet enregistrement
        if (nomFr) {
            const existsFr = await CategorieProfessionnelle.findOne({ nomFr, _id: { $ne: id } });
            if (existsFr) return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_fr', lang) });
            categorie.nomFr = nomFr;
        }

        if (nomEn) {
            const existsEn = await CategorieProfessionnelle.findOne({ nomEn, _id: { $ne: id } });
            if (existsEn) return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_en', lang) });
            categorie.nomEn = nomEn;
        }

        if (descriptionFr !== undefined) categorie.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) categorie.descriptionEn = descriptionEn;

        // Mettre à jour les grades
        if (grades && Array.isArray(grades)) {
            let validGradeIds = [];
            for (const grade of grades) {
                if (!mongoose.Types.ObjectId.isValid(grade._id)) {
                    return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
                }
                const exists = await Grade.exists({ _id: grade._id });
                if (!exists) {
                    return res.status(404).json({ success: false, message: t('grade_non_trouve', lang) });
                }
                validGradeIds.push(grade._id);
            }
            categorie.grades = validGradeIds; // Remplace l’ancien tableau
        }

        await categorie.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: categorie
        });

    } catch (err) {
        console.error('Erreur updateCategorieProfessionnelle:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Supprimer une catégorie professionnelle
export const deleteCategorieProfessionnelle = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const categorie = await CategorieProfessionnelle.findById(id);
        if (!categorie) {
        return res.status(404).json({ success: false, message: t('categorie_professionnelle_non_trouvee', lang) });
        }

        await CategorieProfessionnelle.deleteOne({ _id: id });

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Liste paginée des catégories professionnelles
export const getCategoriesProfessionnelles = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await CategorieProfessionnelle.countDocuments();

        const categories = await CategorieProfessionnelle.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate('grades', 'nomFr nomEn')
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                categories,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Récupérer une catégorie professionnelle par id
export const getCategorieProfessionnelleById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const categorie = await CategorieProfessionnelle.findById(id)
        .populate('grades', 'nomFr nomEn')
        .lean();

        if (!categorie) {
            return res.status(404).json({ 
                success: false, 
                message: t('categorie_professionnelle_non_trouvee', lang) 
            });
        }

        return res.status(200).json({ 
            success: true, 
            data: categorie
         });

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Recherche par nom (nomFr ou nomEn selon la langue)
export const searchCategoriesProfessionnellesByName = async (req, res) => {
    const { nom } = req.query;
    const lang = req.headers['accept-language'] || 'fr';

    if (!nom) {
        return res.status(400).json({ success: false, message: t('nom_requis', lang) });
    }

    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';

        const categories = await CategorieProfessionnelle.find({
        [queryField]: { $regex: nom, $options: 'i' }
        }).populate('grades', 'nomFr nomEn').lean();

        return res.status(200).json({
            success: true, 
            data: {
                categorieProfessionnelles:categories,
                totalItems:categories.length,
                currentPage:1,
                totalPages:1,
                pageSize:categories.length
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Liste des categories par grade
export const getCategoriesByGrade = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { gradeId } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
         const total = await CategorieProfessionnelle.countDocuments({ grades: gradeId });
        
        const categories = await CategorieProfessionnelle.find({ grades: gradeId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({[lang==='fr'?'nomFr':'nomEn']:1})
        .populate({
            path: 'grades',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                categorieProfessionnelles:categories,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
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

export const getCategorieProfessionnellesForDropdownByGrade = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {gradeId} = req.params;
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        if (!mongoose.Types.ObjectId.isValid(gradeId)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
        const categorieProfessionnelles = await CategorieProfessionnelle.find({grades:gradeId}, "_id nomFr nomEn")
            .populate([
                { path: 'grades', select: 'nomFr nomEn',  options:{strictPopulate:false}}
            ])
            .sort({ [sortField]: 1 })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                categorieProfessionnelles,
                totalItems:categorieProfessionnelles.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:categorieProfessionnelles.lenght
            },
        });
    } catch (err) {
      console.error('Erreur getCategorieProfessionnellesForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};
