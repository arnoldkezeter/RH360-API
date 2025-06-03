import {body, check } from 'express-validator';

export const validateFields = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),
    
    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),

    body('theme').notEmpty().withMessage('Le theme est requis'),
];

export const validateFieldsRubrique = [
    body('titreFr').notEmpty().withMessage('Le titre en français est requis'),
    
    body('titreEn').notEmpty().withMessage('Le titre en anglais est requis'),

    body('ordre').notEmpty().withMessage('L\'ordre est requis'),
];

export const validateFieldsQuestion = [
    body('libelleFr').notEmpty().withMessage('Le libellé en français est requis'),
    
    body('libelleEn').notEmpty().withMessage('Le libellé en anglais est requis'),

    body('ordre').notEmpty().withMessage('L\'ordre est requis'),
];

export const validateFieldsSousQuestion = [
    body('libelleFr').notEmpty().withMessage('Le libellé en français est requis'),
    
    body('libelleEn').notEmpty().withMessage('Le libellé en anglais est requis'),

    body('ordre').notEmpty().withMessage('L\'ordre est requis'),
];

export const validateFieldsEchelle = [
    body('valeurFr').notEmpty().withMessage('La valeur en français est requise'),
    
    body('valeurEn').notEmpty().withMessage('La valeur en anglais est requise'),

    body('ordre').notEmpty().withMessage('L\'ordre est requis'),
];


export const validateFieldsReponseEvaluation = [
        check('formation', 'La formation est requise').not().isEmpty(),
        check('utilisateur', 'L\'utilisateur est requis').not().isEmpty(),
        check('modele', 'Le modèle est requis').not().isEmpty(),
        check('reponses', 'Les réponses sont requises').isArray({ min: 1 })
];
