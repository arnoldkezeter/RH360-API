import express from 'express';
import {
  ajouterLieuFormation,
  supprimerLieuFormation,
  getLieuxFormation,
  modifierLieuFormation,
  getLieuxDropdown,
} from '../controllers/lieuFormationController.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();


router.post('/:themeId/lieu', authentificate, ajouterLieuFormation);
router.put('/:themeId/lieu/:lieuId', authentificate, modifierLieuFormation);
router.delete('/:themeId/lieu/:lieuId', authentificate, supprimerLieuFormation);
router.get('/filtre/:themeId', authentificate, getLieuxFormation);
router.get('/dropdown/all/:themeID', authentificate, getLieuxDropdown);


export default router;
