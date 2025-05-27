import express from 'express';
import {
  createCommune,
  updateCommune,
  deleteCommune,
  getCommunes,
  getCommuneById,
  searchCommunesByNameOrCode,
  getCommunesByDepartement
} from '../controllers/communeController.js';
import { validateFields } from '../middlewares/validateFields/validateCommune.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createCommune);
router.put('/:id', validateFields, authenticate, updateCommune);
router.delete('/:id', authenticate, deleteCommune);
router.get('/', authenticate, getCommunes);
router.get('/search/by-name-or-code', authenticate, searchCommunesByNameOrCode);
router.get('/departement/:departementId', authenticate, getCommunesByDepartement);
router.get('/:id', authenticate, getCommuneById);

export default router;
