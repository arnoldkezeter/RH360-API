// controllers/gradeController.js
import Grade from '../models/Grade.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

// Créer un grade
export const createGrade = async (req, res) => {
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

        const existsFr = await Grade.exists({ nomFr });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('grade_existante_fr', lang),
        });
        }

        const existsEn = await Grade.exists({ nomEn });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('grade_existante_en', lang),
        });
        }

        const grade = await Grade.create({
        nomFr,
        nomEn,
        descriptionFr,
        descriptionEn,
        });

        return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: grade,
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Modifier un grade
export const updateGrade = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
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
        const grade = await Grade.findById(id);
        if (!grade) {
        return res.status(404).json({
            success: false,
            message: t('grade_non_trouve', lang),
        });
        }

        const existsFr = await Grade.findOne({ nomFr, _id: { $ne: id } });
        if (existsFr) {
        return res.status(409).json({
            success: false,
            message: t('grade_existante_fr', lang),
        });
        }

        const existsEn = await Grade.findOne({ nomEn, _id: { $ne: id } });
        if (existsEn) {
        return res.status(409).json({
            success: false,
            message: t('grade_existante_en', lang),
        });
        }

        grade.nomFr = nomFr;
        grade.nomEn = nomEn;
        grade.descriptionFr = descriptionFr;
        grade.descriptionEn = descriptionEn;
        await grade.save();

        return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: grade,
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Supprimer un grade
export const deleteGrade = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const grade = await Grade.findById(id);
        if (!grade) {
        return res.status(404).json({
            success: false,
            message: t('grade_non_trouve', lang),
        });
        }

        await Grade.deleteOne({ _id: id });

        return res.status(200).json({
        success: true,
        message: t('supprimer_succes', lang),
        });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Liste paginée
export const getGrades = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await Grade.countDocuments();
        const grades = await Grade.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                grades,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit 
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

// Détail par ID
export const getGradeById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const grade = await Grade.findById(id).lean();
        if (!grade) {
            return res.status(404).json({
            success: false,
            message: t('grade_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: grade,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: err.message,
        });
    }
};

// Dropdown
export const getGradesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const grades = await Grade.find({}, '_id nomFr nomEn')
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                grades,
                totalItems:grades.length,
                currentPage:1,
                totalPages: 1,
                pageSize:grades.length 
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

// Recherche
export const searchGradesByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
            success: false,
            message: t('nom_requis', lang),
        });
    }

    try {
        const field = lang === 'en' ? 'nomEn' : 'nomFr';
        const grades = await Grade.find({
            [field]: { $regex: new RegExp(nom, 'i') },
        })
            .sort({ [field]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                grades,
                totalItems:grades.length,
                currentPage:1,
                totalPages: 1,
                pageSize:grades.length 
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
