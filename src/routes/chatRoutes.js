// routes/chatRoutes.js
import express from 'express';
import { body, param, query } from 'express-validator';

import { authentificate } from '../middlewares/auth.js'; // Middleware d'authentification
import { validateFields, validateFieldsMessage, validateFieldsParticipants } from '../middlewares/validateFields/validateChat.js';
import { addMessage, addParticipants, chatDetails, createChat, deactivateChat, getAvailableParticipants, getChatMessages, getUtilisateurChats, markMessagesAsRead, removeParticipants, searchMessage, updatePartipantPermission } from '../controllers/chatController.js';

const router = express.Router();

// Middleware d'authentification appliqué à toutes les routes
router.use(authentificate);

// ROUTES PRINCIPALES

// 1. Créer un nouveau chat
router.post('/:creatorId', validateFields, createChat);

// 2. Récupérer tous les chats d'une entité
// router.get('/entity/:entityType/:entityId', getEntityChats);

// 3. Récupérer tous les chats d'un utilisateur
router.get('/user/:userId', getUtilisateurChats);

// 4. Récupérer les utilisateurs disponibles pour une entité
router.get('/available-participants/:currentUtilisateurId/chat/:entityId', getAvailableParticipants);

// GESTION DES PARTICIPANTS

// 5. Ajouter des participants à un chat
router.post('/:chatId/participants/add/:addedBy', validateFieldsParticipants, addParticipants);

// 6. Retirer des participants d'un chat
router.delete('/:chatId/participants/remove/:removedBy', removeParticipants);

// GESTION DES MESSAGES

// 7. Ajouter un message à un chat
router.post('/:chatId/:senderId/messages', validateFieldsMessage, addMessage);

// 8. Récupérer les messages d'un chat
router.get('/:chatId/:userId/messages', getChatMessages);

// 9. Marquer les messages comme lus
router.patch('/:chatId/messages/read', markMessagesAsRead);

// GESTION DU CHAT

// 10. Désactiver un chat
router.delete('/:chatId/deactivate',  deactivateChat);

// ROUTES SUPPLÉMENTAIRES (optionnelles)

// 11. Obtenir les détails d'un chat spécifique
router.get('/:chatId', chatDetails);

// 12. Modifier les permissions d'un participant
router.patch('/:chatId/participants/:participantId/permissions', updatePartipantPermission);

// 13. Rechercher dans les messages d'un chat
router.get('/:chatId/messages/search', searchMessage);

export default router