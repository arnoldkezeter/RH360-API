import {body } from 'express-validator';

export const validateFields = [
    body('utilisateur').notEmpty().withMessage('L\'utilisateur est requis'),
    
    body('besoin').notEmpty().withMessage('Le besoin prédéfini est requis')
];