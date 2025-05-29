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
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createService);
router.put('/:id', validateFields, authentificate, updateService);
router.delete('/:id', authentificate, deleteService);
router.get('/', authentificate, getServices);
router.get('/search/by-name', authentificate, searchServicesByName);
router.get('/structure/:structureId', authentificate, getServicesByStructure);
router.get('/:id', authentificate, getServiceById);

export default router;
