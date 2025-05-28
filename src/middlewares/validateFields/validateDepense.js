import {body } from 'express-validator';

export const validateFieldsDepense = [
    body('natureDepenseFr').notEmpty().withMessage('Le nature en français de la dépense est requise'),

    body('natureDepenseEn').notEmpty().withMessage('La nature en anglais de la dépense est requise'),

    body('montantUnitaireHT').notEmpty().withMessage('Le montant unitaire de la dépense est requis'),

    body('quantite').notEmpty().withMessage('La quantité de la dépense est requise'),
];
