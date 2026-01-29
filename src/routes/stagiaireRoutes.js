import express from 'express';
import { 
    createStagiaire, 
    updateStagiaire, 
    deleteStagiaire, 
    getStagiaires, 
    updatePassword,
    saveManyStagiaires,
    getStagiairesByEtablissements
} from '../controllers/stagiaireController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStagiaire.js';

const router = express.Router();

router.post('/save-many', saveManyStagiaires)
router.post('/', authentificate, validateFields, createStagiaire);
router.put('/:id', authentificate, validateFields, updateStagiaire);
router.delete('/:id', authentificate, deleteStagiaire);
router.put('/:id/password', authentificate, updatePassword);
router.get('/by-etablissements', getStagiairesByEtablissements);

router.get('/', authentificate, getStagiaires);


export default router;
