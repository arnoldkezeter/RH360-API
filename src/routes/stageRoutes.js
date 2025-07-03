import express from 'express';
import { 
    creerStage, 
    creerStageGroupe, 
    genererGroupes, 
    genererRotations, 
    verifierStagiairesManquants, 
    ajouterStagiairesAuxGroupes, 
    creerNouveauxGroupesEtReorganiserRotations,
    ajouterServiceAffecte,
    modifierServiceAffecte,
    supprimerServiceAffecte,
    listeStages,
    listeStagiairesParEtablissement,
    nombreStagiairesParEtablissement,
    nombreStagiairesParStatutEtEtablissement ,
    totalStagiaires,
    totalStagesTermines,
    moyenneStagiairesParSuperviseur,
    dureeMoyenneStages,
    tauxStatutStages,
    repartitionStagiairesParService,
    repartitionStagiairesParSuperviseur, 
    modifierGroupe,
    supprimerGroupe,
    supprimerStage,
    calendrierRotations,
    getNombreStagesEnCours
} from '../controllers/stageController.js';
import { authentificate } from '../middlewares/auth.js';
import { validateFields } from '../middlewares/validateFields/validateStage.js';


const router = express.Router();
// Définir les routes
router.post('/individuel', authentificate, validateFields, creerStage); // Création d'un stage individuel
router.post('/groupe', authentificate, validateFields, creerStageGroupe); // Création d'un stage en groupe
router.delete('/:id', authentificate, supprimerStage) //supprimer un stage
router.post('/groupes/generer', authentificate, genererGroupes); // Générer des groupes
router.post('/rotations/generer', authentificate, genererRotations); // Générer des rotations
router.get('/:stageId/stagiaires-non-assignes', authentificate, verifierStagiairesManquants); // Vérifier les stagiaires non assignés
router.post('/:stageId/ajouter-stagiaires', authentificate, ajouterStagiairesAuxGroupes); // Ajouter des stagiaires à un groupe
router.post('/:stageId/nouveaux-groupes', authentificate, creerNouveauxGroupesEtReorganiserRotations); // Créer de nouveaux groupes et réorganiser les rotations
router.post('/groupes/:groupeId', authentificate, modifierGroupe), //Modifier un groupe
router.delete('/groupes/:groupeId', authentificate, supprimerGroupe), //Supprimer un groupe
router.post('/:stageId/stagiaires/:stagiaireId/services-affectes', authentificate, ajouterServiceAffecte); //Ajouter service affecté
router.put('/:stageId/stagiaires/:stagiaireId/services-affectes/:serviceAffecteId', authentificate, modifierServiceAffecte);// Modifier un service affecté d'un stagiaire dans un stage individuel
router.delete('/:stageId/stagiaires/:stagiaireId/services-affectes/:serviceAffecteId', authentificate, supprimerServiceAffecte);// Supprimer un service affecté d'un stagiaire dans un stage individuel
router.get('/', authentificate, listeStages);// Liste des stages
router.get('/stagiaires/etablissement/:etablissementId', authentificate, listeStagiairesParEtablissement);// Liste des stagiaires par établissement
router.get('/stats/stagiaires-par-etablissement', authentificate, nombreStagiairesParEtablissement);// Nombre de stagiaires par établissement
router.get('/stats/stagiaires-par-statut-et-etablissement', authentificate, nombreStagiairesParStatutEtEtablissement);// Nombre de stagiaires acceptés par établissement
router.get('/calendrier-rotation', authentificate, calendrierRotations); //Calendrier de rotation
router.get('/total-stagiaires', totalStagiaires); // Route pour le total des stagiaires uniques
router.get('/total-stages-termines', totalStagesTermines); // Route pour le total des stages terminés
router.get('/moyenne-stagiaires-par-superviseur', moyenneStagiairesParSuperviseur);// Route pour la moyenne des stagiaires par superviseur
router.get('/duree-moyenne-stages', dureeMoyenneStages); // Route pour la durée moyenne des stages
router.get('/taux-statut-stages', tauxStatutStages);// Route pour les taux d'acceptation, de refus et en attente
router.get('/repartition-stagiaires-par-service', repartitionStagiairesParService); // Route pour la répartition des stagiaires par service
router.get('/repartition-stagiaires-par-superviseur', repartitionStagiairesParSuperviseur); // Route pour la répartition des stagiaires par superviseur
router.get('/stages-en-cours', getNombreStagesEnCours)


export default router;
