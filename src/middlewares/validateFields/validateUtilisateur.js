import {body } from 'express-validator';

export const validateFields = [
    body('nom').notEmpty().withMessage('Le nom est obligatoire'),

    body('genre').notEmpty().withMessage('Le genre est obligatoire'),

    body('email').isEmail().withMessage('Email invalide'),
    
    body('role').notEmpty().withMessage('Le rôle est obligatoire'),
];