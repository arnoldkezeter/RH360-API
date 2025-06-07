import express from 'express';
import { body } from 'express-validator';
import {
  createService,
  updateService,
  deleteService,
  getServices,
  getServiceById,
  searchServicesByName,
  getServicesByStructure
} from '../controllers/serviceController.js';
import { validateFields } from '../middlewares/validateFields/validateService.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createService); //Enregistrer un service
router.put('/:id', validateFields, authentificate, updateService); //Modifier un service
router.delete('/:id', authentificate, deleteService); //Supprimer un service
router.get('/', authentificate, getServices); //Liste des services avec pagination
router.get('/search/by-name', authentificate, searchServicesByName); // Rechercher un service par son nom
router.get('/structure/:structureId', authentificate, getServicesByStructure); //Récupéré la liste des service par structure
router.get('/:id', authentificate, getServiceById); //Récupéré un service via son id

export default router;
