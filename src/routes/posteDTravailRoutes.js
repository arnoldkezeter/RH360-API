import express from 'express';
import { body } from 'express-validator';
import {
  createPosteDeTravail,
  updatePosteDeTravail,
  deletePosteDeTravail,
  getPostesDeTravail,
  getPosteDeTravailById,
  searchPostesDeTravailByName,
  getPostesByFamilleMetier
} from '../controllers/posteDeTravailController.js';
import { validateFields } from '../middlewares/validateFields/validatePosteDeTravail.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authentificate, createPosteDeTravail);
router.put('/:id', validateFields, authentificate, updatePosteDeTravail);
router.delete('/:id', authentificate, deletePosteDeTravail);
router.get('/', authentificate, getPostesDeTravail);
router.get('/search/by-name', authentificate, searchPostesDeTravailByName);
router.get('/familleMetier/:familleMetierId', authentificate, getPostesByFamilleMetier);
router.get('/:id', authentificate, getPosteDeTravailById);

export default router;
