import express from 'express';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetsThemesParFormationPaginated,
  getBudgetEcartParTheme,
  getTotauxBudgetParFormation,
  getBudgetFormationsByTheme,
  getBudgetThemesForDropdown,
} from '../controllers/budgetFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateBudgetFormation.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

// Budgets
router.post('/', validateFields, authentificate, createBudget);
router.put('/:budgetId', validateFields, authentificate, updateBudget);
router.delete('/:budgetId', deleteBudget);

// Budgets par formation (avec pagination)
router.get('/filtre/:themeId', authentificate, getBudgetFormationsByTheme);
router.get('/formation/:formationId', authentificate, getBudgetsThemesParFormationPaginated);
router.get('/dropdown/theme/:themeId', authentificate, getBudgetThemesForDropdown);


// Écarts budget prévu / réel par thème (histogramme)
router.get('/histogramme/:formationId/:themeId', authentificate, getBudgetEcartParTheme);

// Route : Totaux du budget par formation
router.get('/totaux/:formationId/:themeId', authentificate, getTotauxBudgetParFormation);

export default router;
