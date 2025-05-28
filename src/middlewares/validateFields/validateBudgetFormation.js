import {body } from 'express-validator';

export const validateFields = [
    body('theme').notEmpty().withMessage('Le theme concerné est requis'),

    body('budgetReel').notEmpty().withMessage('La nature du budget est requise'),
];