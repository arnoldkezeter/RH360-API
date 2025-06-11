import express from 'express';
import { body } from 'express-validator';
import {
  createDepartement,
  updateDepartement,
  deleteDepartement,
  getDepartements,
  getDepartementById,
  searchDepartementsByNameOrCode,
  getDepartementsByRegion,
  getDepartementsForDropdown
} from '../controllers/departementController.js';
import { validateFields } from '../middlewares/validateFields/validateDepartement.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createDepartement);
router.put('/:id', authentificate, validateFields, updateDepartement);
router.delete('/:id', authentificate, deleteDepartement);
router.get('/', authentificate, getDepartements);
router.get('/search/by-name-or-code', authentificate, searchDepartementsByNameOrCode);
router.get('/region/:regionId', authentificate, getDepartementsByRegion);
router.get('/:id', authentificate, getDepartementById);
router.get('/dropdown/all/:regionId', authentificate, getDepartementsForDropdown);

export default router;
