import express from 'express';
import { body } from 'express-validator';
import {
  createDepartement,
  updateDepartement,
  deleteDepartement,
  getDepartements,
  getDepartementById,
  searchDepartementsByNameOrCode,
  getDepartementsByRegion
} from '../controllers/departementController.js';
import { validateFields } from '../middlewares/validateFields/validateDepartement.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createDepartement);
router.put('/:id', validateFields, authentificate, updateDepartement);
router.delete('/:id', authentificate, deleteDepartement);
router.get('/', authentificate, getDepartements);
router.get('/search/by-name-or-code', authentificate, searchDepartementsByNameOrCode);
router.get('/region/:regionId', authentificate, getDepartementsByRegion);
router.get('/:id', authentificate, getDepartementById);

export default router;
