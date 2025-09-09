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

router.post('/ajouter-tache-theme/all', enregistrerTachesThemeFormation)
router.post('/', authentificate, ajouterTacheAuTheme);
router.get('/theme/:themeId', authentificate, getTachesParTheme);
router.get('/progression-taches/:themeId', authentificate, getTacheProgressionByTheme)
router.get('/:tacheFormationId', authentificate, getTacheThemeById);
router.put('/:tacheFormationId/executer', authentificate, executerTache);
router.put('/:tacheFormationId/:currentUser', authentificate, changerStatutTache);
router.put('/:tacheFormationId/reinitialiser', authentificate, reinitialiserTache);
router.put('/', authentificate, reinitialiserToutesLesTaches);
router.delete('/:tacheFormationId', authentificate, supprimerTacheDuTheme); //Supprimer une tâche d'un thème
router.get('/theme/:themeId/statistiques', authentificate, getStatutExecutionTheme);  //Obtenir les statistiques d'exécution des tâches d'un thème
router.put('/:tacheFormationId/responsable', authentificate,  updateTachesResponsable);
router.put('/:tacheFormationId/dates', authentificate, updateDate);
router.get('/utilisateur/:userId', authentificate, getUserTaches);
router.get('/dashboard/statistiques',authentificate, statsTaches);


export default router;