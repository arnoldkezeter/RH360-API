import express from 'express';
import { getTdrPrefill, genererTdr } from '../controllers/tdrController.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

// Pré-remplissage du formulaire TDR
router.get('/:themeId/prefill', authentificate, getTdrPrefill);

// Génération du PDF TDR + persistance BD
router.post('/:themeId', authentificate, genererTdr);

export default router;