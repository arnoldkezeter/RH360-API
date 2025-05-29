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
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();
// Routes
router.post('/', validateFields, authentificate, createCompetence);
router.put('/:id', validateFields, authentificate, updateCompetence);
router.delete('/:id', authentificate, deleteCompetence);
router.get('/',authentificate, getCompetences);
router.get('/dropdown/all',authentificate, getCompetencesForDropdown);
router.get('/:id',authentificate, getCompetenceById);
router.get('/search/by-name',authentificate, searchCompetenceByName);


export default router;
