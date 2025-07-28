// services/evaluationAChaudStatsService.js
import mongoose from 'mongoose';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';

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


// Calcul des statistiques d'une question adaptée à votre modèle
export async function getQuestionStats(evaluationId, questionId, lang) {
    // Récupération de l'évaluation pour obtenir l'échelle
    const evaluation = await EvaluationAChaud.findById(evaluationId);
    const question = findQuestionInEvaluation(evaluation, questionId);
    
    if (!question) {
        throw new Error('Question non trouvée');
    }

    const pipeline = [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        {
            $addFields: {
                reponsesPourStats: {
                    $cond: {
                        if: { $gt: [{ $size: '$rubriques.questions.sousReponses' }, 0] },
                        then: '$rubriques.questions.sousReponses',
                        else: [{ reponseEchelleId: '$rubriques.questions.reponseEchelleId' }]
                    }
                }
            }
        },
        { $unwind: '$reponsesPourStats' },
        {
            $group: {
                _id: '$reponsesPourStats.reponseEchelleId',
                count: { $sum: 1 }
            }
        }
    ];

    const repartitionBrute = await EvaluationAChaudReponse.aggregate(pipeline);
    
    // Conversion en valeurs numériques basées sur l'ordre de l'échelle
    const repartition = [];
    let totalReponses = 0;
    let sommeValues = 0;

    for (const item of repartitionBrute) {
        const echelleItem = question.echelle.find(e => e._id.toString() === item._id.toString());
        if (echelleItem) {
            repartition.push({
                ordre: echelleItem.ordre,
                count: item.count,
                echelle: lang === 'fr' ? echelleItem.valeurFr : echelleItem.valeurEn
            });
            totalReponses += item.count;
            sommeValues += echelleItem.ordre * item.count;
        }
    }

    // Tri par ordre
    repartition.sort((a, b) => a.ordre - b.ordre);
    
    const moyenne = totalReponses > 0 ? sommeValues / totalReponses : 0;

    // Formatage de la répartition avec couleurs
    const couleurs = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    
    const repartitionFormatee = question.echelle
        .sort((a, b) => a.ordre - b.ordre)
        .map((echelle, index) => {
            const item = repartition.find(r => r.ordre === echelle.ordre);
            return {
                echelle: lang === 'fr' ? echelle.valeurFr : echelle.valeurEn,
                valeur: item ? item.count : 0,
                couleur: couleurs[index] || '#6b7280'
            };
        });

    // Sous-questions si elles existent
    const sousQuestionsStats = await getSousQuestionsStats(evaluationId, questionId, question, lang);

    return {
        id: questionId,
        libelle: lang === 'fr' ? question.libelleFr : question.libelleEn,
        moyenne: parseFloat(moyenne.toFixed(2)),
        totalReponses,
        repartition: repartitionFormatee,
        sousQuestions: sousQuestionsStats
    };
}

// Statistiques des sous-questions adaptées à votre modèle
export async function getSousQuestionsStats(evaluationId, questionId, question, lang) {
    if (!question.sousQuestions || question.sousQuestions.length === 0) {
        return [];
    }

    const pipeline = [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        { $unwind: '$rubriques.questions.sousReponses' },
        {
            $group: {
                _id: {
                    sousQuestionId: '$rubriques.questions.sousReponses.sousQuestionId',
                    reponseEchelleId: '$rubriques.questions.sousReponses.reponseEchelleId'
                },
                count: { $sum: 1 }
            }
        }
    ];

    const statsRaw = await EvaluationAChaudReponse.aggregate(pipeline);
    
    const sousQuestionsStats = [];
    
    for (const sousQuestion of question.sousQuestions) {
        const reponsesSubQ = statsRaw.filter(s => 
            s._id.sousQuestionId.toString() === sousQuestion._id.toString()
        );
        
        let totalReponses = 0;
        let sommeValues = 0;
        
        for (const reponse of reponsesSubQ) {
            const echelleItem = question.echelle.find(e => 
                e._id.toString() === reponse._id.reponseEchelleId.toString()
            );
            if (echelleItem) {
                totalReponses += reponse.count;
                sommeValues += echelleItem.ordre * reponse.count;
            }
        }
        
        const moyenne = totalReponses > 0 ? sommeValues / totalReponses : 0;
        
        sousQuestionsStats.push({
            sousQuestionId: sousQuestion._id,
            libelle: lang === 'fr' ? sousQuestion.libelleFr : sousQuestion.libelleEn,
            moyenne: parseFloat(moyenne.toFixed(2))
        });
    }
    
    return sousQuestionsStats;
}

