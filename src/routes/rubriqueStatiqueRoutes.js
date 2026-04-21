// routes/rubriqueStatique.js
import express from 'express';
import { authentificate } from '../middlewares/auth.js';
import {
    getAllRubriquesStatiques,
    getRubriqueStatiqueByCode,
    updateRubriqueStatiqueController,
    addQuestionStatiqueController,
    updateQuestionStatiqueController,
    deleteQuestionStatiqueController,
    updateSousQuestionsController,
    initRubriquesStatiques,
} from '../controllers/rubriqueStatiqueController.js';

const router = express.Router();

// Routes publiques (lecture)
router.get('/', authentificate, getAllRubriquesStatiques);
router.get('/:code', authentificate, getRubriqueStatiqueByCode);

// Routes admin (écriture)
router.put('/:code', authentificate,  updateRubriqueStatiqueController);
router.post('/:rubriqueCode/questions', authentificate,  addQuestionStatiqueController);
router.put('/questions/:code', authentificate,  updateQuestionStatiqueController);
router.delete('/questions/:code', authentificate,  deleteQuestionStatiqueController);
router.put('/questions/:code/sous-questions', authentificate,  updateSousQuestionsController);

// Route d'initialisation (admin uniquement)
router.post('/init', authentificate,  initRubriquesStatiques);

export default router;