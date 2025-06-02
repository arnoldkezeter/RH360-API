import {body } from 'express-validator';

export const validateFields = [
    body('annee').notEmpty().withMessage('L\'année est requise'),

];