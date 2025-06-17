import express from 'express';
import { 
    createStagiaire, 
    updateStagiaire, 
    deleteStagiaire, 
    getStagiaires, 
    updatePassword
} from '../controllers/stagiaireController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStagiaire.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createStagiaire);
router.put('/:id', authentificate, validateFields, updateStagiaire);
router.delete('/:id', authentificate, deleteStagiaire);
router.put('/:id/password', authentificate, updatePassword);
router.get('/', authentificate, getStagiaires);

export default router;
