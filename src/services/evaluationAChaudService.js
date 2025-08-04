// services/evaluationAChaudStatsService.js
import mongoose from 'mongoose';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import EvaluationChaud from '../models/EvaluationAChaud.js';

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
// On assume que les modèles et mongoose sont importés
// Une fonction utilitaire pour trouver la question
export const findQuestionInEvaluation = (evaluation, questionId) => {
    for (const rubrique of evaluation.rubriques) {
        for (const question of rubrique.questions) {
            if (question._id.toString() === questionId.toString()) {
                return question;
            }
        }
    }
    return null;
};

// Calcul des statistiques d'une question adaptée à votre modèle
export async function getQuestionStats(evaluationId, questionId, lang) {
    // Récupération de l'évaluation pour obtenir l'échelle et la structure
    const evaluation = await EvaluationChaud.findById(evaluationId);
    const question = findQuestionInEvaluation(evaluation, questionId);
    
    if (!question) {
        throw new Error('Question non trouvée');
    }

    // Le pipeline d'agrégation a été corrigé pour utiliser les bons noms de champs
    const pipeline = [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        {
            $addFields: {
                reponsesPourStats: {
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
                        // Correction ici : 'sousQuestions' au lieu de 'sousReponses'
                        then: '$rubriques.questions.sousQuestions', 
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
        },
        // Ajout d'un lookup pour joindre les échelles de réponses et obtenir l'ordre
        {
            $lookup: {
                from: 'echellereponses',
                localField: '_id',
                foreignField: '_id',
                as: 'echelleData'
            }
        },
        { $unwind: '$echelleData' },
        {
            $addFields: {
                ordre: '$echelleData.ordre'
            }
        },
        { $sort: { ordre: 1 } } // Tri direct dans l'agrégation
    ];

    const repartitionBrute = await EvaluationAChaudReponse.aggregate(pipeline);
    
    // Conversion en valeurs numériques basées sur l'ordre de l'échelle
    // Le code JavaScript est grandement simplifié car le travail est fait dans l'agrégation
    let totalReponses = 0;
    let sommeValues = 0;

    for (const item of repartitionBrute) {
        totalReponses += item.count;
        sommeValues += item.ordre * item.count;
    }
    
    const moyenne = totalReponses > 0 ? sommeValues / totalReponses : 0;
    
    // Le reste du code reste pertinent mais sera adapté
    
    // Formatage de la répartition avec couleurs
    const couleurs = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    
    // On doit charger les échelles pour le mapping
    const echelles = await mongoose.model('EchelleReponse').find({ _id: { $in: question.echelles } }).sort({ ordre: 1 });

    const repartitionFormatee = echelles.map((echelle, index) => {
        const item = repartitionBrute.find(r => r.ordre === echelle.ordre);
        return {
            echelle: lang === 'fr' ? echelle.nomFr : echelle.nomEn,
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

    // Le pipeline a été corrigé pour utiliser le bon chemin d'accès ('sousQuestions')
    const pipeline = [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        { $unwind: '$rubriques.questions.sousQuestions' }, // Correction ici
        {
            $group: {
                _id: {
                    sousQuestionId: '$rubriques.questions.sousQuestions.sousQuestionId', // Correction ici
                    reponseEchelleId: '$rubriques.questions.sousQuestions.reponseEchelleId' // Correction ici
                },
                count: { $sum: 1 }
            }
        }
    ];

    const statsRaw = await EvaluationAChaudReponse.aggregate(pipeline);
    
    const sousQuestionsStats = [];
    
    // Le code JavaScript est corrigé pour utiliser le bon nom de champ (question.echelles)
    for (const sousQuestion of question.sousQuestions) {
        const reponsesSubQ = statsRaw.filter(s => 
            s._id.sousQuestionId.toString() === sousQuestion._id.toString()
        );
        
        let totalReponses = 0;
        let sommeValues = 0;
        
        for (const reponse of reponsesSubQ) {
            // Correction ici : le champ dans votre modèle est 'echelles' au pluriel
            const echelleItem = question.echelles.find(e => 
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

// Fonctions d'agrégation réutilisables
// (Vous pouvez les déplacer dans un fichier utilitaire si vous le souhaitez)
export const getBasePipelineForStats = (evaluationId) => [
    { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
    { $unwind: '$rubriques' },
    { $unwind: '$rubriques.questions' },
    {
        $addFields: {
            reponseEchelleIds: {
                $cond: {
                    if: { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
                    then: '$rubriques.questions.sousQuestions.reponseEchelleId',
                    else: ['$rubriques.questions.reponseEchelleId']
                }
            },
            questionId: '$rubriques.questions.questionId',
            rubriqueId: '$rubriques.rubriqueId',
        }
    },
    { $match: { reponseEchelleIds: { $ne: [null] } } },
    {
        $lookup: {
            from: 'echellereponses',
            localField: 'reponseEchelleIds',
            foreignField: '_id',
            as: 'echellesReponse'
        }
    },
    {
        $addFields: {
            valeurNumerique: {
                $avg: '$echellesReponse.ordre'
            },
            ordresNumeriques: '$echellesReponse.ordre'
        }
    },
    { $match: { valeurNumerique: { $ne: null } } }
];

// Pipeline pour les statistiques des sous-questions (Corrigé pour inclure toutes les stats)
export const getSousQuestionsPipeline = (evaluationId) => [
    { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
    { $unwind: '$rubriques' },
    { $unwind: '$rubriques.questions' },
    { $unwind: '$rubriques.questions.sousQuestions' },
    {
        $lookup: {
            from: 'echellereponses',
            localField: 'rubriques.questions.sousQuestions.reponseEchelleId',
            foreignField: '_id',
            as: 'echelleReponse'
        }
    },
    { $unwind: '$echelleReponse' },
    {
        $group: {
            _id: {
                questionId: '$rubriques.questions.questionId',
                sousQuestionId: '$rubriques.questions.sousQuestions.sousQuestionId'
            },
            // Ajout des nouvelles statistiques
            moyenne: { $avg: '$echelleReponse.ordre' },
            min: { $min: '$echelleReponse.ordre' },
            max: { $max: '$echelleReponse.ordre' },
            count: { $sum: 1 },
            ordres: { $push: '$echelleReponse.ordre' }
        }
    }
];



// Évolution des stats sur plusieurs mois
export async function getEvolutionStatsSimple(themeId, nombreMois) {
    const evolution = [];
    const maintenant = new Date();
    
    for (let i = nombreMois - 1; i >= 0; i--) {
        const debut = new Date(maintenant);
        debut.setMonth(debut.getMonth() - i - 1);
        debut.setDate(1);
        debut.setHours(0, 0, 0, 0);
        
        const fin = new Date(debut);
        fin.setMonth(fin.getMonth() + 1);
        fin.setHours(0, 0, 0, 0);
        
        // Compter le nombre total de réponses pour ce thème sur la période
        const totalReponses = await EvaluationAChaudReponse.aggregate([
            {
                $match: {
                    dateSoumission: { $gte: debut, $lt: fin }
                }
            },
            {
                $lookup: {
                    from: 'evaluationchauds',
                    localField: 'modele',
                    foreignField: '_id',
                    as: 'evaluation'
                }
            },
            { $unwind: '$evaluation' },
            {
                $match: {
                    'evaluation.theme': new mongoose.Types.ObjectId(themeId)
                }
            },
            {
                $count: "total"
            }
        ]);
        
        const moisFormate = debut.toLocaleDateString('fr-FR', { 
            month: 'short',
            year: 'numeric'
        });
        
        evolution.push({
            mois: moisFormate,
            moyenne: 0, // À calculer avec la pipeline complète si nécessaire
            totalReponses: totalReponses[0] ? totalReponses[0].total : 0,
            periode: {
                debut: debut.toISOString(),
                fin: fin.toISOString()
            }
        });
    }
    
    return evolution;
}

// Service pour calculer des indicateurs avancés

export const getAdvancedEvaluationStats = async (evaluationId) => {
    
    // --- NOUVEAU : Calcul du nombre total de participants ---
    // Chaque document de réponse représente un participant distinct.
    const totalParticipants = await EvaluationAChaudReponse.countDocuments({
        modele: new mongoose.Types.ObjectId(evaluationId)
    });
    
    // --- NOUVEAU : Calcul du nombre total de commentaires ---
    const totalCommentaires = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        {
            $group: {
                _id: null,
                // Compter les commentaires généraux
                totalCommentairesGeneraux: {
                    $sum: { $cond: [{ $gt: ['$commentaireGeneral', null] }, 1, 0] }
                },
                // Déployer les rubriques et les questions
                rubriques: { $push: '$rubriques' }
            }
        },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $group: {
                _id: null,
                totalCommentairesGeneraux: { $first: '$totalCommentairesGeneraux' },
                // Compter les commentaires globaux des questions
                totalCommentairesQuestions: {
                    $sum: { $cond: [{ $gt: ['$rubriques.questions.commentaireGlobal', null] }, 1, 0] }
                },
                // Déployer les sous-questions pour compter les commentaires individuels
                sousQuestions: { $push: '$rubriques.questions.sousQuestions' }
            }
        },
        { $unwind: '$sousQuestions' },
        { $unwind: '$sousQuestions' },
        {
            $group: {
                _id: null,
                totalCommentairesGeneraux: { $first: '$totalCommentairesGeneraux' },
                totalCommentairesQuestions: { $first: '$totalCommentairesQuestions' },
                // Compter les commentaires des sous-questions
                totalCommentairesSousQuestions: {
                    $sum: { $cond: [{ $gt: ['$sousQuestions.commentaire', null] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                nombreTotal: {
                    $add: ['$totalCommentairesGeneraux', '$totalCommentairesQuestions', '$totalCommentairesSousQuestions']
                }
            }
        }
    ]);
    
    // Valeur par défaut si aucun commentaire n'est trouvé
    const nombreTotalCommentaires = totalCommentaires[0]?.nombreTotal || 0;
    
    // Pipeline de base existant (inchangé)
    const basePipeline = [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        
        {
            $lookup: {
                from: 'evaluationchauds',
                localField: 'modele',
                foreignField: '_id',
                as: 'evaluation'
            }
        },
        { $unwind: '$evaluation' },
        
        {
            $addFields: {
                questionData: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: {
                                    $reduce: {
                                        input: '$evaluation.rubriques',
                                        initialValue: [],
                                        in: { $concatArrays: ['$$value', '$$this.questions'] }
                                    }
                                },
                                cond: { $eq: ['$$this._id', '$rubriques.questions.questionId'] }
                            }
                        }, 0
                    ]
                }
            }
        },
        
        {
            $lookup: {
                from: 'echellereponses',
                localField: 'questionData.echelles',
                foreignField: '_id',
                as: 'echelles'
            }
        },
        
        {
            $addFields: {
                valeurNumerique: {
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
                        then: {
                            $avg: {
                                $map: {
                                    input: '$rubriques.questions.sousQuestions',
                                    as: 'sousRep',
                                    in: {
                                        $let: {
                                            vars: {
                                                echelle: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$echelles',
                                                                cond: { $eq: ['$$this._id', '$$sousRep.reponseEchelleId'] }
                                                            }
                                                        }, 0
                                                    ]
                                                }
                                            },
                                            in: '$$echelle.ordre'
                                        }
                                    }
                                }
                            }
                        },
                        else: {
                            $let: {
                                vars: {
                                    echelle: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$echelles',
                                                    cond: { $eq: ['$$this._id', '$rubriques.questions.reponseEchelleId'] }
                                                }
                                            }, 0
                                        ]
                                    }
                                },
                                in: '$$echelle.ordre'
                            }
                        }
                    }
                }
            }
        }
    ];

    const basePipelineForStats = [
        ...basePipeline,
        { $match: { valeurNumerique: { $ne: null, $exists: true } } }
    ];

    const statsParQuestion = await EvaluationAChaudReponse.aggregate([
        ...basePipelineForStats,
        {
            $group: {
                _id: '$rubriques.questions.questionId',
                rubriqueId: { $first: '$rubriques.rubriqueId' },
                valeurs: { $push: '$valeurNumerique' },
                moyenne: { $avg: '$valeurNumerique' },
                minimum: { $min: '$valeurNumerique' },
                maximum: { $max: '$valeurNumerique' },
                count: { $sum: 1 },
            }
        }
    ]);
    
    let totalReponsesGlobal = 0;
    let sommeMoyennesQuestions = 0;
    let distributionGlobale = {};
    const performanceRubriquesMap = {};
    const statsParQuestionFinal = [];

    statsParQuestion.forEach(q => {
        const distributionMap = q.valeurs.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
        
        const countLow = distributionMap[q.minimum] || 0;
        const countHigh = distributionMap[q.maximum] || 0;
        
        let tendance = 'neutre';
        if (countHigh > countLow) {
            tendance = 'positive';
        } else if (countLow > countHigh) {
            tendance = 'négative';
        }
        
        statsParQuestionFinal.push({
            questionId: q._id,
            moyenne: parseFloat(q.moyenne.toFixed(2)),
            nbReponses: q.count,
            distribution: distributionMap,
            tendance: tendance
        });

        totalReponsesGlobal += q.count;
        sommeMoyennesQuestions += q.moyenne;
        for (const [note, count] of Object.entries(distributionMap)) {
            distributionGlobale[note] = (distributionGlobale[note] || 0) + count;
        }

        const rubriqueId = q.rubriqueId;
        if (!performanceRubriquesMap[rubriqueId]) {
            performanceRubriquesMap[rubriqueId] = { sumMoyennes: 0, countQuestions: 0, nbReponses: 0 };
        }
        performanceRubriquesMap[rubriqueId].sumMoyennes += q.moyenne;
        performanceRubriquesMap[rubriqueId].countQuestions += 1;
        performanceRubriquesMap[rubriqueId].nbReponses += q.count;
    });

    const moyenneGlobale = totalReponsesGlobal > 0 ? parseFloat((sommeMoyennesQuestions / statsParQuestion.length).toFixed(2)) : 0;
    
    const performanceRubriques = Object.keys(performanceRubriquesMap).map(id => ({
        id: id,
        moyenne: parseFloat((performanceRubriquesMap[id].sumMoyennes / performanceRubriquesMap[id].countQuestions).toFixed(2)),
        nbReponses: performanceRubriquesMap[id].nbReponses
    }));

    // Pipeline pour les réponses manquantes (corrigé)
    const reponsesManquantes = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $match: {
                'rubriques.questions.reponseEchelleId': { $eq: null },
                'rubriques.questions.sousQuestions': { $eq: [] } 
            }
        },
        {
            $group: {
                _id: '$rubriques.questions.questionId',
                nombreManquant: { $sum: 1 }
            }
        }
    ]);
    
    return {
        statistiquesDescriptives: {
            moyenne: moyenneGlobale,
            count: totalReponsesGlobal,
            minimum: totalReponsesGlobal > 0 ? Math.min(...Object.keys(distributionGlobale)) : 0,
            maximum: totalReponsesGlobal > 0 ? Math.max(...Object.keys(distributionGlobale)) : 0,
            nombreParticipants: totalParticipants,
            nombreCommentaires: nombreTotalCommentaires,
        },
        distribution: {
            details: distributionGlobale,
        },
        performanceRubriques: performanceRubriques,
        statsParQuestion: statsParQuestionFinal, 
        reponsesManquantes: reponsesManquantes.map(r => ({
            questionId: r._id,
            nombre: r.nombreManquant
        }))
    };
};



