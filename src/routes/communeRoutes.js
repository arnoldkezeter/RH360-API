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
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createCommune);
router.put('/:id', validateFields, authentificate, updateCommune);
router.delete('/:id', authentificate, deleteCommune);
router.get('/', authentificate, getCommunes);
router.get('/search/by-name-or-code', authentificate, searchCommunesByNameOrCode);
router.get('/departement/:departementId', authentificate, getCommunesByDepartement);
router.get('/:id', authentificate, getCommuneById);

export default router;
