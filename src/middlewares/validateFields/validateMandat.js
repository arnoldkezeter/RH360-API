import {body } from 'express-validator';

export const validateFields = [
    body('chercheur').notEmpty().withMessage('Le chercheur est est requis'),

    body('statut').notEmpty().withMessage('Le statut du stage est requis'),

    body('structure').notEmpty().withMessage('La structute est requise'),
];