export const debugEvaluationData = async (evaluationId) => {
    console.log('🔍 DÉBUT DEBUG pour évaluation:', evaluationId);
    
    // 1. Vérifier les réponses brutes
    const reponsesRaw = await EvaluationAChaudReponse.find({ 
        modele: evaluationId 
    }).lean();
    
    console.log('📊 Nombre de réponses trouvées:', reponsesRaw.length);
    console.log('📋 Première réponse (structure):', JSON.stringify(reponsesRaw[0], null, 2));
    
    // 2. Vérifier l'évaluation et ses échelles
    const evaluation = await EvaluationChaud.findById(evaluationId)
        .populate('rubriques.questions.echelles')
        .lean();
    
    console.log('🎯 Évaluation trouvée:', !!evaluation);
    if (evaluation) {
        console.log('🏷️ Titre:', evaluation.titreFr);
        console.log('📚 Nombre de rubriques:', evaluation.rubriques.length);
        
        // Afficher la structure des échelles
        const premiereQuestion = evaluation.rubriques[0]?.questions[0];
        if (premiereQuestion) {
            console.log('❓ Première question échelles:', premiereQuestion.echelles);
        }
    }
    
    // 3. Test du pipeline étape par étape
    const etape1 = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } }
    ]);
    console.log('🔄 Étape 1 - Après match:', etape1.length);
    
    const etape2 = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' }
    ]);
    console.log('🔄 Étape 2 - Après unwind rubriques:', etape2.length);
    
    const etape3 = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId) } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' }
    ]);
    console.log('🔄 Étape 3 - Après unwind questions:', etape3.length);
    
    if (etape3.length > 0) {
        console.log('📝 Exemple de question après unwind:', {
            questionId: etape3[0].rubriques.questions.questionId,
            reponseEchelleId: etape3[0].rubriques.questions.reponseEchelleId,
            sousQuestions: etape3[0].rubriques.questions.sousQuestions
        });
    }
    
    return {
        nombreReponses: reponsesRaw.length,
        evaluationTrouvee: !!evaluation,
        apresMatch: etape1.length,
        apresUnwindRubriques: etape2.length,
        apresUnwindQuestions: etape3.length
    };
};

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
    return await EvaluationChaud.aggregate([
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

// Calculer la progression
export function calculateProgression(rubriques, evaluationModel) {
    if (!rubriques || !Array.isArray(rubriques)) return 0;
    
    let totalQuestions = 0;
    let questionsRepondues = 0;

    // Compter les questions du modèle
    evaluationModel.rubriques.forEach(rubrique => {
        rubrique.questions.forEach(question => {
            totalQuestions++;
            if (question.sousQuestions && question.sousQuestions.length > 0) {
                totalQuestions += question.sousQuestions.length - 1; // -1 car la question principale compte déjà
            }
        });
    });

    // Compter les réponses
    rubriques.forEach(rubrique => {
        if (rubrique.questions) {
            rubrique.questions.forEach(question => {
                if (question.reponseEchelleId) {
                    questionsRepondues++;
                } else if (question.sousReponses && question.sousReponses.length > 0) {
                    questionsRepondues += question.sousReponses.filter(sr => sr.reponseEchelleId).length;
                }
            });
        }
    });

    return totalQuestions > 0 ? Math.round((questionsRepondues / totalQuestions) * 100) : 0;
}

// Formater les rubriques
export function formatRubriques(rubriques) {
    if (!rubriques || !Array.isArray(rubriques)) return [];
    
    return rubriques.map(rubrique => ({
        rubriqueId: new mongoose.Types.ObjectId(rubrique.rubriqueId),
        questions: rubrique.questions ? rubrique.questions.map(question => ({
            questionId: new mongoose.Types.ObjectId(question.questionId),
            reponseEchelleId: question.reponseEchelleId ? 
                new mongoose.Types.ObjectId(question.reponseEchelleId) : undefined,
            sousReponses: question.sousReponses ? question.sousReponses.map(sr => ({
                sousQuestionId: new mongoose.Types.ObjectId(sr.sousQuestionId),
                reponseEchelleId: sr.reponseEchelleId ? 
                    new mongoose.Types.ObjectId(sr.reponseEchelleId) : undefined,
                commentaire: sr.commentaire
            })).filter(sr => sr.reponseEchelleId) : undefined,
            commentaireGlobal: question.commentaireGlobal
        })).filter(q => q.reponseEchelleId || (q.sousReponses && q.sousReponses.length > 0)) : []
    })).filter(r => r.questions.length > 0);
}

// Validation complète pour finalisation
export function validateCompleteEvaluation(rubriques, evaluationModel) {
    const errors = [];
    
    // Vérifier que toutes les questions obligatoires ont une réponse
    evaluationModel.rubriques.forEach(rubriqueModel => {
        const rubriqueReponse = rubriques.find(r => r._id === rubriqueModel._id.toString());
        
        if (!rubriqueReponse) {
            errors.push(`Rubrique "${rubriqueModel.titreFr}" non remplie`);
            return;
        }

        rubriqueModel.questions.forEach(questionModel => {
            const questionReponse = rubriqueReponse.questions.find(q => 
                q._id === questionModel._id.toString()
            );

            if (!questionReponse) {
                errors.push(`Question "${questionModel.texteFr}" non répondue`);
                return;
            }

            // Validation selon le type de question
            if (questionModel.sousQuestions && questionModel.sousQuestions.length > 0) {
                // Question avec sous-questions
                if (!questionReponse.sousReponses || questionReponse.sousReponses.length === 0) {
                    errors.push(`Question "${questionModel.texteFr}" incomplète`);
                } else {
                    // Vérifier que toutes les sous-questions obligatoires ont une réponse
                    questionModel.sousQuestions.forEach(sousQuestion => {
                        const sousReponse = questionReponse.sousReponses.find(sr => 
                            sr.sousQuestion._id === sousQuestion._id.toString()
                        );
                        if (!sousReponse || !sousReponse.reponseEchelleId) {
                            errors.push(`Sous-question "${sousQuestion.texteFr}" non répondue`);
                        }
                    });
                }
            } else {
                // Question simple
                if (!questionReponse.reponseEchelleId) {
                    errors.push(`Question "${questionModel.texteFr}" non répondue`);
                }
            }
        });
    });

    return errors;
}
