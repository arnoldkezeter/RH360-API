import {body } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le nom en français est requis'),

    body('titreEn').notEmpty().withMessage('Le nom en anglais est requis'),
];