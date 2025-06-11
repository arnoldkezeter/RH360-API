import express from 'express';
import {
  createFamilleMetier,
  updateFamilleMetier,
  deleteFamilleMetier,
  getFamillesMetier,
  getFamilleMetierById,
  getFamillesMetierForDropdown,
  searchFamilleMetierByName
} from '../controllers/familleMetierController.js';
import { validateFields } from '../middlewares/validateFields/validateFamilleMetier.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields ,createFamilleMetier);
router.put('/:id', authentificate, validateFields, updateFamilleMetier);
router.delete('/:id', authentificate, deleteFamilleMetier);
router.get('/', authentificate, getFamillesMetier);
router.get('/dropdown/all', authentificate, getFamillesMetierForDropdown);
router.get('/search/by-name', authentificate, searchFamilleMetierByName);
router.get('/:id', authentificate, getFamilleMetierById);

export default router;
