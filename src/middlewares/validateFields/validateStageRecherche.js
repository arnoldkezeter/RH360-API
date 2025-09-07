import {body } from 'express-validator';

export const validateFields = [
    body('nomFr').notEmpty().withMessage('Le nom en français est requis'),
    body('nomEn').notEmpty().withMessage('Le nom en anglais est requis'),
    body('dateDebut').notEmpty().withMessage('La date de début du stage est requise'),
    body('dateFin').notEmpty().withMessage('La date de fin du stage est requise'),
    body('anneeStage').notEmpty().withMessage('L\'année du stage est requis'),
    body('superviseur').notEmpty().withMessage('Le superviseur est requis'),
    body('structure').notEmpty().withMessage('La structure est requise'),
    body('statut').notEmpty().withMessage('Le statut du stage est requis'),
];
