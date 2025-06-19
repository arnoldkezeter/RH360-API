import express from 'express';
import {
  createFormation,
  updateFormation,
  deleteFormation,
  getFilteredFormations,
  getFormations,
  getFormationById,
  getFormationsByFamilleMetier,
  ajouterFamilleMetierAFormation,
  supprimerFamilleMetierDeFormation,
  getFormationsForDropdown,

  searchFormationByTitre,
  getStatsParSexe,
  getStatsParService,
  getStatsParTrancheAge,
  getStatsParCategoriePro,
  getNombreTotalFormes,
  getNbFormateursParType,
  getCoutsParThemePourFormation,
  getTauxExecutionParThemePourFormation,
  getThemesExecutionParProgramme,
  getThemesExecutionParPeriode,
  getThemesExecutionParAxeStrategique,
  searchThemesExecutionParFormation,
  
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
router.get('/dropdown', authentificate, getFormationsForDropdown);
router.get('/:id', authentificate, getFormationById);
router.get('/search/by-titre', authentificate, searchFormationByTitre);
router.get('/familleMetier/:id', authentificate, getFormationsByFamilleMetier);

// Famille métier
router.patch('/:idFormation/ajouter-famille-metier/:idFamilleMetier', authentificate, ajouterFamilleMetierAFormation);
router.patch('/:idFormation/supprimer-famille-metier/:idFamilleMetier', authentificate, supprimerFamilleMetierDeFormation);

//Statistiques
router.get('/statistiques/sexe/:id', authentificate, getStatsParSexe);
router.get('/statistiques/service/:id', authentificate, getStatsParService);
router.get('/statistiques/tranche-age/:id', authentificate, getStatsParTrancheAge);
router.get('/statistiques/categorie-professionnelle/:id', authentificate, getStatsParCategoriePro);
router.get('/statistiques/total-formes/:id', authentificate, getNombreTotalFormes);
router.get('/statistiques/formateurs-par-type/:id', authentificate, getNbFormateursParType);
router.get('/statistiques/depense-par-theme/:id', authentificate, getCoutsParThemePourFormation);
router.get('/statistiques/execution-par-theme/:id', authentificate, getTauxExecutionParThemePourFormation);

//execution
router.get('/programme/taux-execution/:programmeId/themes', authentificate, getThemesExecutionParProgramme);
router.get('/periode/taux-execution/themes', authentificate, getThemesExecutionParPeriode);
router.get('/axe-strategique/taux-execution/:axeId/themes', authentificate, getThemesExecutionParAxeStrategique);
router.get('/recherche/taux-execution/themes', authentificate, searchThemesExecutionParFormation);
export default router;
