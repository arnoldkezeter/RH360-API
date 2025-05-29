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

// Créer une structure
router.post(
  '/',
  validateFields,
  authentificate,
//   hasPermission('structure:create'), // À activer dès que la gestion des permissions est prête
  createStructure
);

// Modifier une structure
router.put(
  '/:id',
  validateFields,
  authentificate,
//   hasPermission('structure:update'),
  updateStructure
);

// Supprimer une structure
router.delete(
  '/:id',
  authentificate,
//   hasPermission('structure:delete'),
  deleteStructure
);

// Obtenir la liste des structures (avec pagination)
router.get(
  '/',
  authentificate,
//   hasPermission('structure:read'),
  getStructures
);

// Obtenir une structure par ID
router.get(
  '/:id',
  authentificate,
//   hasPermission('structure:read'),
  getStructureById
);

//Obtenir la liste des structure (_id nomFr nomEn)
router.get('/dropdown/all',
    authentificate, 
    //   hasPermission('structure:search'),
    getStructuresForDropdown
);


//Rechercher
router.get('/search/by-name',
    authentificate, 
    //   hasPermission('structure:search'),
    searchStructureByName
);


export default router;
