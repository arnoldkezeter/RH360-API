import express from 'express';
import {
  getBesoinsParPosteDeTravail,
  getBesoinsParFamilleMetier,
  createBesoinFormationPredefini,
  updateBesoinFormationPredefini,
  deleteBesoinFormationPredefini,
  getBesoinsFormationPredefinis,
  getBesoinFormationPredefiniById,
  getBesoinsFormationPredefinisForDropdown,
  searchBesoinFormationPredefiniByTitre
} from '../controllers/besoinFormationPredefiniController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateBesoinFormationPredefini.js';

const router = express.Router();

// CRUD
router.post('/', authentificate, validateFields, createBesoinFormationPredefini);
router.put('/:id', authentificate, validateFields, updateBesoinFormationPredefini);
router.delete('/:id', authentificate, deleteBesoinFormationPredefini);
router.get('/', authentificate, getBesoinsFormationPredefinis);
router.get('/:id', authentificate, getBesoinFormationPredefiniById);

// Recherche
router.get('/search/by-title', authentificate, searchBesoinFormationPredefiniByTitre);

// Menu déroulant
router.get('/dropdown/list', authentificate, getBesoinsFormationPredefinisForDropdown);

// Besoins par poste de travail
router.get('/poste/:posteId', authentificate, getBesoinsParPosteDeTravail);

// Besoins par famille métier
router.get('/famille-metier/:familleMetierId', authentificate, getBesoinsParFamilleMetier);

export default router;
