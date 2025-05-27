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
import { authenticate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateAxeStrategique.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();

router.post('/',validateFields,authenticate,createAxeStrategique);
router.put('/:id',validateFields,authenticate,updateAxeStrategique);
router.delete('/:id',authenticate,deleteAxeStrategique);
router.get('/',authenticate,getAxesStrategique);
router.get('/:id',authenticate,getAxeStrategiqueById);
router.get('/dropdown/all',authenticate, getAxesStrategiqueForDropdown);
router.get('/search/by-name',authenticate, searchAxeStrategiqueByName);


export default router;