// Recherche d'une question dans l'évaluation
export function findQuestionInEvaluation(evaluation, questionId) {
    for (const rubrique of evaluation.rubriques) {
        const question = rubrique.questions.find(q => q._id.toString() === questionId);
        if (question) return question;
    }
    return null;
}

// Évolution des stats sur plusieurs mois
export async function getEvolutionStats(themeId, nombreMois) {
    const evolution = [];
    const maintenant = new Date();
    
    for (let i = nombreMois - 1; i >= 0; i--) {
        const debut = new Date(maintenant);
        debut.setMonth(debut.getMonth() - i - 1);
        debut.setDate(1);
        
        const fin = new Date(debut);
        fin.setMonth(fin.getMonth() + 1);
        
        const stats = await ReponseEvaluation.aggregate([
            {
                $lookup: {
                    from: 'evaluationchauds',
                    localField: 'evaluationId',
                    foreignField: '_id',
                    as: 'evaluation'
                }
            },
            { $unwind: '$evaluation' },
            {
                $match: {
                    'evaluation.theme': themeId,
                    createdAt: { $gte: debut, $lt: fin }
                }
            },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: null,
                    moyenne: { $avg: '$reponses.valeurEchelle' }
                }
            }
        ]);
        
        evolution.push({
            mois: debut.toLocaleDateString('fr-FR', { month: 'short' }),
            moyenne: stats[0] ? parseFloat(stats[0].moyenne.toFixed(2)) : 0
        });
    }
    
    return evolution;
}

// Formatage CSV
export function formatToCSV(donnees, evaluation, lang) {
    const headers = ['Participant', 'Question ID', 'Valeur Échelle', 'Commentaire', 'Date Réponse'];
    const rows = donnees.map(item => [
        `${item.participantPrenom} ${item.participantNom}`,
        item.questionId,
        item.valeurEchelle,
        item.commentaire || '',
        item.dateReponse.toLocaleDateString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Top évaluations
export async function getTopEvaluations(matchCondition, lang, limit) {
    return await EvaluationAChaud.aggregate([
        { $match: matchCondition },
        {
            $lookup: {
                from: 'reponseevaluations',
                localField: '_id',
                foreignField: 'evaluationId',
                as: 'reponses'
            }
        },
        {
            $addFields: {
                moyenneEvaluation: {
                    $avg: {
                        $map: {
                            input: '$reponses',
                            as: 'reponse',
                            in: {
                                $avg: {
                                    $map: {
                                        input: '$$reponse.reponses',
                                        as: 'rep',
                                        in: '$$rep.valeurEchelle'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        { $sort: { moyenneEvaluation: -1 }},
        { $limit: limit },
        {
            $project: {
                titre: lang === 'fr' ? '$titreFr' : '$titreEn',
                moyenne: '$moyenneEvaluation',
                totalReponses: { $size: '$reponses' }
            }
        }
    ]);
}

// Évolution mensuelle
export async function getEvolutionMensuelle(matchCondition) {
    return await ReponseEvaluation.aggregate([
        {
            $lookup: {
                from: 'evaluationchauds',
                localField: 'evaluationId',
                foreignField: '_id',
                as: 'evaluation'
            }
        },
        { $unwind: '$evaluation' },
        { $match: { 'evaluation': matchCondition }},
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                moyenne: { $avg: { $avg: '$reponses.valeurEchelle' }},
                totalReponses: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 }}
    ]);
}
