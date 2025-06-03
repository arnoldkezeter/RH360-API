// routes/evaluationAChaud.js (ou similaire)
import express from 'express';
import { ajouterEchelle, ajouterQuestion, ajouterRubrique, ajouterSousQuestion, createEvaluationAChaud, 
        deleteEvaluationAChaud, 
        dropdownEvaluationAChaud, 
        getEvaluationAChaudById, 
        getEvaluationParTheme, 
        listEvaluationAChaud, 
        modifierEchelle, 
        modifierQuestion, 
        modifierRubrique, 
        modifierSousQuestion, 
        supprimerEchelle, 
        supprimerQuestion, 
        supprimerRubrique, 
        supprimerSousQuestion, 
        updateEvaluationAChaud } from '../controllers/evaluationAChaudController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields, validateFieldsEchelle, validateFieldsQuestion, validateFieldsRubrique, validateFieldsSousQuestion } from '../middlewares/validateFields/validateEvaluation.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createEvaluationAChaud);
router.put('/:id', authentificate, validateFields, updateEvaluationAChaud);
router.delete('/:id', authentificate, deleteEvaluationAChaud);
router.get('/', authentificate, listEvaluationAChaud);
router.get('/dropdown', authentificate, dropdownEvaluationAChaud);
router.get('/:id', authentificate, getEvaluationAChaudById);
router.get('/par-theme/:themeId', getEvaluationParTheme);

// Rubriques
router.post('/:evaluationId/rubriques', authentificate, validateFieldsRubrique, ajouterRubrique);
router.put('/:evaluationId/rubriques/:rubriqueId', authentificate, validateFieldsRubrique, modifierRubrique);
router.delete('/:evaluationId/rubriques/:rubriqueId', authentificate, supprimerRubrique);

// Questions
router.post('/:evaluationId/rubriques/:rubriqueId/questions', authentificate, validateFieldsQuestion, ajouterQuestion);
router.put('/:evaluationId/rubriques/:rubriqueId/questions/:questionId', authentificate, validateFieldsQuestion, modifierQuestion);
router.delete('/:evaluationId/rubriques/:rubriqueId/questions/:questionId', authentificate, supprimerQuestion);

// Sous-questions
router.post('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/sous-questions', authentificate, validateFieldsSousQuestion, ajouterSousQuestion);
router.put('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/sous-questions/:sousQuestionId', authentificate, validateFieldsSousQuestion, modifierSousQuestion);
router.delete('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/sous-questions/:sousQuestionId', authentificate, supprimerSousQuestion);

// Échelle
router.post('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/echelle', authentificate, validateFieldsEchelle, ajouterEchelle);
router.put('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/echelle/:echelleId', authentificate, validateFieldsEchelle, modifierEchelle);
router.delete('/:evaluationId/rubriques/:rubriqueId/questions/:questionId/echelle/:echelleId', authentificate, supprimerEchelle);

export default router;
