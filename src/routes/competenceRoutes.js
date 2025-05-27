import express from 'express';
import {
  createCompetence,
  updateCompetence,
  deleteCompetence,
  getCompetences,
  getCompetenceById,
  getCompetencesForDropdown,
  searchCompetenceByName
} from '../controllers/competenceController.js';
import { validateFields } from '../middlewares/validateFields/validateCompetence.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();
// Routes
router.post('/', validateFields, authenticate, createCompetence);
router.put('/:id', validateFields, authenticate, updateCompetence);
router.delete('/:id', authenticate, deleteCompetence);
router.get('/',authenticate, getCompetences);
router.get('/dropdown/all',authenticate, getCompetencesForDropdown);
router.get('/:id',authenticate, getCompetenceById);
router.get('/search/by-name',authenticate, searchCompetenceByName);


export default router;
