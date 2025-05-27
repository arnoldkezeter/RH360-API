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
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createCohorte);
router.put('/:id', validateFields, authenticate, updateCohorte);
router.delete('/:id', authenticate, deleteCohorte);
router.post('/:id/utilisateurs', authenticate, addUserToCohorte);
router.get('/', authenticate, getCohortes);
router.get('/:id', authenticate, getCohorteById);
router.get('/search/by-name', authenticate, searchCohorteByName);
router.get('/dropdown/all', authenticate, getCohortesForDropdown);

export default router;
