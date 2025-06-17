// routes/utilisateurRoutes.js
import express from 'express';
import {
    createUtilisateur,
    updateUtilisateur,
    deleteUtilisateur,
    updatePassword,
    getUtilisateurs,
    getUtilisateursFiltres,
    searchUtilisateurs,
    getCurrentUserData,
} from '../controllers/utilisateurController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateUtilisateur.js';
import { validateFieldsPassword } from '../middlewares/validateFields/validateMotDePasse.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createUtilisateur);
router.put('/:id', validateFields, authentificate, updateUtilisateur);
router.delete('/:id', authentificate, deleteUtilisateur);
router.put('/:id/password', validateFieldsPassword, authentificate, updatePassword);
router.get('/', authentificate, getUtilisateurs);
router.get('/filtre', authentificate, getUtilisateursFiltres);
router.get('/search/by-name', authentificate, searchUtilisateurs);
router.get('/:id',getCurrentUserData)

export default router;
