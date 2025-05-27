import express from 'express';
import { body } from 'express-validator';
import {
  createService,
  updateService,
  deleteService,
  getServices,
  getServiceById,
  searchServicesByName,
  getServicesByStructure
} from '../controllers/serviceController.js';
import { validateFields } from '../middlewares/validateFields/validateService.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createService);
router.put('/:id', validateFields, authenticate, updateService);
router.delete('/:id', authenticate, deleteService);
router.get('/', authenticate, getServices);
router.get('/search/by-name', authenticate, searchServicesByName);
router.get('/structure/:structureId', authenticate, getServicesByStructure);
router.get('/:id', authenticate, getServiceById);

export default router;
