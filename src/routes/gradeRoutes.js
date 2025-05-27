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
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/',validateFields, authenticate,createGrade);
router.put('/:id',validateFields, authenticate, updateGrade);
router.delete('/:id', authenticate, deleteGrade);
router.get('/', authenticate, getGrades);
router.get('/dropdown', authenticate, getGradesForDropdown);
router.get('/search', authenticate, searchGradesByName);
router.get('/:id', authenticate, getGradeById);

export default router;
