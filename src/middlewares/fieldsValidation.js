import {body } from 'express-validator';

//Validation des champs pour le modèle struture
export const validateStructure = [
    body('nomFr')
        .notEmpty()
        .withMessage('Le nom en français est requis / French name is required'),

    body('nomEn')
        .notEmpty()
        .withMessage('Le nom en anglais est requis / English name is required'),
];