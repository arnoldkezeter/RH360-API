import express from 'express';
import {
  ajouterEchelleReponse,
  supprimerEchelleReponse,
  getEchelleReponsesByType,
  modifierEchelleReponse,
  getEchelleReponsesDropdown,
  getGroupedEchelleReponsesByType,
} from '../controllers/echelleDeReponseController.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();


router.post('/:typeId', authentificate, ajouterEchelleReponse);
router.put('/:typeId/:echelleReponseId', authentificate, modifierEchelleReponse);
router.delete('/:echelleReponseId', authentificate, supprimerEchelleReponse);
router.get('/filtre/:typeId', authentificate, getEchelleReponsesByType);
router.get('/dropdown/all/:typeId', authentificate, getEchelleReponsesDropdown);
router.get('/grouped-by-type', authentificate, getGroupedEchelleReponsesByType);


export default router;
