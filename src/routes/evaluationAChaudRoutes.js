// routes/evaluationAChaud.js (ou similaire)
import express from 'express';
import {createEvaluationAChaud, 
        deleteEvaluationAChaud, 
        dropdownEvaluationAChaud, 
        getEvaluationAChaudById, 
        getEvaluationsChaudByUtilisateur, 
        getFilteredEvaluation, 
        listEvaluationAChaud, 
        updateEvaluationAChaud} from '../controllers/evaluationAChaudController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateEvaluation.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createEvaluationAChaud);
router.put('/:id', authentificate, validateFields, updateEvaluationAChaud);
router.delete('/:id', authentificate, deleteEvaluationAChaud);
router.get('/', getFilteredEvaluation);
router.get('/dropdown/all', authentificate, dropdownEvaluationAChaud);
router.get('/:id', authentificate, getEvaluationAChaudById);
router.get('/user-evaluations/:utilisateurId', authentificate, getEvaluationsChaudByUtilisateur)



export default router;
