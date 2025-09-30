import express from 'express';
import {     
    listeStageRecherches,
    nombreStageRecherchesParEtablissement,
    nombreStageRecherchesParStatutEtEtablissement,
    createStageRecherche,
    totalChercheursSurPeriode,
    totalChercheursTerminesSurPeriode,
    moyenneChercheursParSuperviseurSurPeriode,
    dureeMoyenneStageRecherchesSurPeriode,
    tauxStatutStageRecherchesSurPeriode,
    repartitionChercheursParServiceSurPeriode,
    repartitionChercheursParSuperviseurSurPeriode,
    repartitionChercheursParEtablissementSurPeriode,
    nombreStageRecherchesEnCoursSurPeriode,
    deleteStageRecherche,
    updateStageRecherche,
    getStageRechercheById,
    changerStatutStageRecherche
} from '../controllers/stageRechercheController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStageRecherche.js';
import multer from 'multer';
import path from 'path';
import fs from "fs";

const router = express.Router();

// Routes spécifiques en premier
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

router.put('/:stageId/changer-statut', upload.single('noteServiceFile'), changerStatutStageRecherche);
router.post('/', authentificate, validateFields, createStageRecherche); // Création
router.put('/:stageId', authentificate, validateFields, updateStageRecherche); // Modification
router.delete('/:id', authentificate, deleteStageRecherche); // Suppression

router.get('/', authentificate, listeStageRecherches); // Liste

// Stats et agrégations
router.get('/stats/chercheurs-par-etablissement', authentificate, nombreStageRecherchesParEtablissement);
router.get('/stats/chercheurs-par-statut-et-etablissement', authentificate, nombreStageRecherchesParStatutEtEtablissement);

router.get('/total-chercheurs', totalChercheursSurPeriode);
router.get('/total-chercheurs-termines', totalChercheursTerminesSurPeriode);
router.get('/moyenne-chercheurs-par-superviseur', moyenneChercheursParSuperviseurSurPeriode);
router.get('/duree-moyenne-stage-recherches', dureeMoyenneStageRecherchesSurPeriode);
router.get('/taux-statut-stage-recherches', tauxStatutStageRecherchesSurPeriode);

router.get('/repartition-chercheurs-par-superviseur', repartitionChercheursParSuperviseurSurPeriode);
router.get('/repartition-chercheurs-par-etablissement', repartitionChercheursParEtablissementSurPeriode);
// router.get('/repartition-chercheurs-par-service', repartitionChercheursParServiceSurPeriode);

router.get('/stage-recherches-en-cours', nombreStageRecherchesEnCoursSurPeriode);

// ⚠️ Route générique toujours en dernier
router.get('/:id', authentificate, getStageRechercheById);

export default router;
