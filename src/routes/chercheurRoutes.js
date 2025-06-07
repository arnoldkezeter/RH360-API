import express from 'express';
import { body } from 'express-validator';
import { 
    createChercheur, 
    updateChercheur, 
    deleteChercheur, 
    updatePassword, 
    getChercheurs 
} from '../controllers/chercheurController.js';
import { validateFields } from '../middlewares/validateFields/validateChercheur.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFieldsPassword } from '../middlewares/validateFields/validateMotDePasse.js';

const router = express.Router();



// Routes CRUD pour les chercheurs
router.post('/', authentificate, validateFields, createChercheur);
router.put('/:id', authentificate, validateFields, updateChercheur);
router.delete('/:id', authentificate, deleteChercheur);
router.patch('/password/:id', authentificate, validateFieldsPassword, updatePassword);
router.get('/', authentificate, getChercheurs);

export default router;
