import express from 'express';
import {
  createObjectifTheme,
  updateObjectifTheme,
  deleteObjectifTheme,
  getObjectifsTheme,
  getObjectifThemeById,
  searchObjectifThemeByName,
  getObjectifsByTheme,
} from '../controllers/objectifThemeController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateObjectif.js';

const router = express.Router();


router.post('/',  validateFields, authentificate, createObjectifTheme);
router.put('/:id', validateFields, authentificate, updateObjectifTheme);
router.delete('/:id', authentificate, deleteObjectifTheme);
router.get('/', authentificate, getObjectifsTheme);
router.get('/:id', authentificate, getObjectifThemeById);
router.get('/search/by-name', authentificate, searchObjectifThemeByName);
router.get('/theme/:themeId', authentificate, getObjectifsByTheme);

export default router;
