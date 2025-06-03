import express from 'express';
import { check } from 'express-validator';
import {
    submitEvaluationAChaudReponse,
    getReponsesParUtilisateur,
    getReponsesParSession,
    getStatsParRubrique,
    getStatsParQuestion,
    getStatsParSousQuestion,
    getTauxReponseFormation,
    getReponsesUtilisateur,
    getStatsByField,
    getStatsParParticipant
} from '../controllers/evaluationAChaudReponseController.js';

import { authentificate } from '../middlewares/auth.js';
import { validateFieldsReponseEvaluation } from '../middlewares/validateFields/validateEvaluation.js';

const router = express.Router();

router.post('/', authentificate, validateFieldsReponseEvaluation, submitEvaluationAChaudReponse);

router.get('/utilisateur/:utilisateurId', authentificate, getReponsesParUtilisateur);
router.get('/session/:formationId', authentificate, getReponsesParSession);

router.get('/stats/rubrique/:formationId', authentificate, getStatsParRubrique);
router.get('/stats/question/:formationId', authentificate, getStatsParQuestion);
router.get('/stats/sous-question/:formationId', authentificate, getStatsParSousQuestion);
router.get('/stats/taux/:formationId', authentificate, getTauxReponseFormation);

router.get('/stats/field/:formationId', authentificate, getStatsByField);
router.get('/stats/utilisateur/:utilisateurId', authentificate, getReponsesUtilisateur);
router.get('/stats/participant/:formationId/:utilisateurId', authentificate, getStatsParParticipant);

export default router;
