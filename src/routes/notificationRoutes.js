import express from 'express';

import { authentificate } from '../middlewares/auth.js';
import { marquerCommeLue, marquerToutesCommeLues, obtenirNotifications, supprimerNotification } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/:userId', authentificate, obtenirNotifications);
router.patch('/:notificationId/lire/:userId', authentificate, marquerCommeLue);
router.patch('/lire-toutes/:userId', authentificate, marquerToutesCommeLues);
router.delete('/:notificationId/:userId', authentificate, supprimerNotification);

export default router;
