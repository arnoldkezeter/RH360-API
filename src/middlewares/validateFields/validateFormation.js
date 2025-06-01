import {body } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),
    
    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),
    
    body('axeStrategique').notEmpty().withMessage('L\'axe stratégique est requis'),
        
    body('programmeFormation').notEmpty().withMessage('Le programme de formation est requis'),
    
];