import express from 'express';
import { createDepense, getFilteredDepenses, updateDepense, deleteDepense, generateBudgetPDF, getThemeBudgetSummary } from '../controllers/depenseController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateNatureDepense } from '../middlewares/validateFields/validateBudgetFormation.js';


const router = express.Router();



router.post('/:themeFormationId',authentificate, validateNatureDepense, createDepense);
router.get('/filtre/:themeFormationId', authentificate, getFilteredDepenses);
router.get('/:themeFormationId/:userId/pdf', authentificate, generateBudgetPDF);
router.get('/summary/:themeFormationId', getThemeBudgetSummary); // NOUVEAU
router.put('/:id', authentificate, validateNatureDepense, updateDepense);
router.delete('/:id',authentificate, deleteDepense);


export default router;
