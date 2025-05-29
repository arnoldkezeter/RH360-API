import express from 'express';
import {
  createCohorte,
  updateCohorte,
  deleteCohorte,
  addUserToCohorte,
  getCohortes,
  getCohorteById,
  searchCohorteByName,
  getCohortesForDropdown,
} from '../controllers/cohorteController.js';

import { validateFields } from '../middlewares/validateFields/validateCohorte.js'; // si tu as un middleware de validation
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createCohorte);
router.put('/:id', validateFields, authentificate, updateCohorte);
router.delete('/:id', authentificate, deleteCohorte);
router.post('/:id/utilisateurs', authentificate, addUserToCohorte);
router.get('/', authentificate, getCohortes);
router.get('/:id', authentificate, getCohorteById);
router.get('/search/by-name', authentificate, searchCohorteByName);
router.get('/dropdown/all', authentificate, getCohortesForDropdown);

export default router;
