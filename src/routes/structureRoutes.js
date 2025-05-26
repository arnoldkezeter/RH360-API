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
import { authenticate } from '../middlewares/auth.js';
import { validateStructure } from '../middlewares/fieldsValidation.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();

// Créer une structure
router.post(
  '/createStructure',
  validateStructure,
  authenticate,
//   hasPermission('structure:create'), // À activer dès que la gestion des permissions est prête
  createStructure
);

// Modifier une structure
router.put(
  '/updateStructure/:id',
  validateStructure,
  authenticate,
//   hasPermission('structure:update'),
  updateStructure
);

// Supprimer une structure
router.delete(
  '/deleteStructure/:id',
  authenticate,
//   hasPermission('structure:delete'),
  deleteStructure
);

// Obtenir la liste des structures (avec pagination)
router.get(
  '/getStructures',
  authenticate,
//   hasPermission('structure:read'),
  getStructures
);

// Obtenir une structure par ID
router.get(
  '/getStructureById/:id',
  authenticate,
//   hasPermission('structure:read'),
  getStructureById
);

//Obtenir la liste des structure (_id nomFr nomEn)
router.get('/getStructuresForDropdown',
    authenticate, 
    //   hasPermission('structure:search'),
    getStructuresForDropdown
);


//Rechercher
router.get('/search',
    authenticate, 
    //   hasPermission('structure:search'),
    searchStructureByName
);


export default router;
