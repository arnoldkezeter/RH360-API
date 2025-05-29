import express from 'express';
import {
  createThemeFormation,
  updateThemeFormation,
  deleteThemeFormation,
  ajouterPublicCible,
  supprimerPublicCible,
  ajouterFormateur,
  supprimerFormateur,
  ajouterLieuFormation,
  supprimerLieuFormation,
  getThemeFormationsForDropdown,
  getThemesByFamilleMetier,
} from '../controllers/themeFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateTheme.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();

router.post('/', validateFields, authentificate, createThemeFormation);

router.put('/:id', validateFields, authentificate, updateThemeFormation);

router.delete('/:id', authentificate, deleteThemeFormation);

router.put('/:id/publicCible', authentificate, ajouterPublicCible);
router.delete('/:id/publicCible/:publicCibleId', authentificate, supprimerPublicCible);

router.put('/:id/formateur', authentificate, ajouterFormateur);
router.delete('/:id/formateur/:formateurId', authentificate, supprimerFormateur);

router.put('/:id/lieu', authentificate, ajouterLieuFormation);
router.delete('/:id/lieu/:lieuId', authentificate, supprimerLieuFormation);

router.get('/dropdown/all', authentificate, getThemeFormationsForDropdown);

router.get('/famille-metier', authentificate, getThemesByFamilleMetier);

export default router;
