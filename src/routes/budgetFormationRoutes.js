import express from 'express';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetEcartParTheme,
  getTotauxBudgetParFormation,
  getBudgetFormationsByFormation,
  getBudgetFormationForDropdown,
  getBudgetsFormationsByFormationPaginated,
} from '../controllers/budgetFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateBudgetFormation.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

// Budgets
router.post('/', validateFields, authentificate, createBudget);
router.put('/:budgetId', validateFields, authentificate, updateBudget);
router.delete('/:budgetId', deleteBudget);

// Budgets par formation (avec pagination)
router.get('/filtre/:formationId', authentificate, getBudgetFormationsByFormation);
router.get('/formation/:formationId', authentificate, getBudgetsFormationsByFormationPaginated);
router.get('/dropdown/formation/:formationId', authentificate, getBudgetFormationForDropdown);


// Écarts budget prévu / réel par thème (histogramme)
router.get('/histogramme/:formationId', authentificate, getBudgetEcartParTheme);

// Route : Totaux du budget par formation
router.get('/totaux/:formationId', authentificate, getTotauxBudgetParFormation);

export default router;
