import {body } from 'express-validator';

export const validateFields = [
    body('typeStage').notEmpty().withMessage('Le type de stage est requis'),

    body('statut').notEmpty().withMessage('Le statut du stage est requis'),
];


