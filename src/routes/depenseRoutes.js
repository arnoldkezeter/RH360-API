import express from 'express';
import { createDepense, getFilteredDepenses, updateDepense, deleteDepense, generateBudgetPDF } from '../controllers/depenseController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateNatureDepense } from '../middlewares/validateFields/validateBudgetFormation.js';


const router = express.Router();



router.post('/:budgetId',authentificate, validateNatureDepense, createDepense);
router.put('/:budgetId/depense/:id', authentificate, validateNatureDepense, updateDepense);
router.delete('/:id',authentificate, deleteDepense);
router.get('/filtre/:budgetId', authentificate, getFilteredDepenses);
router.get('/:budgetId/:userId/pdf', authentificate, generateBudgetPDF);



export default router;
