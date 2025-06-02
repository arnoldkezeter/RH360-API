import express from 'express';
import { check } from 'express-validator';
import {
    createProgrammeFormation,
    updateProgrammeFormation,
    deleteProgrammeFormation,
    getProgrammesFormation,
    getProgrammeFormationById,
    searchProgrammeFormationByTitle,
    getProgrammesForDropdown,
    getNombreProgrammesActifs,
    getPourcentageExecutionProgrammes,
    getRepartitionFormationsParProgramme,
    getTauxExecutionParAxeStrategique,
    getCoutsParFormationPourProgramme,
    getStatistiquesProgrammesFormation,
} from '../controllers/programmeFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateProgrammeFormation.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authentificate, validateFields, createProgrammeFormation);
router.put('/:id', authentificate, validateFields, updateProgrammeFormation);
router.delete('/:id', authentificate, deleteProgrammeFormation);
router.get('/', authentificate, getProgrammesFormation);
router.get('/:id', authentificate, getProgrammeFormationById);
router.get('/recherche/titre', authentificate, searchProgrammeFormationByTitle);
router.get('/dropdown/list', authentificate, getProgrammesForDropdown);
router.get('/programmes/stats', authentificate, getStatistiquesProgrammesFormation);
router.get('/programmes/actifs/total', authentificate, getNombreProgrammesActifs);
router.get('/programmes/pourcentage-execution-global', authentificate, getPourcentageExecutionProgrammes);
router.get('/formations/repartition-par-programme', authentificate, getRepartitionFormationsParProgramme);
router.get('/formations/execution-par-axe-strategique', authentificate, getTauxExecutionParAxeStrategique);
router.get('/formations/couts-par-programme/:programmeId', authentificate, getCoutsParFormationPourProgramme);

export default router;
