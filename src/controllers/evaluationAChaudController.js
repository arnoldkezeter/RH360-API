import EvaluationAChaud from '../models/EvaluationAChaud.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

// Créer un modèle d'évaluation à chaud
export const createEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }
    const {
        titreFr,
        titreEn,
        theme,
        descriptionFr,
        descriptionEn,
        rubriques: [],
        actif,
    } = req.body;

    try {

        if (theme && !mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme) : null;
        if (theme && !themeExists) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        const existsFr = await EvaluationAChaud.findOne({ titreFr });
        if (existsFr) {
            return res.status(400).json({
                success: false,
                message: t('evaluation_existe_fr', lang)
            });
        }

        const existsEn = await EvaluationAChaud.findOne({ titreEn });
        if (existsEn) {
            return res.status(400).json({
                success: false,
                message: t('evaluation_existe_en', lang)
            });
        }

        const evaluation = new EvaluationAChaud({
            titreFr,
            titreEn,
            theme,
            descriptionFr,
            descriptionEn,
            rubriques,
            actif
        });
        await evaluation.save();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: evaluation
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


// Modifier un modèle d’évaluation
export const updateEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const {
        titreFr,
        titreEn,
        theme,
        descriptionFr,
        descriptionEn,
        actif,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }

        if (theme && !mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme) : null;
        if (theme && !themeExists) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }
        
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ 
                success: false, 
                message: t('evaluation_non_trouvee', lang) 
            });
        }

        evaluation.titreFr = titreFr,
        evaluation.titreEn = titreEn,
        evaluation.theme = theme,
        evaluation.descriptionFr = descriptionFr,
        evaluation.descriptionEn = descriptionEn,
        evaluation.actif = actif
        await evaluation.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: evaluation
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


// Supprimer un modèle
export const deleteEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const evaluation = await EvaluationAChaud.findByIdAndDelete(id);
        if (!evaluation) {
            return res.status(404).json({ 
                success: false, 
                message: t('evaluation_non_trouvee', lang) 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: t('supprimer_succes', lang) 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Liste paginée
export const listEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const total = await EvaluationAChaud.countDocuments();
        const data = await EvaluationAChaud.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

        return res.status(200).json({
            success: true,
            data,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Pour menus déroulants
export const dropdownEvaluationAChaud = async (req, res) => {
    try {
        const evaluations = await EvaluationAChaud.find({ actif: true })
        .select('titreFr titreEn')
        .sort({ titreFr: 1 });

        return res.status(200).json({ 
            success: true, data: 
            evaluations 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: (t('erreur_serveur', lang)), 
            error: err.message 
        });
    }
};


// Récupérer une évaluation à chaud complète par ID
export const getEvaluationAChaudById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const evaluation = await EvaluationAChaud.findById(id);

        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: evaluation,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Evaluation d'un thème
export const getEvaluationParTheme = async (req, res) => {
    const { themeId } = req.params;

    try {
        const evaluation = await EvaluationAChaud.findOne({ theme: themeId, actif: true });

        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('aucune_evaluation_actif_theme', lang),
            });
        }

        res.status(200).json({
            success: true,
            data: evaluation,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



//Rubrique
export const ajouterRubrique = async (req, res) => {
    const { evaluationId } = req.params;
    const { titreFr, titreEn, ordre } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
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

        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ 
                success: false, 
                message: t('evaluation_non_trouvee', lang) 
            });
        }

        evaluation.rubriques.push({ titreFr, titreEn, ordre, questions: [] });
        await evaluation.save();

        return res.status(200).json({ 
            success: true, 
            message: t('ajouter_succes', lang), 
            data: evaluation 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur'), 
            error: error.message 
        });
    }
};


export const modifierRubrique = async (req, res) => {
    const { evaluationId, rubriqueId } = req.params;
    const { titreFr, titreEn, ordre } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
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
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });

        const rubrique = evaluation.rubriques.id(rubriqueId);
        if (!rubrique) return res.status(404).json({ success: false, message: t('rubrique_non_trouvee') });

        rubrique.titreFr = titreFr ?? rubrique.titreFr;
        rubrique.titreEn = titreEn ?? rubrique.titreEn;
        rubrique.ordre = ordre ?? rubrique.ordre;

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: evaluation });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


export const supprimerRubrique = async (req, res) => {
    const { evaluationId, rubriqueId } = req.params;

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });

        evaluation.rubriques.id(rubriqueId)?.remove();
        await evaluation.save();

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


