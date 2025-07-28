import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Formation from '../models/Formation.js';
import { getEvolutionStats,getSousQuestionsStats, getQuestionStats, getStatsGroupedByField, findQuestionInEvaluation, formatToCSV, getTopEvaluations, getEvolutionMensuelle } from '../services/evaluationAChaudService.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';

// Soumettre une réponse à une évaluation
export const submitEvaluationAChaudReponse = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { formation, utilisateur, modele } = req.body;

        const dejaRepondu = await EvaluationAChaudReponse.findOne({ formation, utilisateur, modele });
        if (dejaRepondu) {
            return res.status(400).json({ 
                success: false, 
                message: t('evaluation_deja_repondu', lang) 
            });
        }

        const reponse = new EvaluationAChaudReponse(req.body);
        await reponse.save();

        return res.status(201).json({ 
            success: true, 
            message: t('ajoute_succes', lang), 
            data: reponse 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Obtenir les réponses d’un utilisateur
export const getReponsesParUtilisateur = async (req, res) => {
    const { utilisateurId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ utilisateur: utilisateurId })
        .populate('modele', 'titreFr titreEn')
        .populate('formation', 'themeFr themeEn');

        return res.status(200).json({ 
            success: true, 
            data: reponses 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Obtenir les réponses d'une session de formation
export const getReponsesParSession = async (req, res) => {
    const { formationId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ formation: formationId })
        .populate('utilisateur', 'nom prenom email')
        .populate('modele', 'titreFr titreEn');

        return res.status(200).json({ 
            success: true, 
            data: reponses 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Statistiques globales

export const getStatsParRubrique = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.rubrique',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const getStatsParQuestion = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.question',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


export const getStatsParSousQuestion = async (req, res) => {
    const { formationId } = req.params;
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { formation: new mongoose.Types.ObjectId(formationId) } },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: '$reponses.sousQuestion',
                    total: { $sum: 1 }
                }
            }
        ]);
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

//Taux de personne ayant participer au sondage
export const getTauxReponseFormation = async (req, res) => {
    const { formationId } = req.params;
    try {
        const formation = await Formation.findById(formationId).populate('participants');

        const nbAttendus = formation?.participants?.length || 0;

        const nbReponses = await EvaluationAChaudReponse.countDocuments({ formation: formationId });

        const taux = nbAttendus > 0 ? (nbReponses / nbAttendus) * 100 : 0;

        return res.status(200).json({
            success: true,
            data: { totalAttendus: nbAttendus, totalReponses: nbReponses, taux }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Reponses d'un utilisateur
export const getReponsesUtilisateur = async (req, res) => {
    const { utilisateurId } = req.params;
    try {
        const reponses = await EvaluationAChaudReponse.find({ utilisateur: utilisateurId })
            .populate('formation', 'intituleFr intituleEn')
            .populate('modele', 'titreFr titreEn');

        return res.status(200).json({ success: true, data: reponses });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Générer des stats sur les réponses utilisateur
export const getStatsByField = async (req, res) => {
    const { formationId } = req.params;
    const { field } = req.query; // exemple: ?field=sexe

    const result = await getStatsGroupedByField(formationId, field);

    return res.status(result.success ? 200 : 500).json(result);
};


//Par participant (utilisateur spécifique)
export const getStatsParParticipant = async (req, res) => {
    const { utilisateurId, formationId } = req.params;

    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            {
                $match: {
                    formation: new mongoose.Types.ObjectId(formationId),
                    utilisateur: new mongoose.Types.ObjectId(utilisateurId)
                }
            },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: {
                        rubrique: '$reponses.rubrique',
                        question: '$reponses.question',
                        sousQuestion: '$reponses.sousQuestion'
                    },
                    moyenne: { $avg: '$reponses.note' },
                    total: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


// 1. Statistiques générales d'une évaluation
export const getEvaluationStats = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    
    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId)
            .populate('theme', 'nomFr nomEn');
        
        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        const totalReponses = await EvaluationAChaudReponse.countDocuments({ 
            modele: evaluationId
        });

        const totalParticipants = await EvaluationAChaudReponse.distinct('utilisateur', {
            modele: evaluationId
        }).length;

        // Calcul de la moyenne globale avec votre structure
        const pipeline = [
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
                                            in: { $concatArrays: ['$value', '$this.questions'] }
                                        }
                                    },
                                    cond: { $eq: ['$this._id', '$rubriques.questions.questionId'] }
                                }
                            }, 0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    valeurNumerique: {
                        $cond: {
                            if: { $gt: [{ $size: '$rubriques.questions.sousReponses' }, 0] },
                            then: {
                                // Pour les questions avec sous-réponses, calculer la moyenne des sous-réponses
                                $avg: {
                                    $map: {
                                        input: '$rubriques.questions.sousReponses',
                                        as: 'sousRep',
                                        in: {
                                            $arrayElemAt: [
                                                {
                                                    $map: {
                                                        input: '$questionData.echelle',
                                                        as: 'echelle',
                                                        in: {
                                                            $cond: {
                                                                if: { $eq: ['$echelle._id', '$sousRep.reponseEchelleId'] },
                                                                then: '$echelle.ordre',
                                                                else: null
                                                            }
                                                        }
                                                    }
                                                }, 0
                                            ]
                                        }
                                    }
                                }
                            },
                            else: {
                                // Pour les questions simples, utiliser reponseEchelleId
                                $arrayElemAt: [
                                    {
                                        $map: {
                                            input: '$questionData.echelle',
                                            as: 'echelle',
                                            in: {
                                                $cond: {
                                                    if: { $eq: ['$echelle._id', '$rubriques.questions.reponseEchelleId'] },
                                                    then: '$echelle.ordre',
                                                    else: null
                                                }
                                            }
                                        }
                                    }, 0
                                ]
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    moyenneGlobale: { $avg: '$valeurNumerique' },
                    totalReponses: { $sum: 1 }
                }
            }
        ];

        const [stats] = await EvaluationAChaudReponse.aggregate(pipeline);

        // Évolution sur les 4 derniers mois
        const evolutionData = await getEvolutionStats(evaluation.theme._id, 4);

        return res.status(200).json({
            success: true,
            data: {
                evaluation: {
                    id: evaluation._id,
                    titre: lang === 'fr' ? evaluation.titreFr : evaluation.titreEn,
                    description: lang === 'fr' ? evaluation.descriptionFr : evaluation.descriptionEn,
                    theme: lang === 'fr' ? evaluation.theme.nomFr : evaluation.theme.nomEn
                },
                statistiques: {
                    totalReponses,
                    totalParticipants,
                    tauxReponse: totalParticipants > 0 ? ((totalReponses / totalParticipants) * 100).toFixed(1) : 0,
                    moyenneGlobale: stats ? parseFloat(stats.moyenneGlobale.toFixed(2)) : 0
                },
                evolution: evolutionData
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 2. Résultats détaillés par rubrique
export const getResultatsByRubrique = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    
    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        const resultats = [];

        for (const rubrique of evaluation.rubriques) {
            const questionsStats = [];
            
            for (const question of rubrique.questions) {
                const questionStats = await getQuestionStats(evaluationId, question._id, lang);
                questionsStats.push(questionStats);
            }

            // Moyenne de la rubrique
            const moyenneRubrique = questionsStats.reduce((sum, q) => sum + q.moyenne, 0) / questionsStats.length;

            resultats.push({
                id: rubrique._id,
                titre: lang === 'fr' ? rubrique.titreFr : rubrique.titreEn,
                ordre: rubrique.ordre,
                moyenne: parseFloat(moyenneRubrique.toFixed(2)),
                questions: questionsStats
            });
        }

        // Tri par ordre
        resultats.sort((a, b) => a.ordre - b.ordre);

        return res.status(200).json({
            success: true,
            data: resultats
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 3. Détails d'une question spécifique
export const getQuestionDetails = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId, questionId } = req.params;
    
    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        const question = findQuestionInEvaluation(evaluation, questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: t('question_non_trouvee', lang)
            });
        }

        const questionStats = await getQuestionStats(evaluationId, questionId, lang);
        
        return res.status(200).json({
            success: true,
            data: questionStats
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 4. Commentaires d'une évaluation
export const getCommentaires = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const { page = 1, limit = 10, questionId } = req.query;
    
    try {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let matchCondition = { 
            evaluationId: new mongoose.Types.ObjectId(evaluationId)
        };

        let pipeline;

        if (questionId) {
            // Commentaires pour une question spécifique
            pipeline = [
                { $match: { modele: new mongoose.Types.ObjectId(evaluationId) }},
                { $unwind: '$rubriques' },
                { $unwind: '$rubriques.questions' },
                { $match: { 
                    'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId),
                    $or: [
                        { 'rubriques.questions.commentaireGlobal': { $exists: true, $ne: '' }},
                        { 'rubriques.questions.sousReponses.commentaire': { $exists: true, $ne: '' }}
                    ]
                }},
                {
                    $lookup: {
                        from: 'utilisateurs',
                        localField: 'utilisateur',
                        foreignField: '_id',
                        as: 'participant'
                    }
                },
                { $unwind: '$participant' },
                {
                    $addFields: {
                        commentaire: {
                            $cond: {
                                if: { $ne: ['$rubriques.questions.commentaireGlobal', ''] },
                                then: '$rubriques.questions.commentaireGlobal',
                                else: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: '$rubriques.questions.sousReponses.commentaire',
                                                cond: { $ne: ['$this', ''] }
                                            }
                                        }, 0
                                    ]
                                }
                            }
                        }
                    }
                },
                { $match: { commentaire: { $exists: true, $ne: '' }}},
                {
                    $project: {
                        commentaire: 1,
                        dateSoumission: 1,
                        participant: {
                            nom: '$participant.nom',
                            prenom: '$participant.prenom'
                        }
                    }
                },
                { $sort: { dateSoumission: -1 }},
                { $skip: skip },
                { $limit: parseInt(limit) }
            ];
        } else {
            // Commentaires globaux
            pipeline = [
                { $match: { 
                    modele: new mongoose.Types.ObjectId(evaluationId),
                    commentaireGeneral: { $exists: true, $ne: '' }
                }},
                {
                    $lookup: {
                        from: 'utilisateurs',
                        localField: 'utilisateur',
                        foreignField: '_id',
                        as: 'participant'
                    }
                },
                { $unwind: '$participant' },
                {
                    $project: {
                        commentaire: '$commentaireGeneral',
                        dateSoumission: 1,
                        participant: {
                            nom: '$participant.nom',
                            prenom: '$participant.prenom'
                        }
                    }
                },
                { $sort: { dateSoumission: -1 }},
                { $skip: skip },
                { $limit: parseInt(limit) }
            ];
        }

        const commentaires = await EvaluationAChaudReponse.aggregate(pipeline);
        
        const totalCommentaires = questionId ? 
            await EvaluationAChaudReponse.countDocuments({
                modele: evaluationId,
                $or: [
                    { 'rubriques.questions.questionId': questionId, 'rubriques.questions.commentaireGlobal': { $exists: true, $ne: '' }},
                    { 'rubriques.questions.questionId': questionId, 'rubriques.questions.sousReponses.commentaire': { $exists: true, $ne: '' }}
                ]
            }) :
            await EvaluationAChaudReponse.countDocuments({
                modele: evaluationId,
                commentaireGeneral: { $exists: true, $ne: '' }
            });

        return res.status(200).json({
            success: true,
            data: {
                commentaires,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCommentaires / parseInt(limit)),
                    totalCommentaires,
                    hasNext: skip + commentaires.length < totalCommentaires,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 5. Comparaison avec d'autres évaluations
export const getComparaisonEvaluations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const { themeId, periode = 6 } = req.query; // période en mois
    
    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        const dateDebut = new Date();
        dateDebut.setMonth(dateDebut.getMonth() - parseInt(periode));

        // Comparaison avec autres évaluations du même thème
        const pipeline = [
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
                    'evaluation.theme': evaluation.theme,
                    'evaluation._id': { $ne: new mongoose.Types.ObjectId(evaluationId) },
                    createdAt: { $gte: dateDebut }
                }
            },
            { $unwind: '$reponses' },
            {
                $group: {
                    _id: {
                        evaluationId: '$evaluationId',
                        titre: lang === 'fr' ? '$evaluation.titreFr' : '$evaluation.titreEn'
                    },
                    moyenne: { $avg: '$reponses.valeurEchelle' },
                    totalReponses: { $sum: 1 }
                }
            },
            { $sort: { moyenne: -1 }},
            { $limit: 5 }
        ];

        const comparaisons = await ReponseEvaluation.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            data: {
                evaluationCourante: {
                    id: evaluation._id,
                    titre: lang === 'fr' ? evaluation.titreFr : evaluation.titreEn
                },
                comparaisons: comparaisons.map(comp => ({
                    evaluationId: comp._id.evaluationId,
                    titre: comp._id.titre,
                    moyenne: parseFloat(comp.moyenne.toFixed(2)),
                    totalReponses: comp.totalReponses
                }))
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 6. Export des données
export const exportEvaluationData = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const { format = 'json' } = req.query; // json, csv, excel
    
    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        // Récupération de toutes les données
        const pipeline = [
            { $match: { evaluationId: new mongoose.Types.ObjectId(evaluationId) }},
            {
                $lookup: {
                    from: 'users',
                    localField: 'participantId',
                    foreignField: '_id',
                    as: 'participant'
                }
            },
            { $unwind: '$participant' },
            { $unwind: '$reponses' },
            {
                $project: {
                    participantNom: '$participant.nom',
                    participantPrenom: '$participant.prenom',
                    questionId: '$reponses.questionId',
                    valeurEchelle: '$reponses.valeurEchelle',
                    commentaire: '$reponses.commentaire',
                    dateReponse: 1,
                    sousReponses: '$reponses.sousReponses'
                }
            }
        ];

        const donnees = await ReponseEvaluation.aggregate(pipeline);

        // Formatage selon le type demandé
        let exportData;
        let contentType;
        let filename;

        switch (format) {
            case 'csv':
                exportData = formatToCSV(donnees, evaluation, lang);
                contentType = 'text/csv';
                filename = `evaluation_${evaluationId}_${new Date().toISOString().split('T')[0]}.csv`;
                break;
            case 'excel':
                exportData = await formatToExcel(donnees, evaluation, lang);
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                filename = `evaluation_${evaluationId}_${new Date().toISOString().split('T')[0]}.xlsx`;
                break;
            default:
                exportData = JSON.stringify({
                    evaluation: {
                        titre: lang === 'fr' ? evaluation.titreFr : evaluation.titreEn,
                        theme: evaluation.theme
                    },
                    donnees
                }, null, 2);
                contentType = 'application/json';
                filename = `evaluation_${evaluationId}_${new Date().toISOString().split('T')[0]}.json`;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        return res.send(exportData);

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// 7. Tableau de bord global des évaluations
export const getDashboardEvaluations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { periode = 3, themeId } = req.query; // période en mois
    
    try {
        const dateDebut = new Date();
        dateDebut.setMonth(dateDebut.getMonth() - parseInt(periode));

        let matchCondition = { createdAt: { $gte: dateDebut } };
        if (themeId) {
            matchCondition.theme = new mongoose.Types.ObjectId(themeId);
        }

        // Statistiques globales
        const statsGlobales = await EvaluationAChaud.aggregate([
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
                $project: {
                    titre: lang === 'fr' ? '$titreFr' : '$titreEn',
                    theme: 1,
                    totalReponses: { $size: '$reponses' },
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
            {
                $group: {
                    _id: null,
                    totalEvaluations: { $sum: 1 },
                    totalReponses: { $sum: '$totalReponses' },
                    moyenneGlobale: { $avg: '$moyenneEvaluation' },
                    evaluations: { $push: '$$ROOT' }
                }
            }
        ]);

        // Top 5 des meilleures évaluations
        const topEvaluations = await getTopEvaluations(matchCondition, lang, 5);

        // Évolution mensuelle
        const evolutionMensuelle = await getEvolutionMensuelle(matchCondition);

        return res.status(200).json({
            success: true,
            data: {
                periode: `${periode} mois`,
                statistiques: statsGlobales[0] || {
                    totalEvaluations: 0,
                    totalReponses: 0,
                    moyenneGlobale: 0
                },
                topEvaluations,
                evolutionMensuelle
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};











