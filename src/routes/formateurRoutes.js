import express from 'express';
import {
  ajouterFormateur,
  supprimerFormateur,
  getFormateursByTheme,
  modifierFormateur,
  getFormateursDropdown,
} from '../controllers/formateurController.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();


router.post('/:themeId/formateur', authentificate, ajouterFormateur);
router.put('/:themeId/formateur/:formateurId', authentificate, modifierFormateur);
router.delete('/:themeId/formateur/:formateurId', authentificate, supprimerFormateur);
router.get('/filtre/:themeId', authentificate, getFormateursByTheme);
router.get('/dropdown/all/:themeId', authentificate, getFormateursDropdown);


export default router;
