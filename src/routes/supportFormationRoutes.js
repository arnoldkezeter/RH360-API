import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  createSupportFormation,
  updateSupportFormation,
  deleteSupportFormation,
  getSupportsFormation,
  getSupportFormationById,
  searchSupportFormationByTitle,
  getSupportsByTheme,
  telechargerSupportFormation
} from '../controllers/supportFormationController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateSupport.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/supports');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post('/', upload.single('fichier'), validateFields, authentificate, createSupportFormation);
router.put('/:id', upload.single('fichier'), validateFields, authentificate, updateSupportFormation);
router.delete('/:id', authentificate, deleteSupportFormation);
router.get('/', authentificate, getSupportsFormation);
router.get('/:id', authentificate, getSupportFormationById);
router.get('/search/by-title', authentificate, searchSupportFormationByTitle);
router.get('/theme/:themeId', authentificate, getSupportsByTheme);
router.get('/telecharger/:id', authentificate, telechargerSupportFormation);

export default router;
