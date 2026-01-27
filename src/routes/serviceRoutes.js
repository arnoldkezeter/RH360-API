import express from 'express';
import { body } from 'express-validator';
import {
  createService,
  updateService,
  deleteService,
  getServices,
  getServiceById,
  searchServicesByName,
  getServicesByStructure,
  getServicesForDropdown,
  getServicesForDropdownByStructure,
  getFilteredServicesByStructure
} from '../controllers/serviceController.js';
import { validateFields } from '../middlewares/validateFields/validateService.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createService); //Enregistrer un service
router.put('/:id', validateFields, authentificate, updateService); //Modifier un service
router.delete('/:id', authentificate, deleteService); //Supprimer un service
router.get('/structures/:structureId/services', getFilteredServicesByStructure);
router.get('/dropdown/all', authentificate, getServicesForDropdown); //Récupéré les services pour le dropdown
router.get('/dropdown/structure/:structureId', authentificate, getServicesForDropdownByStructure); //Récupéré les services pour le dropdown par structure
router.get('/search/by-name', authentificate, searchServicesByName); // Rechercher un service par son nom
router.get('/structure/:structureId', authentificate, getServicesByStructure); //Récupéré la liste des service par structure
router.get('/:id', authentificate, getServiceById); //Récupéré un service via son id
router.get('/', authentificate, getServices); //Liste des services avec pagination

export default router;
