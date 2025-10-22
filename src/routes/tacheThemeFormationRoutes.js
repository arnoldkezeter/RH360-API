import express from 'express';
import { authentificate } from '../middlewares/auth.js';
import { 
  ajouterTacheAuTheme,
  getTachesParTheme,
  executerTache,
  changerStatutTache,
  reinitialiserTache,
  getStatutExecutionTheme,
  supprimerTacheDuTheme,
  getTacheThemeById,
  updateTachesResponsable,
  updateDate,
  statsTaches,
  getUserTaches,
  enregistrerTachesThemeFormation,
  reinitialiserToutesLesTaches,
  getTacheProgressionByTheme
} from '../controllers/tacheThemeFormationController.js';

const router = express.Router();

router.post('/ajouter-tache-theme/all', authentificate, enregistrerTachesThemeFormation);
router.post('/', authentificate, ajouterTacheAuTheme);

router.put('/:tacheFormationId/executer/:currentUserId', authentificate, executerTache);
router.put('/:tacheFormationId/dates', authentificate, updateDate);
router.put('/:tacheFormationId/statut/:currentUserId', authentificate, changerStatutTache);
router.put('/:tacheFormationId/reinitialiser', authentificate, reinitialiserTache);
router.put('/:tacheFormationId/responsable', authentificate, updateTachesResponsable);
router.put('/reinitialiser-toutes', authentificate, reinitialiserToutesLesTaches);

router.delete('/:tacheFormationId', authentificate, supprimerTacheDuTheme);

router.get('/theme/:themeId', authentificate, getTachesParTheme);
router.get('/theme/:themeId/progression', authentificate, getTacheProgressionByTheme);
router.get('/theme/:themeId/statistiques', authentificate, getStatutExecutionTheme);
router.get('/utilisateur/:userId', authentificate, getUserTaches);
router.get('/:tacheFormationId', authentificate, getTacheThemeById);
router.get('/dashboard/statistiques', authentificate, statsTaches);

export default router;
