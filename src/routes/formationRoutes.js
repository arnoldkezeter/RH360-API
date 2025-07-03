import express from 'express';
import {
  createFormation,
  updateFormation,
  deleteFormation,
  getFilteredFormations,
  getFormations,
  getFormationById,
  
  ajouterFamilleMetierAFormation,
  supprimerFamilleMetierDeFormation,
  getFormationsForDropdown,

  
  getNbFormateursParType,
  getThemesExecutionParProgramme,
  getThemesExecutionParPeriode,
  getThemesExecutionParAxeStrategique,
  searchThemesExecutionParFormation,
  getFormationsForGantt,
  getAllStatsParticipantsFormation,
  getTauxExecutionParAxeStrategique,
  getCoutReelTTCParTheme,
  getCoutReelEtPrevuTTCParTheme,
  getTauxExecutionParTheme,
  getCoutsThemesOuFormations,
  getUpcomingFormationsByProgramme,
  getTauxExecutionParMois,
  
} from '../controllers/formationController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateFormation.js';


const router = express.Router();

// CRUD
router.post('/', authentificate, validateFields, createFormation);
router.put('/:id', authentificate, validateFields, updateFormation);
router.delete('/:id', authentificate, deleteFormation);

// GET
router.get('/', authentificate, getFormations);
router.get('/filtre', authentificate, getFilteredFormations);
router.get('/calendrier', authentificate, getFormationsForGantt);
router.get('/dropdown/programme/:programmeId', authentificate, getFormationsForDropdown);
router.get('/:id', authentificate, getFormationById);
router.get('/formations-a-venir/:programmeId', getUpcomingFormationsByProgramme)

// Famille métier
router.patch('/:idFormation/ajouter-famille-metier/:idFamilleMetier', authentificate, ajouterFamilleMetierAFormation);
router.patch('/:idFormation/supprimer-famille-metier/:idFamilleMetier', authentificate, supprimerFamilleMetierDeFormation);

//Statistiques
// 1. Statistiques globales participants (sexe, âge, service, catégorie pro) filtré par programme ou thème
router.get('/stats/participants', getAllStatsParticipantsFormation);

// 2. Nombre de formateurs par type (interne/externe), filtré par programme ou formation
router.get('/stats/formateurs', getNbFormateursParType);

// 3. Taux d’exécution des tâches par thème, filtré par formation ou programme
router.get('/stats/taux-execution/themes', getTauxExecutionParTheme);

// 4. Taux d’exécution global et par axe stratégique, filtré par formation ou programme
router.get('/stats/taux-execution/axes', getTauxExecutionParAxeStrategique);

// 5. Coût réel TTC par thème, filtré par programme ou formation
router.get('/stats/cout-reel-ttc/themes', getCoutReelTTCParTheme);

// 6. Coût réel TTC et coût prévu TTC par thème, filtré par programme ou formation
router.get('/stats/cout-reel-prevu-ttc/themes', getCoutReelEtPrevuTTCParTheme);

// routes/stats.routes.js
router.get('/stats/couts-reel-prevu', getCoutsThemesOuFormations);

//Taux execution par mois
router.get('/stats/taux-execution-mois/:programmeId', getTauxExecutionParMois)


//execution
router.get('/programme/taux-execution/:programmeId/themes', authentificate, getThemesExecutionParProgramme);
router.get('/periode/taux-execution/themes', authentificate, getThemesExecutionParPeriode);
router.get('/axe-strategique/taux-execution/:axeId/themes', authentificate, getThemesExecutionParAxeStrategique);
router.get('/recherche/taux-execution/themes', authentificate, searchThemesExecutionParFormation);
export default router;
