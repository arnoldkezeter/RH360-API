// routes/evaluationAChaudReponse.js
import express from 'express';
import {
    saveDraftEvaluationAChaudReponse,
    submitEvaluationAChaudReponse,
    getReponseUtilisateur,
    getReponsesParUtilisateur,
    getReponsesParEvaluation,
} from '../controllers/evaluationAChaudReponseController.js';

import { authentificate } from '../middlewares/auth.js';
import { validateFieldsReponseEvaluation } from '../middlewares/validateFields/validateEvaluation.js';

const router = express.Router();

// ── Soumission ────────────────────────────────────────────────────────────────
router.post('/brouillon',  authentificate, saveDraftEvaluationAChaudReponse);
router.post('/soumettre',  authentificate, validateFieldsReponseEvaluation, submitEvaluationAChaudReponse);

// ── Lecture ───────────────────────────────────────────────────────────────────
// Réponse d'un utilisateur pour une évaluation précise
router.get('/:utilisateurId/:modeleId', authentificate, getReponseUtilisateur);

// Toutes les réponses d'un utilisateur (liste paginée)
router.get('/utilisateur/:utilisateurId', authentificate, getReponsesParUtilisateur);

// Toutes les réponses pour une évaluation (vue admin)
router.get('/evaluation/:evaluationId', authentificate, getReponsesParEvaluation);

export default router;