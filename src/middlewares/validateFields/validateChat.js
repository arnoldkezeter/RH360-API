import {body, param } from 'express-validator';

export const validateFields = [
    body('entityType')
    .notEmpty()
    .withMessage('Le type d\'entité est obligatoire')
    .isIn(['TacheExecutee', 'Projet', 'Equipe', 'Service'])
    .withMessage('Type d\'entité invalide'),
    body('entityId')
        .notEmpty()
        .withMessage('L\'ID de l\'entité est obligatoire')
        .isMongoId()
        .withMessage('ID d\'entité invalide'),
    
    body('title')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Le titre doit contenir entre 1 et 100 caractères'),
    body('chatType')
        .optional()
        .isIn(['general', 'task', 'announcement', 'support'])
        .withMessage('Type de chat invalide')
]

export const validateFieldsParticipants = [
    param('chatId')
    .isMongoId()
    .withMessage('ID du chat invalide'),
    body('participants')
    .isArray({ min: 1 })
    .withMessage('Au moins un participant est requis'),
    body('participants.*.userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide'),
    body('participants.*.role')
    .isIn(['admin', 'super-admin', 'responsable', 'utilisateur'])
    .withMessage('Rôle invalide')
]

export const validateFieldsMessage = [
    param('chatId')
        .isMongoId()
        .withMessage('ID du chat invalide'),
      body('content')
        .notEmpty()
        .withMessage('Le contenu du message est obligatoire')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Le message doit contenir entre 1 et 1000 caractères'),
      body('messageType')
        .optional()
        .isIn(['text', 'file', 'image', 'system'])
        .withMessage('Type de message invalide')
]