import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createSupportFormation,
  updateSupportFormation,
  deleteSupportFormation,
  getSupportFormationById,
  telechargerSupportFormation,
  getFilteredSupportsFormation
} from '../controllers/supportFormationController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateSupport.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'public/uploads', 'supports');
    // Création du dossier à chaque upload si nécessaire
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


router.post('/', upload.single('fichier'), authentificate, validateFields,  createSupportFormation);
router.put('/:id', upload.single('fichier'), authentificate, validateFields,  updateSupportFormation);
router.delete('/:id', authentificate, deleteSupportFormation);
router.get('/', authentificate, getFilteredSupportsFormation);
router.get('/:id', authentificate, getSupportFormationById);
router.get('/telecharger/:id', authentificate, telechargerSupportFormation);

export default router;
