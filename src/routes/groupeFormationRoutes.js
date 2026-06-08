// routes/groupeFormationRoutes.js
import express from 'express';
import {
    getResumeGroupes,
    getParticipantsGroupe,
    configurerGroupe,
    fusionnerGroupes,
    deplacerParticipant,
    supprimerGroupe,
    creerGroupeManuel,
} from '../controllers/groupeFormationController.js';

const router = express.Router({ mergeParams: true });

router.get('/resume',                           getResumeGroupes);
router.post('/fusionner',                       fusionnerGroupes);
router.patch('/deplacer-participant',           deplacerParticipant);
router.get('/:groupeId/participants',           getParticipantsGroupe);
router.patch('/:groupeId/configurer',           configurerGroupe);
router.delete('/:groupeId',                     supprimerGroupe);
router.post('/', creerGroupeManuel); // POST /themes/:themeId/groupes


export default router;