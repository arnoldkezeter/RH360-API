import {body } from 'express-validator';

export const validateFields = [
    body('nomFr').notEmpty().withMessage('Le nom en français est requis'),
];