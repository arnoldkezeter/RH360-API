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
        const { nomFr, nomEn, descriptionFr, descriptionEn, grade } = req.body;

        // Vérifier unicité nomFr et nomEn
        if (await CategorieProfessionnelle.exists({ nomFr })) {
            return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_fr', lang) });
        }
        if (await CategorieProfessionnelle.exists({ nomEn })) {
            return res.status(409).json({ success: false, message: t('categorie_professionnelle_existante_en', lang) });
        }

        // Vérifier que le grade existe si fourni
        if (grade) {
            if (!mongoose.Types.ObjectId.isValid(grade._id)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            
        }

        const categorie = await CategorieProfessionnelle.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            grade
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: categorie
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// Modifier une catégorie professionnelle
export const updateCategorieProfessionnelle = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, grade } = req.body;

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

        if (grade) {
            if (!mongoose.Types.ObjectId.isValid(grade._id)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
            categorie.grade = grade;
        }

        await categorie.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: categorie
        });

    } catch (err) {
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
        .populate('grade', 'nomFr nomEn')
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
        .populate('grade', 'nomFr nomEn')
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
        }).populate('grade', 'nomFr nomEn').lean();

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
         const total = await CategorieProfessionnelle.countDocuments();
        
        const categories = await CategorieProfessionnelle.find({ grade: gradeId })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
            path: 'grade',
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
