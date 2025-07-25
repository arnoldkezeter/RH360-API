import express from 'express';
import {
  createAutoEvaluation,
  updateAutoEvaluation,
  deleteAutoEvaluation,
  getEvaluationsByUser,
  getAllEvaluations,
  validateEvaluation,
  getTauxValidationEvaluations,
  getMoyenneNiveauParBesoin,
  getEvaluationsParMois,
  getTopBesoinsAjoutes,
  getStatsParUtilisateur,
  getBesoinsFaiblesPrioritaires,
  getMotsClesInsuffisances,
  getEvolutionNiveauBesoin,
  getRepartitionNiveauxParBesoin,
  getBesoinsPredefinisAvecAutoEvaluation,
  getRepartitionBesoinsParPoste,
  getRepartitionBesoinsParNiveauEtPoste,
  getGroupedAutoEvaluations
} from '../controllers/autoEvaluationBesoinController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateBesoinFormationExprime.js';

const router = express.Router();

// CRUD
router.post('/', authentificate, validateFields, createAutoEvaluation);
router.put('/:id', authentificate, validateFields, updateAutoEvaluation);
router.delete('/:id', authentificate, deleteAutoEvaluation);
router.get('/utilisateur/:utilisateurId', authentificate, getEvaluationsByUser);
router.get('/', authentificate, getAllEvaluations);
router.get('/besoin-evaluation', authentificate, getBesoinsPredefinisAvecAutoEvaluation)

// Validation
router.put('/valider/:id', authentificate, validateEvaluation);

// Analyses
router.get('/stats/taux-validation', authentificate, getTauxValidationEvaluations);
router.get('/stats/moyenne-niveau-par-besoin', authentificate, getMoyenneNiveauParBesoin);
router.get('/stats/evaluations-par-mois', authentificate, getEvaluationsParMois);
router.get('/stats/top-besoins-ajoutes', authentificate, getTopBesoinsAjoutes);
router.get('/stats/par-utilisateur', authentificate, getStatsParUtilisateur);
router.get('/stats/faibles-prioritaires', authentificate, getBesoinsFaiblesPrioritaires);
router.get('/stats/mots-cles-insuffisances', authentificate, getMotsClesInsuffisances);
router.get('/stats/evolution-niveau/:besoinId', authentificate, getEvolutionNiveauBesoin);
router.get('/stats/repartition-niveaux/:besoinId', authentificate, getRepartitionNiveauxParBesoin);
router.get('/stats/repartition-poste', authentificate, getRepartitionBesoinsParPoste);
router.get('/stats/repartition-poste/:posteId', authentificate, getRepartitionBesoinsParNiveauEtPoste);
router.get('/stats/auto-evaluation-grouped', authentificate, getGroupedAutoEvaluations);

export default router;
