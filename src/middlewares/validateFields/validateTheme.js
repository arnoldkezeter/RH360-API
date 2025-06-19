import {body } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),
    
    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),
    
    body('dateDebut').notEmpty().withMessage('La date de début est requise'),
    
    body('dateFin').notEmpty().withMessage('La date de fin est requise'),
        
    body('formation').notEmpty().withMessage('La formation est obligatoire'),
];