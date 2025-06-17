import express from 'express';
import { body } from 'express-validator';
import {
  createPosteDeTravail,
  updatePosteDeTravail,
  deletePosteDeTravail,
  getPostesDeTravail,
  getPosteDeTravailById,
  searchPostesDeTravailByName,
  getPostesByFamilleMetier,
  getPosteDeTravailsForDropdownByFamilleMetier
} from '../controllers/posteDeTravailController.js';
import { validateFields } from '../middlewares/validateFields/validatePosteDeTravail.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createPosteDeTravail);
router.put('/:id',  authentificate, validateFields, updatePosteDeTravail);
router.delete('/:id', authentificate, deletePosteDeTravail);
router.get('/', authentificate, getPostesDeTravail);
router.get('/search/by-name', authentificate, searchPostesDeTravailByName);
router.get('/famille-metier/:familleMetierId', authentificate, getPostesByFamilleMetier);
router.get('/:id', authentificate, getPosteDeTravailById);
router.get('/dropdown/famille-metier/:familleMetierId', authentificate, getPosteDeTravailsForDropdownByFamilleMetier);

export default router;
