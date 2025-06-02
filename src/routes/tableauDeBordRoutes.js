import express from 'express';
import { get10ProchainsThemesDuProgramme, 
        getBudgetTotalParProgramme, 
        getRepartitionFormationsParAxe, 
        getStatsFormateursParProgramme, 
        getTauxExecutionMensuelParFormation 
    } from '../controllers/tableauDeBordController.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();


router.get('/:programmeId/themes-prochains', authentificate, get10ProchainsThemesDuProgramme);
router.get('/:programmeId/repartition-axes', authentificate, getRepartitionFormationsParAxe);
router.get('/:programmeId/stats-formateurs', authentificate, getStatsFormateursParProgramme);
router.get('/:programmeId/budget-total', authentificate, getBudgetTotalParProgramme);
router.get('/:programmeId/taux-execution-mensuel', authentificate, getTauxExecutionMensuelParFormation);

export default router;
