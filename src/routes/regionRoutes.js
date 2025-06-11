import express from 'express';
import { body } from 'express-validator';
import {
  createRegion,
  updateRegion,
  deleteRegion,
  getRegions,
  getRegionById,
  searchRegionsByNameOrCode,
  getRegionsForDropdown
} from '../controllers/regionController.js';
import { validateFields } from '../middlewares/validateFields/validateRegion.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createRegion);
router.put('/:id', authentificate, validateFields, updateRegion);
router.delete('/:id', authentificate, deleteRegion);
router.get('/', authentificate, getRegions);
router.get('/search/by-name-or-code', authentificate, searchRegionsByNameOrCode);
router.get('/:id', authentificate, getRegionById);
router.get('/dropdown/all', authentificate, getRegionsForDropdown);

export default router;