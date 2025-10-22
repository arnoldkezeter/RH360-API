// routes/utilisateurRoutes.js
import express from 'express';
import {
    createUtilisateur,
    updateUtilisateur,
    deleteUtilisateur,
    updatePassword,
    getUtilisateurs,
    getUtilisateursFiltres,
    searchUtilisateurs,
    getCurrentUserData,
    updatePhotoProfil,
    supprimerPhotoProfil,
} from '../controllers/utilisateurController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateUtilisateur.js';
import { validateFieldsPassword } from '../middlewares/validateFields/validateMotDePasse.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'public/uploads', 'photos_profil');
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

// Vérifier que c’est une image
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont autorisées !'), false);
  }
};

const upload = multer({ storage, fileFilter });

router.post('/save-photo-profil/:userId', upload.single('image_profil'),  updatePhotoProfil);
router.post('/', validateFields, authentificate, createUtilisateur);
router.put('/:id', validateFields, authentificate, updateUtilisateur);
router.delete('/:utilisateurId/photo-profil', authentificate, supprimerPhotoProfil);
router.delete('/:id', authentificate, deleteUtilisateur);
router.put('/:id/password', validateFieldsPassword, authentificate, updatePassword);

router.get('/filtre', authentificate, getUtilisateursFiltres);
router.get('/search/by-name', authentificate, searchUtilisateurs);
router.get('/:userId',getCurrentUserData)
router.get('/', authentificate, getUtilisateurs);

export default router;
