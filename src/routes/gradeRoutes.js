// routes/gradeRoutes.js
import express from 'express';
import { body } from 'express-validator';
import {
  createGrade,
  updateGrade,
  deleteGrade,
  getGrades,
  getGradeById,
  getGradesForDropdown,
  searchGradesByName
} from '../controllers/gradeController.js';
import { validateFields } from '../middlewares/validateFields/validateGrade.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/',validateFields, authentificate,createGrade);
router.put('/:id',validateFields, authentificate, updateGrade);
router.delete('/:id', authentificate, deleteGrade);
router.get('/', authentificate, getGrades);
router.get('/dropdown', authentificate, getGradesForDropdown);
router.get('/search', authentificate, searchGradesByName);
router.get('/:id', authentificate, getGradeById);

export default router;
