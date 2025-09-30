// routes/noteService.js
import express from 'express';
import { 
    creerNoteService, 
    creerNoteServiceStage, 
    genererPDFNote, 
    obtenirNotesService, 
    validerNoteService } from '../controllers/noteServiceController.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @route POST /api/notes-service
 * @desc Créer une nouvelle note de service ET générer automatiquement le PDF
 * @access Private
 * @body { typeNote, theme?, stage?, mandat?, titreFr?, titreEn?, copieA?, creePar? }
 * @returns PDF file download
 */
router.post('/note-service/stage', authentificate, creerNoteServiceStage);
router.post('/', authentificate, creerNoteService);

/**
 * @route GET /api/notes-service
 * @desc Récupérer toutes les notes de service avec pagination
 * @access Private
 * @query page, limit, typeNote, valideParDG
 */
router.get('/', obtenirNotesService);

/**
 * @route GET /api/notes-service/:noteId/pdf
 * @desc Regénérer le PDF d'une note de service existante
 * @access Private
 */
router.get('/:noteId/pdf', genererPDFNote);

/**
 * @route PUT /api/notes-service/:noteId/valider
 * @desc Valider/Invalider une note de service par le DG
 * @access Private (Admin/DG only)
 */
router.put('/:noteId/valider', validerNoteService);

/**
 * @route POST /api/notes-service/mandat
 * @desc Raccourci pour créer une note de service de type mandat avec PDF
 * @access Private
 */
router.post('/mandat', async (req, res) => {
    req.body.typeNote = 'mandat';
    return creerNoteService(req, res);
});

/**
 * @route POST /api/notes-service/stage
 * @desc Raccourci pour créer une note de service d'acceptation de stage avec PDF
 * @access Private
 */
router.post('/stage', async (req, res) => {
    req.body.typeNote = 'acceptation_stage';
    return creerNoteService(req, res);
});

/**
 * @route POST /api/notes-service/convocation
 * @desc Raccourci pour créer une note de service de convocation avec PDF
 * @access Private
 */
router.post('/convocation', async (req, res) => {
    req.body.typeNote = 'convocation';
    return creerNoteService(req, res);
});

export default router;