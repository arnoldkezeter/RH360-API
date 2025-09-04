import express from 'express';
import {     
    listeStages,
    nombreStagesParEtablissement,
    nombreStagesParStatutEtEtablissement,
    createStage,
    totalStagiairesSurPeriode,
    totalStagiairesTerminesSurPeriode,
    moyenneStagiairesParSuperviseurSurPeriode,
    dureeMoyenneStagesSurPeriode,
    tauxStatutStagesSurPeriode,
    repartitionStagiairesParServiceSurPeriode,
    repartitionStagiairesParSuperviseurSurPeriode,
    repartitionStagiairesParEtablissementSurPeriode,
    nombreStagesEnCoursSurPeriode,
    deleteStage,
    updateStage,
    getStageByIdAndType
} from '../controllers/stageController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStage.js';


const router = express.Router();
// Définir les routes
router.post('/', authentificate, validateFields, createStage); // Création d'un stage
router.put('/:id', authentificate, validateFields, updateStage); // modification d'un stage individuel
router.delete('/:id', authentificate, deleteStage); // Suppression d'un stage

router.get('/:id/:type', authentificate, getStageByIdAndType)
router.get('/', authentificate, listeStages);// Liste des stages
// router.get('/stagiaires/etablissement/:etablissementId', authentificate, listeStagiairesParEtablissement);// Liste des stagiaires par établissement
router.get('/stats/stagiaires-par-etablissement', authentificate, nombreStagesParEtablissement);// Nombre de stagiaires par établissement
router.get('/stats/stagiaires-par-statut-et-etablissement', authentificate, nombreStagesParStatutEtEtablissement);// Nombre de stagiaires acceptés par établissement
router.get('/total-stagiaires', totalStagiairesSurPeriode); // Route pour le total des stagiaires uniques
router.get('/total-stagiaires-termines', totalStagiairesTerminesSurPeriode); // Route pour le total des stages terminés
router.get('/moyenne-stagiaires-par-superviseur', moyenneStagiairesParSuperviseurSurPeriode);// Route pour la moyenne des stagiaires par superviseur
router.get('/duree-moyenne-stages', dureeMoyenneStagesSurPeriode); // Route pour la durée moyenne des stages
router.get('/taux-statut-stages', tauxStatutStagesSurPeriode);// Route pour les taux d'acceptation, de refus et en attente
router.get('/repartition-stagiaires-par-service', repartitionStagiairesParServiceSurPeriode); // Route pour la répartition des stagiaires par service
router.get('/repartition-stagiaires-par-superviseur', repartitionStagiairesParSuperviseurSurPeriode); // Route pour la répartition des stagiaires par superviseur
router.get('/repartition-stagiaires-par-etablissement', repartitionStagiairesParEtablissementSurPeriode)
router.get('/stages-en-cours', nombreStagesEnCoursSurPeriode)


export default router;
