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
import { authentificate } from '../middlewares/auth.js';
import { validateFieldsDepense } from '../middlewares/validateFields/validateDepense.js';

const router = express.Router();

// Budgets
router.post('/', validateFields, authentificate, createBudget);
router.put('/:budgetId', validateFields, authentificate, updateBudget);
router.delete('/:budgetId', deleteBudget);

// Dépenses
router.post('/:budgetId/depenses/:sectionType', validateFieldsDepense, authentificate, addDepense);
router.put('/:budgetId/depenses/:sectionType/:ligneId', validateFieldsDepense, authentificate, updateDepense);
router.delete('/:budgetId/depenses/:sectionType/:ligneId', authentificate, deleteDepense);

// Budgets par formation (avec pagination)
router.get('/formation/:formationId', authentificate, getBudgetsThemesParFormationPaginated);

// Dépenses par thème et type (avec pagination)
router.get('/theme/:themeId/depenses', authentificate, getDepensesParThemeEtType);

// Écarts budget prévu / réel par thème (histogramme)
router.get('/formation/:formationId/ecarts', authentificate, getBudgetEcartParTheme);

// Route : Totaux du budget par formation
router.get('/totaux/formation/:formationId', authentificate, getTotauxBudgetParFormation);

export default router;
