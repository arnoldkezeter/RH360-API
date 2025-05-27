import express from 'express';
import {
  createTaxe,
  updateTaxe,
  deleteTaxe,
  getTaxes,
  getTaxeById,
  searchTaxesByNature
} from '../controllers/taxeController.js';
import { validateFields } from '../middlewares/validateFields/validateTaxe.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createTaxe);
router.put('/:id', validateFields, authenticate, updateTaxe);
router.delete('/:id', authenticate, deleteTaxe);
router.get('/', authenticate, getTaxes);
router.get('/search/by-nature', authenticate, searchTaxesByNature);
router.get('/:id', authenticate, getTaxeById);

export default router;
