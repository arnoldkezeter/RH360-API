import express from 'express';
import {
  createCohorte,
  updateCohorte,
  deleteCohorte,
  getCohortes,
  getCohorteById,
  searchCohorteByName,
  getCohortesForDropdown,
  addUserToCohorte,
  removeUserFromCohorte,
  getUsersByCohorte,
  getCohortesByUser,
} from '../controllers/cohorteController.js';

import { validateFields } from '../middlewares/validateFields/validateCohorte.js'; // si tu as un middleware de validation
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createCohorte);
router.put('/:id', authentificate, validateFields, updateCohorte);
router.delete('/:id', authentificate, deleteCohorte);
router.get('/', authentificate, getCohortes);
router.get('/:id', authentificate, getCohorteById);
router.get('/search/by-name', authentificate, searchCohorteByName);
router.get('/dropdown/all', authentificate, getCohortesForDropdown);

/*Cohorte utilisateur*/
router.post('/utilisateur/ajouter', authentificate, addUserToCohorte);
router.delete('/:cohorteId/utilisateur', authentificate, removeUserFromCohorte);
router.get('/:cohorteId/utilisateurs', authentificate, getUsersByCohorte);
router.get('/utilisateurs/:utilisateurId/cohortes', authentificate, getCohortesByUser);

export default router;
