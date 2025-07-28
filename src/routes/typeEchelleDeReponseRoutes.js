import express from 'express';

import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateTypeEchelleReponse.js';
import { createTypeEchelleReponse, deleteTypeEchelleReponse, getTypeEchelleReponseById, getTypeEchelleReponses, getTypeEchelleReponsesForDropdown, updateTypeEchelleReponse } from '../controllers/typeEchelleDeReponseController.js';

// import hasPermission from '../middlewares/hasPermission.js'; // À prévoir

const router = express.Router();

router.post('/',authentificate,validateFields,createTypeEchelleReponse);
router.put('/:id',authentificate,validateFields,updateTypeEchelleReponse);
router.delete('/:id',authentificate,deleteTypeEchelleReponse);
router.get('/',authentificate,getTypeEchelleReponses);
router.get('/:id',authentificate,getTypeEchelleReponseById);
router.get('/dropdown/all',authentificate, getTypeEchelleReponsesForDropdown);


export default router;
