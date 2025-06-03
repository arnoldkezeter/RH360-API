import express from 'express';
import {
  createBesoinFormationExprime,
  updateBesoinFormationExprime,
  deleteBesoinFormationExprime,
  getBesoinsExprimes,
  getBesoinExprimeById,
  validerEtPrioriserBesoinExprime,
  getTotalBesoinsExprimes,
  getTotalBesoinsPrioriteHaute,
  getTopFamillesMetier,
  getBesoinsLesPlusDemandes,
  getHistogrammeBesoinsParFamille,
  getHistogrammeDemandesParBesoin,
  getDernieresDemandesFiltrees
} from '../controllers/besoinFormationExprimeController.js';
import { body } from 'express-validator';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateBesoinFormationExprime.js';

const router = express.Router();


router.post('/', authentificate, validateFields, createBesoinFormationExprime);
router.put('/:id', authentificate, updateBesoinFormationExprime);
router.delete('/:id', authentificate, deleteBesoinFormationExprime);

// Récupération
router.get('/', authentificate, getBesoinsExprimes);
router.get('/:id', authentificate, getBesoinExprimeById);

// Validation & priorisation
router.put('/:id/valider', authentificate, validerEtPrioriserBesoinExprime);

// Statistiques
router.get('/statistiques/total', authentificate, getTotalBesoinsExprimes);
router.get('/statistiques/priorite-haute', authentificate, getTotalBesoinsPrioriteHaute);
router.get('/statistiques/top-familles', authentificate, getTopFamillesMetier);
router.get('/statistiques/besoins-demandes', authentificate, getBesoinsLesPlusDemandes);
router.get('/statistiques/histogramme-par-famille', authentificate, getHistogrammeBesoinsParFamille);
router.get('/statistiques/histogramme-par-besoin', authentificate, getHistogrammeDemandesParBesoin);
router.get('/filtrage/dernieres-demandes', authentificate, getDernieresDemandesFiltrees);

export default router;
