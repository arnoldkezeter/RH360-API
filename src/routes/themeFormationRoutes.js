import express from 'express';
import {
  createThemeFormation,
  updateThemeFormation,
  deleteThemeFormation,
  ajouterFormateur,
  supprimerFormateur,
  
  getThemeFormationsForDropdown,
  getThemesByFamilleMetier,
  getFilteredThemes,
} from '../controllers/themeFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateTheme.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();

router.post('/', validateFields, authentificate, createThemeFormation);

router.put('/:id', validateFields, authentificate, updateThemeFormation);

router.delete('/:id', authentificate, deleteThemeFormation);
router.get('/filtre', authentificate, getFilteredThemes);


router.put('/:id/formateur', authentificate, ajouterFormateur);
router.delete('/:id/formateur/:formateurId', authentificate, supprimerFormateur);

router.get('/dropdown/formation/:formationId', authentificate, getThemeFormationsForDropdown);

router.get('/famille-metier', authentificate, getThemesByFamilleMetier);

export default router;