//Questions
export const ajouterQuestion = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { evaluationId, rubriqueId } = req.params;
    const {
        libelleFr,
        libelleEn,
        echelle = [],
        sousQuestions = [],
        commentaireGlobal = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(evaluationId) || !mongoose.Types.ObjectId.isValid(rubriqueId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const rubrique = evaluation.rubriques.id(rubriqueId);
        if (!rubrique) {
            return res.status(404).json({ success: false, message: t('rubrique_non_trouvee', lang) });
        }

        rubrique.questions.push({
            libelleFr,
            libelleEn,
            echelle,
            sousQuestions,
            commentaireGlobal
        });

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('ajouter_succes', lang), data: evaluation });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const modifierQuestion = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { evaluationId, rubriqueId, questionId } = req.params;
    const update = req.body;

    if (
        !mongoose.Types.ObjectId.isValid(evaluationId) ||
        !mongoose.Types.ObjectId.isValid(rubriqueId) ||
        !mongoose.Types.ObjectId.isValid(questionId)
    ) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const rubrique = evaluation.rubriques.id(rubriqueId);
        if (!rubrique) {
            return res.status(404).json({ success: false, message: t('rubrique_non_trouvee', lang) });
        }

        const question = rubrique.questions.id(questionId);
        if (!question) {
            return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });
        }

        question.libelleFr = update.libelleFr ?? question.libelleFr;
        question.libelleEn = update.libelleEn ?? question.libelleEn;
        question.commentaireGlobal = update.commentaireGlobal ?? question.commentaireGlobal;
        if (update.echelle) question.echelle = update.echelle;
        if (update.sousQuestions) question.sousQuestions = update.sousQuestions;

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: evaluation });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const supprimerQuestion = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { evaluationId, rubriqueId, questionId } = req.params;

    if (
        !mongoose.Types.ObjectId.isValid(evaluationId) ||
        !mongoose.Types.ObjectId.isValid(rubriqueId) ||
        !mongoose.Types.ObjectId.isValid(questionId)
    ) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const rubrique = evaluation.rubriques.id(rubriqueId);
        if (!rubrique) {
            return res.status(404).json({ success: false, message: t('rubrique_non_trouvee', lang) });
        }

        const question = rubrique.questions.id(questionId);
        if (!question) {
            return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });
        }

        question.deleteOne();

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('supprimer_succes', lang), data: evaluation });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

//Sous question
export const ajouterSousQuestion = async (req, res) => {
    const { evaluationId, rubriqueId, questionId } = req.params;
    const { libelleFr, libelleEn, commentaireObligatoire } = req.body;

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const rubrique = evaluation?.rubriques.id(rubriqueId);
        if (!rubrique) return res.status(404).json({ success: false, message: t('rubrique_non_trouvee', lang) });
        const question = rubrique?.questions.id(questionId);
        if (!question) return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });

        question.sousQuestions.push({ libelleFr, libelleEn, commentaireObligatoire });
        await evaluation.save();

        return res.status(200).json({ success: true, message: t('ajouter_succes', lang), data: evaluation });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


export const modifierSousQuestion = async (req, res) => {
    const { evaluationId, rubriqueId, questionId, sousQuestionId } = req.params;
    const { libelleFr, libelleEn, commentaireObligatoire } = req.body;

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }

        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const question = evaluation?.rubriques.id(rubriqueId)?.questions.id(questionId);
        if (!question) return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });
        const sousQuestion = question?.sousQuestions.id(sousQuestionId);
        if (!sousQuestion) return res.status(404).json({ success: false, message: t('sous_question_non_trouvee', lang) });

        sousQuestion.libelleFr = libelleFr ?? sousQuestion.libelleFr;
        sousQuestion.libelleEn = libelleEn ?? sousQuestion.libelleEn;
        sousQuestion.commentaireObligatoire = commentaireObligatoire ?? sousQuestion.commentaireObligatoire;

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: evaluation });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


export const supprimerSousQuestion = async (req, res) => {
    const { evaluationId, rubriqueId, questionId, sousQuestionId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(400).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const question = evaluation?.rubriques.id(rubriqueId)?.questions.id(questionId);
        if (!question) return res.status(400).json({ success: false, message: t('question_non_trouvee', lang) });
        question?.sousQuestions.id(sousQuestionId)?.remove();

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

//Echelle de réponse question
export const ajouterEchelle = async (req, res) => {
    const { evaluationId, rubriqueId, questionId } = req.params;
    const { valeurFr, valeurEn, ordre } = req.body;

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const question = evaluation?.rubriques.id(rubriqueId)?.questions.id(questionId);
        if (!question) return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });

        question.echelle.push({ valeurFr, valeurEn, ordre });
        await evaluation.save();

        return res.status(200).json({ success: true, message: t('ajouter_succes', lang), data: evaluation });
  } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
  }
};


export const modifierEchelle = async (req, res) => {
    const { evaluationId, rubriqueId, questionId, index } = req.params;
    const { valeurFr, valeurEn, ordre } = req.body;

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const question = evaluation?.rubriques.id(rubriqueId)?.questions.id(questionId);
        if (!question) return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });

        if (!question?.echelle[index]) return res.status(404).json({ success: false, message: t('echelle_non_trouvee', lang) });

        if (valeurFr !== undefined) question.echelle[index].valeurFr = valeurFr;
        if (valeurEn !== undefined) question.echelle[index].valeurEn = valeurEn;
        if (ordre !== undefined) question.echelle[index].ordre = ordre;

        await evaluation.save();
        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: evaluation });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


export const supprimerEchelle = async (req, res) => {
    const { evaluationId, rubriqueId, questionId, index } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) return res.status(400).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        const question = evaluation?.rubriques.id(rubriqueId)?.questions.id(questionId);
        if (!question) return res.status(400).json({ success: false, message: t('question_non_trouvee', lang) });

        if (!question?.echelle[index]) return res.status(404).json({ success: false, message: t('echelle_non_trouvee') });

        question.echelle.splice(index, 1);
        await evaluation.save();

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};
