// services/evaluationAChaudStatsService.js
import mongoose from 'mongoose';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';

/**
 * Fonction d'agrégation avancée permettant de générer des statistiques 
 * sur les réponses à chaud d'une formation, regroupées par un critère utilisateur donné.
 * 
 * Elle retourne, pour chaque valeur du champ de regroupement (ex: sexe, tranche d'âge, service, etc.), 
 * la liste des rubriques, questions et sous-questions évaluées, avec :
 *  - la note moyenne attribuée
 *  - le nombre total de réponses
 * 
 * Champs de regroupement supportés :
 *  - "sexe" : sexe de l'utilisateur
 *  - "service" : nom du service de l'utilisateur
 *  - "categorieProfessionnelle" : nom de la catégorie professionnelle
 *  - "familleMetier" : famille métier (contenue dans categorieProfessionnelle)
 *  - "trancheAge" : tranche d'âge calculée à partir de la date de naissance
 *  - "utilisateur" : par utilisateur (nom complet ou ID selon ton affichage)
 * 
 * Étapes principales :
 *  1. Filtrage par formation
 *  2. Jointure avec les données utilisateur
 *  3. Détermination dynamique de la clé de regroupement (`groupKey`)
 *  4. Dénormalisation des réponses individuelles
 *  5. Agrégation par groupe + rubrique/question/sous-question
 *  6. Restructuration des résultats
 * 
 * @param {string} formationId - ID de la formation cible
 * @param {string} field - Clé utilisateur sur laquelle regrouper les statistiques
 * @returns {Promise<object>} - Résultat structuré des statistiques ou message d'erreur
 */


export const getStatsGroupedByField = async (formationId, field) => {
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(String(formationId)) } },
            {
                $lookup: {
                    from: 'utilisateurs',
                    localField: 'utilisateur',
                    foreignField: '_id',
                    as: 'utilisateur'
                }
            },
            { $unwind: '$utilisateur' },
            {
                $addFields: {
                    groupKey: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [field, 'trancheAge'] },
                                    then: {
                                        $switch: {
                                            branches: [
                                                {
                                                    case: {
                                                        $lte: [
                                                            { $subtract: [
                                                                { $year: new Date() },
                                                                { $year: '$utilisateur.dateNaissance' }
                                                            ] },
                                                            25
                                                        ]
                                                    },
                                                    then: 'Moins de 25'
                                                },
                                                {
                                                    case: {
                                                        $lte: [
                                                            { $subtract: [
                                                                { $year: new Date() },
                                                                { $year: '$utilisateur.dateNaissance' }
                                                            ] },
                                                            35
                                                        ]
                                                    },
                                                    then: '26-35'
                                                },
                                                {
                                                    case: {
                                                        $lte: [
                                                            { $subtract: [
                                                                { $year: new Date() },
                                                                { $year: '$utilisateur.dateNaissance' }
                                                            ] },
                                                            45
                                                        ]
                                                    },
                                                    then: '36-45'
                                                },
                                                {
                                                    case: {
                                                        $lte: [
                                                            { $subtract: [
                                                                { $year: new Date() },
                                                                { $year: '$utilisateur.dateNaissance' }
                                                            ] },
                                                            55
                                                        ]
                                                    },
                                                    then: '46-55'
                                                }
                                            ],
                                            default: 'Plus de 55'
                                        }
                                    }
                                },
                                {
                                    case: { $eq: [field, 'familleMetier'] },
                                    then: '$utilisateur.categorieProfessionnelle.familleMetier'
                                },
                                {
                                    case: { $eq: [field, 'categorieProfessionnelle'] },
                                    then: '$utilisateur.categorieProfessionnelle.nom'
                                },
                                {
                                    case: { $eq: [field, 'service'] },
                                    then: '$utilisateur.service.nom'
                                },
                                {
                                    case: { $eq: [field, 'sexe'] },
                                    then: '$utilisateur.sexe'
                                }
                            ],
                            default: null
                        }
                    }
                }
            },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: {
                        groupe: '$groupKey',
                        rubrique: '$reponses.rubrique',
                        question: '$reponses.question',
                        sousQuestion: '$reponses.sousQuestion'
                    },
                    moyenne: { $avg: '$reponses.note' },
                    total: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.groupe',
                    rubriques: {
                        $push: {
                            rubrique: '$_id.rubrique',
                            question: '$_id.question',
                            sousQuestion: '$_id.sousQuestion',
                            moyenne: '$moyenne',
                            total: '$total'
                        }
                    }
                }
            }
        ]);

        return { success: true, data: stats };
    } catch (err) {
        return {
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        };
    }
};
