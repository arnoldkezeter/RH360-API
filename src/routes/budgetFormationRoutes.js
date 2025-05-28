import express from 'express';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  addDepense,
  updateDepense,
  deleteDepense,
  getBudgetsThemesParFormationPaginated,
  getDepensesParThemeEtType,
  getBudgetEcartParTheme,
  getTotauxBudgetParFormation
} from '../controllers/budgetFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateBudgetFormation.js';
import { authenticate } from '../middlewares/auth.js';
import { validateFieldsDepense } from '../middlewares/validateFields/validateDepense.js';

const router = express.Router();

// Budgets
router.post('/', validateFields, authenticate, createBudget);
router.put('/:budgetId', validateFields, authenticate, updateBudget);
router.delete('/:budgetId', deleteBudget);

// Dépenses
router.post('/:budgetId/depenses/:sectionType', validateFieldsDepense, authenticate, addDepense);
router.put('/:budgetId/depenses/:sectionType/:ligneId', validateFieldsDepense, authenticate, updateDepense);
router.delete('/:budgetId/depenses/:sectionType/:ligneId', authenticate, deleteDepense);

// Budgets par formation (avec pagination)
router.get('/formation/:formationId', authenticate, getBudgetsThemesParFormationPaginated);

// Dépenses par thème et type (avec pagination)
router.get('/theme/:themeId/depenses', authenticate, getDepensesParThemeEtType);

// Écarts budget prévu / réel par thème (histogramme)
router.get('/formation/:formationId/ecarts', authenticate, getBudgetEcartParTheme);

// Route : Totaux du budget par formation
router.get('/totaux/formation/:formationId', authenticate, getTotauxBudgetParFormation);

export default router;
