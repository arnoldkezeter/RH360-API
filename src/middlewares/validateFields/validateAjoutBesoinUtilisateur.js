import { body } from 'express-validator';

export const validateFields = [
  body('utilisateur')
    .if((value, { req }) => req.method !== 'PUT')
    .notEmpty().withMessage("L'utilisateur est requis")
    .isMongoId().withMessage("L'identifiant utilisateur doit être un ObjectId valide"),

  body('titreFr')
    .notEmpty().withMessage("Le titre français est requis")
    .isString().withMessage("Le titre français doit être une chaîne de caractères"),

  body('titreEn')
    .notEmpty().withMessage("Le titre anglais est requis")
    .isString().withMessage("Le titre anglais doit être une chaîne de caractères"),

  body('descriptionFr')
    .optional()
    .isString().withMessage("La description française doit être une chaîne de caractères"),

  body('descriptionEn')
    .optional()
    .isString().withMessage("La description anglaise doit être une chaîne de caractères"),

  body('pointsAAmeliorerFr')
    .optional()
    .isString().withMessage("Les points à améliorer en français doivent être une chaîne de caractères"),

  body('pointsAAmeliorerEn')
    .optional()
    .isString().withMessage("Les points à améliorer en anglais doivent être une chaîne de caractères"),
];
