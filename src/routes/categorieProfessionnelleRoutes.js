import express from 'express';
import { body } from 'express-validator';
import {
  createCategorieProfessionnelle,
  updateCategorieProfessionnelle,
  deleteCategorieProfessionnelle,
  getCategoriesProfessionnelles,
  getCategorieProfessionnelleById,
  searchCategoriesProfessionnellesByName,
  getCategoriesByGrade
} from '../controllers/categorieProfessionnelleController.js';
import { validateFields } from '../middlewares/validateFields/validateCategorieProfessionnelle.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createCategorieProfessionnelle);
router.put('/:id', validateFields, authenticate, updateCategorieProfessionnelle);
router.delete('/:id', authenticate, deleteCategorieProfessionnelle);
router.get('/', authenticate, getCategoriesProfessionnelles);
router.get('/search/by-name', authenticate, searchCategoriesProfessionnellesByName);
router.get('/:id', authenticate, getCategorieProfessionnelleById);
router.get('/grade/:gradeId', authenticate, getCategoriesByGrade);

export default router;
