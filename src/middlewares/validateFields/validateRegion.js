import {body } from 'express-validator';

export const validateFields = [
    body('code').notEmpty().withMessage('Le code est requis'),

    body('nomFr').notEmpty().withMessage('Le nom en français est requis'),

    body('nomEn').notEmpty().withMessage('Le nom en anglais est requis'),
];