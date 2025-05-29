// middlewares/validateHistorique.js
import { body } from 'express-validator';

export const validateHistorique = [
    body('typeAction').notEmpty().withMessage('Le type d\'action est requis'),
    body('description').notEmpty().withMessage('La description est requise'),
    body('moduleConcerne').notEmpty().withMessage('Le module concerné est requise'),
];
