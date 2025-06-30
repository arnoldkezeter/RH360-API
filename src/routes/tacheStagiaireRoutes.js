import express from 'express';
import {
  creerTache,
  modifierTache,
  supprimerTache,
  getFilteredTaches,
  statistiquesTaches,
} from '../controllers/tacheStagiaireController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateTacheStagiaire.js';

const router = express.Router();

router.post('/', authentificate, validateFields, creerTache);
router.put('/:tacheId', authentificate, validateFields, modifierTache);
router.delete('/:tacheId', authentificate, supprimerTache);
router.get('/:stagiaireId', authentificate, getFilteredTaches);
router.get('/statistiques/:stagiaireId', authentificate, statistiquesTaches);

export default router;
