import {body } from 'express-validator';

export const validateFields = [
    body('nomFr').notEmpty().withMessage('Le nom en français est requis'),

    body('nomEn').notEmpty().withMessage('Le nom en anglais est requis'),

    body('grades').notEmpty().withMessage('Le grade est obligatoire')
];