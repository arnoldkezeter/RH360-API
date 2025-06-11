import express from 'express';
import {
  createCompetence,
  updateCompetence,
  deleteCompetence,
  getCompetences,
  getCompetenceById,
  getCompetencesForDropdown,
  searchCompetenceByName,
  getCompetenceByFamille
} from '../controllers/competenceController.js';
import { validateFields } from '../middlewares/validateFields/validateCompetence.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();
// Routes
router.post('/', authentificate, validateFields, createCompetence);
router.put('/:id', authentificate, validateFields, updateCompetence);
router.delete('/:id', authentificate, deleteCompetence);
router.get('/',authentificate, getCompetences);
router.get('/dropdown/all',authentificate, getCompetencesForDropdown);
router.get('/:id',authentificate, getCompetenceById);
router.get('/search/by-name',authentificate, searchCompetenceByName);
router.get('/famille-metier/:familleId',authentificate, getCompetenceByFamille);


export default router;
