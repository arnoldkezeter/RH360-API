import { body } from 'express-validator';

export const validateFields = [
  body('utilisateur')
    .if((value, { req }) => req.method !== 'PUT')
    .notEmpty().withMessage("L'utilisateur est requis")
    .isMongoId().withMessage("L'identifiant utilisateur doit être un ObjectId valide"),

  body('besoin')
    .if((value, { req }) => req.method !== 'PUT')
    .notEmpty().withMessage('Le besoin prédéfini est requis')
    .isMongoId().withMessage("L'identifiant du besoin doit être un ObjectId valide"),

  body('niveau')
    .notEmpty().withMessage('Le niveau d\'auto-évaluation est requis')
    .isInt({ min: 1, max: 4 }).withMessage('Le niveau doit être un entier entre 1 et 4'),

  body('insuffisancesFr')
    .optional()
    .isString().withMessage('La description des insuffisances (fr) doit être une chaîne de caractères'),

  body('insuffisancesEn')
    .optional()
    .isString().withMessage('La description des insuffisances (en) doit être une chaîne de caractères'),

  body('formulationBesoinsFr')
    .optional()
    .isString().withMessage('La formulation des besoins (fr) doit être une chaîne de caractères'),

  body('formulationBesoinsEn')
    .optional()
    .isString().withMessage('La formulation des besoins (en) doit être une chaîne de caractères'),
];
