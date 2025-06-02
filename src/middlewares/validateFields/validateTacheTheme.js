import {body } from 'express-validator';
    
export const validateFields = [
    body('theme').isMongoId().withMessage('identifiant_invalide'),
    body('tache').isMongoId().withMessage('identifiant_invalide'),
    body('dateDebut').optional().isISO8601().toDate(),
    body('dateFin').optional().isISO8601().toDate(),
];

export const validateFieldsExecution = [
    body('dateExecution').optional().isISO8601().toDate(),
    body('methodeValidation').isIn(['manuelle', 'donnees', 'fichier', 'automatique']).withMessage('methode de validation invalide'),
];