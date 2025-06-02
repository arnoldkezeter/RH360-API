import {body } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),

    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),
];