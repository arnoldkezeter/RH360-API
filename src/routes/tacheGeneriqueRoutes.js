import express from 'express';
import {
    createTacheGenerique,
    updateTacheGenerique,
    deleteTacheGenerique,
    getTacheGeneriqueById,
    getTachesGeneriquesForDropdown,
    getTachesGeneriques,
    seedTachesGeneriques,
    getAllTachesGeneriques,
} from '../controllers/tacheGeneriqueController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateTacheGenerique.js';

const router = express.Router();

router.post('/seedTachesGeneriques', seedTachesGeneriques)
router.post('/', authentificate, validateFields, createTacheGenerique);
router.put('/:id', authentificate, validateFields, updateTacheGenerique);
router.delete('/:id', authentificate, deleteTacheGenerique);
router.get('/taches/all', getAllTachesGeneriques)
router.get('/', authentificate, getTachesGeneriques);
router.get('/dropdown/all', authentificate, getTachesGeneriquesForDropdown);
router.get('/:id', authentificate, getTacheGeneriqueById);

export default router;
