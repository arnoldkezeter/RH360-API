import express from 'express';
import {
  lierTacheAuTheme,
  modifierTacheTheme,
  supprimerTacheTheme,
  getTachesParTheme,
  validerExecutionTacheTheme
} from '../controllers/tacheThemeFormationController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields, validateFieldsExecution } from '../middlewares/validateFields/validateTacheTheme.js';

const router = express.Router();

router.post('/:themeId/', authentificate, validateFields, lierTacheAuTheme);
router.put('/:id',authentificate, validateFields, modifierTacheTheme);
router.delete('/:id',authentificate, supprimerTacheTheme);
router.get('/theme/:themeId/filtre',getTachesParTheme);
router.put('/valider/:id', authentificate, validateFieldsExecution, validerExecutionTacheTheme);

export default router;
