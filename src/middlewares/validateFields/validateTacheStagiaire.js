import {body } from 'express-validator';

export const validateFields = [
    body('nomFr').notEmpty().withMessage('Le nom en français est requis'),

    body('nomEn').notEmpty().withMessage('Le nom en anglais est requis'),

    body('stagiaire').optional().notEmpty().withMessage('Le stagiaire est requis'),

    body('date').notEmpty().withMessage('La date est requise'),
];