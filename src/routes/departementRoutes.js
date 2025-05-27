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
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createDepartement);
router.put('/:id', validateFields, authenticate, updateDepartement);
router.delete('/:id', authenticate, deleteDepartement);
router.get('/', authenticate, getDepartements);
router.get('/search/by-name-or-code', authenticate, searchDepartementsByNameOrCode);
router.get('/region/:regionId', authenticate, getDepartementsByRegion);
router.get('/:id', authenticate, getDepartementById);

export default router;
