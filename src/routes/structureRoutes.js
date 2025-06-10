import express from 'express';
import {
  createStructure,
  updateStructure,
  deleteStructure,
  getStructures,
  getStructureById,
  searchStructureByName,
  getStructuresForDropdown,
} from '../controllers/structureController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStructure.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();


router.post('/',authentificate, validateFields,  createStructure);// Créer une structure
router.put('/:id', authentificate,  validateFields, updateStructure);// Modifier une structure
router.delete('/:id', authentificate, deleteStructure);// Supprimer une structure
router.get('/', authentificate, getStructures);// Obtenir la liste des structures (avec pagination)
router.get('/:id', authentificate, getStructureById);// Obtenir une structure par ID
router.get('/dropdown/all', authentificate, getStructuresForDropdown);//Obtenir la liste des structure (_id nomFr nomEn)
router.get('/search/by-name', authentificate, searchStructureByName);//Rechercher


export default router;
