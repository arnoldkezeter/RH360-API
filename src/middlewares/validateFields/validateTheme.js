import {body } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),
    
    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),
    
    body('duree').notEmpty().withMessage('La duree est requise'),
            
    body('formation').notEmpty().withMessage('La formation est obligatoire'),
];