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
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createCategorieProfessionnelle);
router.put('/:id',  authentificate, validateFields, updateCategorieProfessionnelle);
router.delete('/:id', authentificate, deleteCategorieProfessionnelle);
router.get('/', authentificate, getCategoriesProfessionnelles);
router.get('/search/by-name', authentificate, searchCategoriesProfessionnellesByName);
router.get('/:id', authentificate, getCategorieProfessionnelleById);
router.get('/grade/:gradeId', authentificate, getCategoriesByGrade);

export default router;
