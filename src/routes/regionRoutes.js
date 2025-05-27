import express from 'express';
import { body } from 'express-validator';
import {
  createRegion,
  updateRegion,
  deleteRegion,
  getRegions,
  getRegionById,
  searchRegionsByNameOrCode
} from '../controllers/regionController.js';
import { validateFields } from '../middlewares/validateFields/validateRegion.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate,createRegion);
router.put('/:id', validateFields, authenticate, updateRegion);
router.delete('/:id', authenticate, deleteRegion);
router.get('/', authenticate, getRegions);
router.get('/search/by-name-or-code', authenticate, searchRegionsByNameOrCode);
router.get('/:id', authenticate, getRegionById);

export default router;