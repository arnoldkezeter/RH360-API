// routes/evaluationAChaud.js
import express from 'express';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateEvaluation.js';

import {
createEvaluationAChaud,
updateEvaluationAChaud,
deleteEvaluationAChaud,
getFilteredEvaluation,
getEvaluationAChaudById,
getEvaluationForDropdown,
getEvaluationsChaudByUtilisateur,
getEvaluationStats,
getResultatsByRubrique,
getQuestionDetails,
getCommentairesByEvaluation,
getStatsByField,
getDashboardEvaluations,
exportFichePDF,
exportGoogleForms,
regenerateRubriques,
getEvaluationConfig,
updateEvaluationConfig,
addObjectifPersonnalise,
removeObjectifPersonnalise,
} from '../controllers/evaluationAChaudController.js';

import {
saveDraftEvaluationAChaudReponse,
submitEvaluationAChaudReponse,
getReponseUtilisateur,
getReponsesParUtilisateur,
getReponsesParEvaluation,
exportReponsesCSV,
} from '../controllers/evaluationAChaudReponseController.js';

import { initialiserQuestionsStatiques, initialiserRubriquesStatiques } from '../services/rubriqueStatiqueService.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/admin/init-rubriques', async (req, res) => {
try {
  await initialiserRubriquesStatiques();
  await initialiserQuestionsStatiques();
  res.status(200).json({ success: true, message: 'Rubriques initialisées avec succès' });
} catch (error) {
  res.status(500).json({ success: false, message: error.message });
}
});

// ═══════════════════════════════════════════════════════════════════════════════
// RÉPONSES
// Toutes déclarées AVANT /:id pour éviter que "reponses" soit capturé comme :id
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/reponses/brouillon',authentificate, saveDraftEvaluationAChaudReponse);
router.post('/reponses/soumettre',authentificate, submitEvaluationAChaudReponse);
router.get('/reponses/evaluation/:evaluationId/export-csv', authentificate, exportReponsesCSV);   // AVANT /evaluation/:evaluationId
router.get('/reponses/evaluation/:evaluationId',authentificate, getReponsesParEvaluation);
router.get('/reponses/utilisateur/:utilisateurId',  authentificate, getReponsesParUtilisateur);
router.get('/reponses/:utilisateurId/:modeleId',authentificate, getReponseUtilisateur);

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES
// Déclarées AVANT /:id
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats/:evaluationId/rubriques',  authentificate, getResultatsByRubrique);// AVANT /stats/:evaluationId
router.get('/stats/:evaluationId/question/:questionId',   authentificate, getQuestionDetails);  // AVANT /stats/:evaluationId
router.get('/stats/:evaluationId/commentaires', authentificate, getCommentairesByEvaluation); // AVANT /stats/:evaluationId
router.get('/stats/:evaluationId/groupe', authentificate, getStatsByField); // AVANT /stats/:evaluationId
router.get('/stats/:evaluationId',authentificate, getEvaluationStats);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// Déclarées AVANT /:id
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/export-pdf/:evaluationId', authentificate, exportFichePDF);
router.get('/google-forms/:evaluationId', authentificate, exportGoogleForms);

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTATION (routes fixes)
// Déclarées AVANT /:id
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', authentificate, getDashboardEvaluations);
router.get('/dropdown-all/:themeId',authentificate, getEvaluationForDropdown);
router.get('/user/:utilisateurId',authentificate, getEvaluationsChaudByUtilisateur);

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/',authentificate, getFilteredEvaluation);
router.post('/', authentificate, validateFields, createEvaluationAChaud);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES AVEC /:id
// Toutes les routes dynamiques avec :id EN DERNIER
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id/config',authentificate, getEvaluationConfig);
router.put('/:id/config',authentificate, updateEvaluationConfig);
router.post('/:id/regenerate',authentificate, regenerateRubriques);
router.post('/:id/objectifs', authentificate, addObjectifPersonnalise);
router.delete('/:id/objectifs/:objectifId', authentificate, removeObjectifPersonnalise);
router.get('/:id', authentificate, getEvaluationAChaudById);
router.put('/:id', authentificate, validateFields, updateEvaluationAChaud);
router.delete('/:id',authentificate, deleteEvaluationAChaud);

export default router;