import express from 'express';
import {
  createAxeStrategique,
  updateAxeStrategique,
  deleteAxeStrategique,
  getAxesStrategique,
  getAxeStrategiqueById,
  searchAxeStrategiqueByName,
  getAxesStrategiqueForDropdown,
} from '../controllers/axeStrategiqueController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateAxeStrategique.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();

router.post('/',authentificate,validateFields,createAxeStrategique);
router.put('/:id',authentificate,validateFields,updateAxeStrategique);
router.delete('/:id',authentificate,deleteAxeStrategique);
router.get('/',authentificate,getAxesStrategique);
router.get('/:id',authentificate,getAxeStrategiqueById);
router.get('/dropdown/all',authentificate, getAxesStrategiqueForDropdown);
router.get('/search/by-name',authentificate, searchAxeStrategiqueByName);


export default router;
