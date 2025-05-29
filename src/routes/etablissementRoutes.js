import express from 'express';
import { createEtablissement, 
    deleteEtablissement, 
    getEtablissementById, 
    getEtablissements, 
    getEtablissementsForDropdown, 
    searchEtablissementByName, 
    updateEtablissement } from "../controllers/etablissementController.js";
import { authentificate } from "../middlewares/auth.js";
import { validateFields } from "../middlewares/validateFields/validateEtablissement.js";

const router = express.Router();

router.post('/', validateFields, authentificate, createEtablissement);
router.put('/:id', validateFields, authentificate, updateEtablissement);
router.delete('/:id', authentificate, deleteEtablissement);
router.get('/', authentificate, getEtablissements);
router.get('/dropdown/all', authentificate, getEtablissementsForDropdown);
router.get('/search/by-name', authentificate, searchEtablissementByName);
router.get('/:id', authentificate, getEtablissementById);

export default router;