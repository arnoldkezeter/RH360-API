import express from 'express';
import {
    createTacheGenerique,
    updateTacheGenerique,
    deleteTacheGenerique,
    getTachesGeneriquesPagines,
    getTachesGeneriquesDropdown,
    getTacheGeneriqueById,
    searchTachesGeneriques,
} from '../controllers/tacheGeneriqueController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateTacheGenerique.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createTacheGenerique);
router.put('/:id', authentificate, validateFields, updateTacheGenerique);
router.delete('/:id', authentificate, deleteTacheGenerique);

router.get('/', authentificate, getTachesGeneriquesPagines);
router.get('/dropdown', authentificate, getTachesGeneriquesDropdown);
router.get('/search/by-title', authentificate, searchTachesGeneriques);
router.get('/:id', authentificate, getTacheGeneriqueById);

export default router;
