// routes/besoinsAjouteRoutes.js
import express from 'express';
import {
  createBesoinAjoute,
  updateBesoinAjoute,
  deleteBesoinAjoute,
  getBesoinsByUser,
  getAllBesoinsAjoutes,
  getStatutBesoinsAjoutes,
  validateBesoinAjoute,
  getRepartitionBesoinsParPoste,
  getGroupedBesoinsAjoutes
} from '../controllers/besoinAjoutUtilisateurController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateAjoutBesoinUtilisateur.js';

const router = express.Router();

// CRUD
router.post('/', authentificate, validateFields, createBesoinAjoute);
router.put('/:id', authentificate, validateFields, updateBesoinAjoute);
router.delete('/:id', authentificate, deleteBesoinAjoute);

// Récupérer besoins ajoutés par utilisateur
router.get('/utilisateur/:utilisateurId', authentificate, getBesoinsByUser);

// Récupérer tous les besoins ajoutés (admin)
router.get('/', authentificate, getAllBesoinsAjoutes);

// Statuts des besoins ajoutés
router.get('/stats/statuts', authentificate, getStatutBesoinsAjoutes);
router.get('/stats/besoins-ajoutes-poste', authentificate, getRepartitionBesoinsParPoste)
router.get('/stats/besoins-ajoutes-grouped', authentificate, getGroupedBesoinsAjoutes)

// Validation par admin
router.put('/valider/:id', authentificate, validateBesoinAjoute);

export default router;
