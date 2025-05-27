import express from 'express';
import { createEtablissement, 
    deleteEtablissement, 
    getEtablissementById, 
    getEtablissements, 
    getEtablissementsForDropdown, 
    searchEtablissementByName, 
    updateEtablissement } from "../controllers/etablissementController.js";
import { authenticate } from "../middlewares/auth.js";
import { validateFields } from "../middlewares/validateFields/validateEtablissement.js";

const router = express.Router();

router.post('/', validateFields, authenticate, createEtablissement);
router.put('/:id', validateFields, authenticate, updateEtablissement);
router.delete('/:id', authenticate, deleteEtablissement);
router.get('/', authenticate, getEtablissements);
router.get('/dropdown/all', authenticate, getEtablissementsForDropdown);
router.get('/search/by-name', authenticate, searchEtablissementByName);
router.get('/:id', authenticate, getEtablissementById);

export default router;