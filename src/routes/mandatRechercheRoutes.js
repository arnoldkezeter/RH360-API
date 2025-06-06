import express from 'express';
import { createMandat, 
        deleteMandat, 
        getMandats, 
        searchMandatsByChercheur, 
        updateMandat } from "../controllers/mandatRechercheController.js";
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateMandat.js';


const router = express.Router();

router.post('/', authentificate, validateFields, createMandat);
router.put('/:id', authentificate, validateFields,updateMandat);
router.delete('/:id', authentificate, deleteMandat);
router.get('/', authentificate, getMandats);
router.get('/search/by-name-researcher', authentificate, searchMandatsByChercheur);

export default router;
