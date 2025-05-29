import {body } from 'express-validator';

export const validateFieldsPassword = [
    body('ancienMotDePasse').notEmpty().withMessage('Ancien mot de passe requis'),
    
    body('nouveauMotDePasse').notEmpty().withMessage('Nouveau mot de passe requis'),
];