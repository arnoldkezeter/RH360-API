// routes/gradeRoutes.js
import express from 'express';
import { validateFields } from '../middlewares/validateFields/validateGrade.js';
import { authentificate } from '../middlewares/auth.js';
import { generateDocumentPdf } from '../controllers/generateDocumentController.js';

const router = express.Router();

router.get('/generate-pdf', generateDocumentPdf);

export default router;
