// routes/participantFormationRoutes.js — nettoyé
import express from 'express';
import {
    genererParticipants,
    decomposerEnGroupes,
    ajouterParticipant,
    supprimerParticipant,
    getParticipants,
    rechercherUtilisateurAjoutable,
} from '../controllers/participantFormationController.js';

const router = express.Router({ mergeParams: true });

router.post('/generer',                         genererParticipants);
router.post('/decomposer',                      decomposerEnGroupes);
router.get('/rechercher',                       rechercherUtilisateurAjoutable);
router.get('/',                                 getParticipants);
router.post('/',                                ajouterParticipant);
router.delete('/:participantFormationId',       supprimerParticipant);

export default router;