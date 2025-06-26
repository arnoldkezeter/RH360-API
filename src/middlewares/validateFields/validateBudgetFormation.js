import {body } from 'express-validator';

export const validateFields = [
    body('theme').optional().isMongoId().withMessage('ID du thème invalide'),
    body('nomFr').trim().isLength({ min: 1 }).withMessage('Nom français requis'),
    body('nomEn').trim().isLength({ min: 1 }).withMessage('Nom anglais requis'),
    body('statut').optional().isIn(['BROUILLON', 'VALIDE', 'EXECUTE', 'CLOTURE']),
];

export const validateNatureDepense = [
  body('nomFr').trim().isLength({ min: 1 }).withMessage('Nom français requis'),
  body('nomEn').trim().isLength({ min: 1 }).withMessage('Nom anglais requis'),
  body('quantite').optional().isFloat({ min: 1 }).withMessage('Quantité doit être >= 1'),
  body('montantUnitairePrevu').isFloat({ min: 0 }).withMessage('Montant prévu invalide'),
  body('montantUnitaireReel').optional().isFloat({ min: 0 }),
  body('taxes').optional().isArray().withMessage('Le champ taxes doit être un tableau'),
  body('taxes.*').isMongoId().withMessage('Chaque taxe doit être un ID Mongo valide'),
  body('type').isIn(['ACQUISITION_BIENS_SERVICES', 'FRAIS_ADMINISTRATIF']).withMessage('Type invalide'),
 
];