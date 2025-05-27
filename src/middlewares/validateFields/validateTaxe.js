import {body } from 'express-validator';

export const validateFields = [
    body('natureFr').notEmpty().withMessage('La nature en français est requise'),

    body('natureEn').notEmpty().withMessage('La nature en anglais est requise'),
];