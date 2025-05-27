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
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate,createFamilleMetier);
router.put('/:id', validateFields, authenticate, updateFamilleMetier);
router.delete('/:id', authenticate, deleteFamilleMetier);
router.get('/', authenticate, getFamillesMetier);
router.get('/dropdown/all', authenticate, getFamillesMetierForDropdown);
router.get('/search/by-name', authenticate, searchFamilleMetierByName);
router.get('/:id', authenticate, getFamilleMetierById);

export default router;
