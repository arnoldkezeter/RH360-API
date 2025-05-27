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
import { validateFields } from '../middlewares/validateFields/validateStructure.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();

// Créer une structure
router.post(
  '/',
  validateFields,
  authenticate,
//   hasPermission('structure:create'), // À activer dès que la gestion des permissions est prête
  createStructure
);

// Modifier une structure
router.put(
  '/:id',
  validateFields,
  authenticate,
//   hasPermission('structure:update'),
  updateStructure
);

// Supprimer une structure
router.delete(
  '/:id',
  authenticate,
//   hasPermission('structure:delete'),
  deleteStructure
);

// Obtenir la liste des structures (avec pagination)
router.get(
  '/',
  authenticate,
//   hasPermission('structure:read'),
  getStructures
);

// Obtenir une structure par ID
router.get(
  '/:id',
  authenticate,
//   hasPermission('structure:read'),
  getStructureById
);

//Obtenir la liste des structure (_id nomFr nomEn)
router.get('/dropdown/all',
    authenticate, 
    //   hasPermission('structure:search'),
    getStructuresForDropdown
);


//Rechercher
router.get('/search/by-name',
    authenticate, 
    //   hasPermission('structure:search'),
    searchStructureByName
);


export default router;
