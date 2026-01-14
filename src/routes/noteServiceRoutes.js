// routes/noteService.js
import express from 'express';
import { 
    afficherVerificationNote,
    creerNoteService, 
    creerNoteServiceBudget, 
    creerNoteServiceConvocationFormateurs, 
    creerNoteServiceConvocationParticipants, 
    creerNoteServiceStage, 
    creerNoteServiceStageGroupe, 
    deleteNoteService, 
    genererFichesPresenceFormateurs, 
    genererFichesPresenceParticipants, 
    genererPDFNote, 
    getNotesService, 
    telechargerNoteDeService, 
    validerNoteService, 
    verifierNoteService} from '../controllers/noteServiceController.js';
import { authentificate } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';
import fs from "fs";

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'public/uploads/notes_service');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/**
 * @route POST /api/notes-service
 * @desc Créer une nouvelle note de service ET générer automatiquement le PDF
 * @access Private
 * @body { typeNote, theme?, stage?, mandat?, titreFr?, titreEn?, copieA?, creePar? }
 * @returns PDF file download
 */
router.post('/note-service/stage', authentificate, creerNoteServiceStage);
router.post('/note-service/stage/groupe', authentificate, creerNoteServiceStageGroupe);
router.post('/convocation/formateurs', authentificate, creerNoteServiceConvocationFormateurs);
router.post('/note-service/convocation/participants', authentificate, creerNoteServiceConvocationParticipants);

router.post('/budget', authentificate, creerNoteServiceBudget);
router.post('/formations/fiches-presence/participants/:lieuId', authentificate, genererFichesPresenceParticipants);
router.post('/formations/fiches-presence/formateurs', authentificate, genererFichesPresenceFormateurs);


router.post('/', authentificate, creerNoteService);
router.get('/telecharger/:id', authentificate, telechargerNoteDeService);

/**
 * @route   GET /api/notes-service/verifier/:id
 * @desc    Vérifie l'authenticité d'une note (retourne JSON)
 * @access  Public
 */
router.get('/verifier/:id', verifierNoteService);

/**
 * @route   GET /api/notes-service/verification/:id
 * @desc    Affiche une page HTML de vérification (pour scan QR code)
 * @access  Public
 */
router.get('/verification/:id', afficherVerificationNote);
/**
 * @route GET /api/notes-service
 * @desc Récupérer toutes les notes de service avec pagination
 * @access Private
 * @query page, limit, typeNote, valideParDG
 */
router.get('/', getNotesService);

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

router.delete('/:id', authentificate, deleteNoteService);

router.put('/:noteId', upload.single('noteServiceFile'), authentificate, validerNoteService)

export default router;