import express from 'express';
import {
  creerTache,
  modifierTache,
  supprimerTache,
  getTaches,
  statistiquesTaches,
} from '../controllers/tacheStagiaireController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateTacheStagiaire.js';

const router = express.Router();

router.post('/', authentificate, validateFields, creerTache);
router.put('/:tacheId', authentificate, validateFields, modifierTache);
router.delete('/:tacheId', authentificate, supprimerTache);
router.get('/', authentificate, getTaches);
router.get('/statistiques', authentificate, statistiquesTaches);

export default router;
