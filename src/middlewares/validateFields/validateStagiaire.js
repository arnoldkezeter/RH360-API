import {body } from 'express-validator';

export const validateFields = [
    body('nom').notEmpty().withMessage('Le nom est obligatoire'),

    body('genre').notEmpty().withMessage('Le genre est obligatoire'),

    body('email').isEmail().withMessage('Email invalide'),
    
    body('telephone').notEmpty().withMessage('Le numéro de téléphone est obligatoire'),

];

export const validateFieldsPassword = [
    body('ancienMotDePasse').notEmpty().withMessage('Ancien mot de passe requis'),
    
    body('nouveauMotDePasse').notEmpty().withMessage('Nouveau mot de passe requis'),
];