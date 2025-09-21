import express from 'express';

import { authentificate } from '../middlewares/auth.js';
import { ajouterParticipant, getParticipantFormation, rechercherParticipantTheme, supprimerParticipant } from '../controllers/participantFormationController.js';


const router = express.Router();


router.post('/:themeId/participant', authentificate, ajouterParticipant);
router.delete('/:themeId/participant/:participantId', authentificate, supprimerParticipant);
router.get('/filtre/:themeId', authentificate, getParticipantFormation);
router.get('/search/:themeId', authentificate, rechercherParticipantTheme);


export default router;
