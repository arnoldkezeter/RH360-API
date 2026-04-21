// controllers/rubriqueStatiqueController.js
import QuestionStatique from '../models/QuestionStatique.js';
import RubriqueStatique from '../models/RubriqueStatique.js';
import {
    getRubriquesStatiquesCompletes,
    updateRubriqueStatique,
    ajouterQuestionStatique,
    supprimerQuestionStatique,
    updateSousQuestions,
    initialiserRubriquesStatiques,
    initialiserQuestionsStatiques,
} from '../services/rubriqueStatiqueService.js';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

/**
 * Récupère toutes les rubriques statiques avec leurs questions
 * GET /api/rubriques-statiques
 */
export const getAllRubriquesStatiques = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const rubriques = await getRubriquesStatiquesCompletes();
        
        return res.status(200).json({
            success: true,
            data: {
                rubriquesStatiques: rubriques,
                totalItems: rubriques.length,
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

/**
 * Récupère une rubrique statique par son code
 * GET /api/rubriques-statiques/:code
 */
export const getRubriqueStatiqueByCode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { code } = req.params;
    
    try {
        const rubrique = await RubriqueStatique.findOne({ code, actif: true })
            .lean();
        
        if (!rubrique) {
            return res.status(404).json({
                success: false,
                message: t('rubrique_non_trouvee', lang),
            });
        }
        
        const questions = await QuestionStatique.find({ rubriqueCode: code, actif: true })
            .populate('typeEchelle')
            .sort({ ordre: 1 })
            .lean();
        
        return res.status(200).json({
            success: true,
            data: { ...rubrique, questions },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Met à jour une rubrique statique
 * PUT /api/rubriques-statiques/:code
 */
export const updateRubriqueStatiqueController = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { code } = req.params;
    const { titreFr, titreEn, ordre, masquable, questionsPersonnalisables, questionsSupprimables, actif } = req.body;
    
    try {
        const rubrique = await RubriqueStatique.findOne({ code });
        if (!rubrique) {
            return res.status(404).json({
                success: false,
                message: t('rubrique_non_trouvee', lang),
            });
        }
        
        const updateData = {};
        if (titreFr !== undefined) updateData.titreFr = titreFr;
        if (titreEn !== undefined) updateData.titreEn = titreEn;
        if (ordre !== undefined) updateData.ordre = ordre;
        if (masquable !== undefined) updateData.masquable = masquable;
        if (questionsPersonnalisables !== undefined) updateData.questionsPersonnalisables = questionsPersonnalisables;
        if (questionsSupprimables !== undefined) updateData.questionsSupprimables = questionsSupprimables;
        if (actif !== undefined) updateData.actif = actif;
        
        const updated = await updateRubriqueStatique(code, updateData);
        
        return res.status(200).json({
            success: true,
            message: t('rubrique_mise_a_jour', lang),
            data: updated,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Ajoute une question statique
 * POST /api/rubriques-statiques/:rubriqueCode/questions
 */
export const addQuestionStatiqueController = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { rubriqueCode } = req.params;
    const { libelleFr, libelleEn, type, typeEchelle, commentaireGlobal, ordre, supprimable, duplicable, sousQuestions } = req.body;
    
    try {
        // Vérifier que la rubrique existe
        const rubrique = await RubriqueStatique.findOne({ code: rubriqueCode, actif: true });
        if (!rubrique) {
            return res.status(404).json({
                success: false,
                message: t('rubrique_non_trouvee', lang),
            });
        }
        
        const questionData = {
            rubriqueCode,
            libelleFr,
            libelleEn,
            type: type || 'simple',
            typeEchelle: typeEchelle || null,
            commentaireGlobal: commentaireGlobal || false,
            ordre: ordre || 1,
            supprimable: supprimable !== undefined ? supprimable : true,
            duplicable: duplicable !== undefined ? duplicable : true,
            sousQuestions: sousQuestions || [],
        };
        
        const question = await ajouterQuestionStatique(questionData);
        
        return res.status(201).json({
            success: true,
            message: t('question_ajoutee', lang),
            data: question,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Met à jour une question statique
 * PUT /api/rubriques-statiques/questions/:code
 */
export const updateQuestionStatiqueController = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { code } = req.params;
    const { libelleFr, libelleEn, type, typeEchelle, commentaireGlobal, ordre, supprimable, duplicable, actif } = req.body;
    
    try {
        const question = await QuestionStatique.findOne({ code });
        if (!question) {
            return res.status(404).json({
                success: false,
                message: t('question_non_trouvee', lang),
            });
        }
        
        if (libelleFr !== undefined) question.libelleFr = libelleFr;
        if (libelleEn !== undefined) question.libelleEn = libelleEn;
        if (type !== undefined) question.type = type;
        if (typeEchelle !== undefined) question.typeEchelle = typeEchelle;
        if (commentaireGlobal !== undefined) question.commentaireGlobal = commentaireGlobal;
        if (ordre !== undefined) question.ordre = ordre;
        if (supprimable !== undefined) question.supprimable = supprimable;
        if (duplicable !== undefined) question.duplicable = duplicable;
        if (actif !== undefined) question.actif = actif;
        
        await question.save();
        
        return res.status(200).json({
            success: true,
            message: t('question_mise_a_jour', lang),
            data: question,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Supprime une question statique (soft delete)
 * DELETE /api/rubriques-statiques/questions/:code
 */
export const deleteQuestionStatiqueController = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { code } = req.params;
    
    try {
        const question = await supprimerQuestionStatique(code);
        
        return res.status(200).json({
            success: true,
            message: t('question_supprimee', lang),
            data: question,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Met à jour les sous-questions d'une question statique
 * PUT /api/rubriques-statiques/questions/:code/sous-questions
 */
export const updateSousQuestionsController = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { code } = req.params;
    const { sousQuestions } = req.body;
    
    try {
        const question = await updateSousQuestions(code, sousQuestions);
        
        return res.status(200).json({
            success: true,
            message: t('sous_questions_mises_a_jour', lang),
            data: question,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

/**
 * Initialise les rubriques et questions statiques (admin uniquement)
 * POST /api/rubriques-statiques/init
 */
export const initRubriquesStatiques = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        await initialiserRubriquesStatiques();
        await initialiserQuestionsStatiques();
        
        return res.status(200).json({
            success: true,
            message: t('rubriques_initialisees', lang),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};