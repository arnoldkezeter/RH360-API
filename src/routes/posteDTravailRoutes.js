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
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', validateFields, authenticate, createPosteDeTravail);
router.put('/:id', validateFields, authenticate, updatePosteDeTravail);
router.delete('/:id', authenticate, deletePosteDeTravail);
router.get('/', authenticate, getPostesDeTravail);
router.get('/search/by-name', authenticate, searchPostesDeTravailByName);
router.get('/familleMetier/:familleMetierId', authenticate, getPostesByFamilleMetier);
router.get('/:id', authenticate, getPosteDeTravailById);

export default router;
