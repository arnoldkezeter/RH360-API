// routes/gradeRoutes.js
import express from 'express';
import { validateFields } from '../middlewares/validateFields/validateGrade.js';
import { authentificate } from '../middlewares/auth.js';
import { generateDocumentPdf, generateStagiairesPdf, generateUsersPdf } from '../controllers/generateDocumentController.js';

const router = express.Router();

router.get('/generate-pdf', generateDocumentPdf);
router.get('/generate-stagiaire-pdf', generateStagiairesPdf)
router.get('/generate-utilisateur-pdf', generateUsersPdf)
export default router;
