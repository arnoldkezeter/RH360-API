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
    getStageRechercheById
} from '../controllers/stageRechercheController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStageRecherche.js';


const router = express.Router();
// Définir les routes
router.post('/', authentificate, validateFields, createStageRecherche); // Création d'un stageRecherche
router.put('/:stageId', authentificate, validateFields, updateStageRecherche); // modification d'un stageRecherche individuel
router.delete('/:id', authentificate, deleteStageRecherche); // Suppression d'un stageRecherche

router.get('/:id', authentificate, getStageRechercheById)
router.get('/', authentificate, listeStageRecherches);// Liste des stageRecherches
// router.get('/chercheurs/etablissement/:etablissementId', authentificate, listeChercheursParEtablissement);// Liste des chercheurs par établissement
router.get('/stats/chercheurs-par-etablissement', authentificate, nombreStageRecherchesParEtablissement);// Nombre de chercheurs par établissement
router.get('/stats/chercheurs-par-statut-et-etablissement', authentificate, nombreStageRecherchesParStatutEtEtablissement);// Nombre de chercheurs acceptés par établissement
router.get('/total-chercheurs', totalChercheursSurPeriode); // Route pour le total des chercheurs uniques
router.get('/total-chercheurs-termines', totalChercheursTerminesSurPeriode); // Route pour le total des stageRecherches terminés
router.get('/moyenne-chercheurs-par-superviseur', moyenneChercheursParSuperviseurSurPeriode);// Route pour la moyenne des chercheurs par superviseur
router.get('/duree-moyenne-stageRecherches', dureeMoyenneStageRecherchesSurPeriode); // Route pour la durée moyenne des stageRecherches
router.get('/taux-statut-stageRecherches', tauxStatutStageRecherchesSurPeriode);// Route pour les taux d'acceptation, de refus et en attente
router.get('/repartition-chercheurs-par-service', repartitionChercheursParServiceSurPeriode); // Route pour la répartition des chercheurs par service
router.get('/repartition-chercheurs-par-superviseur', repartitionChercheursParSuperviseurSurPeriode); // Route pour la répartition des chercheurs par superviseur
router.get('/repartition-chercheurs-par-etablissement', repartitionChercheursParEtablissementSurPeriode)
router.get('/stage-recherches-en-cours', nombreStageRecherchesEnCoursSurPeriode)


export default router;
