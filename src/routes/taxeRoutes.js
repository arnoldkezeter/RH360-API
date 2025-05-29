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
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createTaxe);
router.put('/:id', validateFields, authentificate, updateTaxe);
router.delete('/:id', authentificate, deleteTaxe);
router.get('/', authentificate, getTaxes);
router.get('/search/by-nature', authentificate, searchTaxesByNature);
router.get('/:id', authentificate, getTaxeById);

export default router;
