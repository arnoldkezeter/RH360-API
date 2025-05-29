// routes/historiqueActionRoutes.js
import express from 'express';
import { createHistoriqueAction, getHistoriqueActions, getHistoriqueByUtilisateur } from '../controllers/historiqueActionController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateHistorique.js';


const router = express.Router();

router.post('/', validateFields, authentificate, createHistoriqueAction);
router.get('/', authentificate, getHistoriqueActions);
router.get('/utilisateur/:id', authentificate, getHistoriqueByUtilisateur);

export default router;
