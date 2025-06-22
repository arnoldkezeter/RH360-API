import express from 'express';
import {
  ajouterObjectif,
  supprimerObjectif,
  getObjectifsByTheme,
  modifierObjectif,
  getObjectifsDropdown,
} from '../controllers/objectifThemeController.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();


router.post('/:themeId/objectif', authentificate, ajouterObjectif);
router.put('/:themeId/objectif/:objectifId', authentificate, modifierObjectif);
router.delete('/:themeId/objectif/:objectifId', authentificate, supprimerObjectif);
router.get('/filtre/:themeId', authentificate, getObjectifsByTheme);
router.get('/dropdown/all/:themeId', authentificate, getObjectifsDropdown);


export default router;
