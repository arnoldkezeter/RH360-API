import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Formation from '../models/Formation.js';
import { getEvolutionStats,getSousQuestionsStats, getQuestionStats, getStatsGroupedByField, findQuestionInEvaluation, formatToCSV, getTopEvaluations, getEvolutionMensuelle } from '../services/evaluationAChaudService.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import Utilisateur from '../models/Utilisateur.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import { LieuFormation } from '../models/LieuFormation.js';

export const saveDraftEvaluationAChaudReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const { utilisateur, modele, rubriques, commentaireGeneral } = req.body;

        // Vérifier que l'utilisateur et le modèle existent
        const [userExists, evaluationModel] = await Promise.all([
            Utilisateur.findById(utilisateur),
            EvaluationAChaud.findById(modele)
        ]);

        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang)
            });
        }

        if (!evaluationModel) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        // Calculer la progression
        const progression = calculateProgression(rubriques, evaluationModel);

        // Chercher un brouillon existant
        let reponseExistante = await EvaluationAChaudReponse.findOne({
            utilisateur: new mongoose.Types.ObjectId(utilisateur),
            modele: new mongoose.Types.ObjectId(modele),
            statut: 'brouillon'
        });

        const reponseData = {
            utilisateur: new mongoose.Types.ObjectId(utilisateur),
            modele: new mongoose.Types.ObjectId(modele),
            rubriques: formatRubriques(rubriques),
            commentaireGeneral: commentaireGeneral || undefined,
            statut: 'brouillon',
            progression,
            dateSoumission: new Date()
        };

        if (reponseExistante) {
            // Mettre à jour le brouillon existant
            Object.assign(reponseExistante, reponseData);
            await reponseExistante.save();
            reponse = reponseExistante;
        } else {
            // Créer un nouveau brouillon
            reponse = new EvaluationAChaudReponse(reponseData);
            await reponse.save();
        }

        return res.status(200).json({
            success: true,
            message: t('brouillon_sauvegarde', lang),
            data: {
                id: reponse._id,
                statut: reponse.statut,
                progression: reponse.progression,
                dateSauvegarde: reponse.dateSoumission
            }
        });

    } catch (err) {
        console.error('Erreur lors de la sauvegarde du brouillon:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur interne'
        });
    }
};


export const submitEvaluationAChaudReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    // ✅ Validation rapide des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { utilisateur, modele, rubriques, commentaireGeneral } = req.body;

        // ✅ Optimisation: Validation de structure avant requêtes DB
        if (!rubriques || !Array.isArray(rubriques) || rubriques.length === 0) {
            return res.status(400).json({
                success: false,
                message: t('rubriques_obligatoires', lang)
            });
        }

        // ✅ Validation détaillée optimisée en une seule passe
        const validationErrors = [];
        let totalQuestions = 0;
        
        // Pré-validation de la structure pour éviter les requêtes DB inutiles
        for (const rubrique of rubriques) {
            if (!rubrique.rubriqueId || !rubrique.questions || !Array.isArray(rubrique.questions)) {
                validationErrors.push(`Rubrique ${rubrique.rubriqueId || 'inconnue'}: structure invalide`);
                continue;
            }

            for (const question of rubrique.questions) {
                if (!question.questionId) {
                    validationErrors.push(`Question manquante dans rubrique ${rubrique.rubriqueId}`);
                    continue;
                }

                // Vérifier qu'une question a soit reponseEchelleId soit sousQuestions
                const hasDirectResponse = question.reponseEchelleId;
                const hasSousQuestions = question.sousQuestions && question.sousQuestions.length > 0;

                if (!hasDirectResponse && !hasSousQuestions) {
                    validationErrors.push(`Question ${question.questionId}: aucune réponse fournie`);
                } else if (hasDirectResponse && hasSousQuestions) {
                    validationErrors.push(`Question ${question.questionId}: réponse directe ET sous-réponses fournies (conflit)`);
                }

                // Validation des sous-réponses si présentes
                if (hasSousQuestions) {
                    for (const sousQuestion of question.sousQuestions) {
                        if (!sousQuestion.sousQuestionId || !sousQuestion.reponseEchelleId) {
                            validationErrors.push(`Sous-question ${sousQuestion.sousQuestionId || 'inconnue'}: réponse incomplète`);
                        }
                    }
                    totalQuestions += question.sousQuestions.length;
                } else {
                    totalQuestions += 1;
                }
            }
        }

        // ✅ Retour rapide si erreurs de validation
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: t('donnees_invalides', lang),
                errors: validationErrors
            });
        }

        // ✅ Optimisation: Vérifications DB en parallèle
        const [userExists, evaluationModel] = await Promise.all([
            Utilisateur.findById(utilisateur).select('_id').lean(),
            EvaluationAChaud.findById(modele).select('_id titreFr titreEn').lean()
        ]);

        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang)
            });
        }

        if (!evaluationModel) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang)
            });
        }

        // ✅ Optimisation: Construction des ObjectIds en lot
        const utilisateurId = new mongoose.Types.ObjectId(utilisateur);
        const modeleId = new mongoose.Types.ObjectId(modele);

        // ✅ Optimisation: Pré-construction de la structure de données
        const reponseData = {
            utilisateur: utilisateurId,
            modele: modeleId,
            rubriques: rubriques.map(rubrique => ({
                rubriqueId: new mongoose.Types.ObjectId(rubrique.rubriqueId),
                questions: rubrique.questions.map(question => {
                    const questionData = {
                        questionId: new mongoose.Types.ObjectId(question.questionId),
                        commentaireGlobal: question.commentaireGlobal || undefined
                    };

                    if (question.sousQuestions?.length > 0) {
                        questionData.sousQuestions = question.sousQuestions.map(sr => ({
                            sousQuestionId: new mongoose.Types.ObjectId(sr.sousQuestionId),
                            reponseEchelleId: new mongoose.Types.ObjectId(sr.reponseEchelleId),
                            commentaire: sr.commentaire || undefined
                        }));
                        questionData.reponseEchelleId = undefined;
                    } else {
                        questionData.reponseEchelleId = question.reponseEchelleId ? 
                            new mongoose.Types.ObjectId(question.reponseEchelleId) : undefined;
                        questionData.sousQuestions = undefined;
                    }

                    return questionData;
                })
            })),
            commentaireGeneral: commentaireGeneral || undefined,
            dateSoumission: new Date()
        };

        // ✅ Optimisation: Upsert avec retour des données minimales
        const reponse = await EvaluationAChaudReponse.findOneAndUpdate(
            {
                utilisateur: utilisateurId,
                modele: modeleId
            },
            reponseData,
            { 
                new: true, 
                upsert: true, 
                setDefaultsOnInsert: true,
                lean: true // ✅ Performance: pas besoin d'instance Mongoose
            }
        );

        // ✅ Optimisation: Réponse avec données pré-calculées
        return res.status(201).json({ 
            success: true, 
            message: t('soumis_succes', lang), 
            data: {
                id: reponse._id,
                dateSoumission: reponse.dateSoumission,
                utilisateur: {
                    _id: userExists._id
                },
                evaluation: {
                    _id: evaluationModel._id,
                    titreFr: evaluationModel.titreFr,
                    titreEn: evaluationModel.titreEn
                },
                totalRubriques: reponse.rubriques.length,
                totalQuestions: totalQuestions
            }
        });

    } catch (err) {
        console.error('Erreur lors de la soumission de l\'évaluation:', err);
        
        // ✅ Gestion optimisée des erreurs avec switch
        switch (err.name) {
            case 'ValidationError':
                return res.status(400).json({
                    success: false,
                    message: t('donnees_invalides', lang),
                    errors: Object.values(err.errors).map(e => e.message)
                });
                
            case 'CastError':
                return res.status(400).json({
                    success: false,
                    message: t('id_invalide', lang),
                    error: 'Format d\'identifiant invalide'
                });
                
            case 'MongoServerError':
                if (err.code === 11000) { // Erreur de duplicata
                    return res.status(409).json({
                        success: false,
                        message: t('evaluation_deja_repondu', lang)
                    });
                }
                break;
        }

        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur interne'
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


export const getEvaluationsChaudByUtilisateurAvecEchelles = async (req, res) => {
  try {
    const utilisateurId = req.params.utilisateurId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();

    // ✅ Optimisation: Utilisation d'une seule requête avec pipeline d'agrégation
    const cohortesIds = await CohorteUtilisateur.find({ utilisateur: utilisateurId }).distinct('cohorte');
    const themeIds = await LieuFormation.find({ cohortes: { $in: cohortesIds } }).distinct('theme');

    const filter = {
      theme: { $in: themeIds },
      actif: true,
      ...(search && {
        $or: [
          { titreFr: { $regex: search, $options: 'i' } },
          { titreEn: { $regex: search, $options: 'i' } }
        ]
      })
    };

    // ✅ Optimisation: Requêtes parallèles avec Promise.all
    const [total, evaluations, reponses] = await Promise.all([
      EvaluationAChaud.countDocuments(filter),
      EvaluationAChaud.find(filter)
        .populate('theme', 'titreFr titreEn')
        .populate({
          path: 'rubriques.questions.echelles',
          options: { strictPopulate: false }
        })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      // ✅ Pré-charger toutes les réponses en une seule requête
      EvaluationAChaud.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .then(evals => {
          const evaluationIds = evals.map(e => e._id);
          return EvaluationAChaudReponse.find({
            utilisateur: utilisateurId,
            modele: { $in: evaluationIds }
          }).lean();
        })
    ]);

    // ✅ Optimisation: Map unique pour les réponses
    const reponsesByModele = new Map(
      reponses.map(rep => [rep.modele.toString(), rep])
    );

    // ✅ Optimisation: Traitement en lot avec une seule boucle
    const evaluationsEnrichies = evaluations.map(evaluation => {
      const reponse = reponsesByModele.get(evaluation._id.toString());

      // ✅ Calcul optimisé de la progression
      let totalQuestions = 0;
      let totalRepondu = 0;

      // Pré-calcul des totaux
      for (const rubrique of evaluation.rubriques || []) {
        for (const question of rubrique.questions || []) {
          totalQuestions += question.sousQuestions?.length || 1;
        }
      }

      if (reponse?.rubriques) {
        for (const rubriqueRep of reponse.rubriques) {
          for (const questionRep of rubriqueRep.questions) {
            if (questionRep.sousQuestions?.length > 0) {
              totalRepondu += questionRep.sousQuestions.length;
            } else if (questionRep.reponseEchelleId) {
              totalRepondu += 1;
            }
          }
        }
      }

      evaluation.progression = totalQuestions > 0
        ? Math.round((totalRepondu / totalQuestions) * 100)
        : 0;

      // ✅ Enrichissement optimisé des rubriques
      if (reponse?.rubriques) {
        // Création de maps pour accès O(1) au lieu de find() O(n)
        const rubriqueReponseMap = new Map(
          reponse.rubriques.map(rr => [rr.rubriqueId.toString(), rr])
        );

        evaluation.rubriques = evaluation.rubriques.map(rubriqueEval => {
          const rubriqueReponse = rubriqueReponseMap.get(rubriqueEval._id.toString());
          
          if (!rubriqueReponse) return rubriqueEval;

          // Map des questions pour accès O(1)
          const questionReponseMap = new Map(
            rubriqueReponse.questions.map(qr => [qr.questionId.toString(), qr])
          );

          const questionsEnrichies = rubriqueEval.questions.map(questionEval => {
            const questionReponse = questionReponseMap.get(questionEval._id.toString());

            let questionEnrichie = {
              ...questionEval,
              questionId: questionEval._id
            };

            if (!questionReponse) return questionEnrichie;

            // ✅ Traitement optimisé des réponses
            if (questionReponse.reponseEchelleId && (!questionEval.sousQuestions || questionEval.sousQuestions.length === 0)) {
              questionEnrichie.reponseEchelleId = questionReponse.reponseEchelleId;
            }

            if (questionReponse.commentaireGlobal) {
              questionEnrichie.commentaireGlobal = questionReponse.commentaireGlobal;
            }

            // ✅ Traitement optimisé des sous-questions
            if (questionEval.sousQuestions?.length > 0 && questionReponse.sousQuestions) {
              const sousReponseMap = new Map(
                questionReponse.sousQuestions.map(sr => [sr.sousQuestionId.toString(), sr])
              );

              questionEnrichie.sousQuestions = questionEval.sousQuestions.map(sousQuestion => {
                const sousReponse = sousReponseMap.get(sousQuestion._id.toString());

                const enrichedSousQuestion = {
                  ...sousQuestion,
                  sousQuestionId: sousQuestion._id
                };

                if (sousReponse) {
                  enrichedSousQuestion.reponseEchelleId = sousReponse.reponseEchelleId;
                  enrichedSousQuestion.commentaire = sousReponse.commentaire;
                }

                return enrichedSousQuestion;
              });
            }

            return questionEnrichie;
          });

          return {
            ...rubriqueEval,
            questions: questionsEnrichies
          };
        });
      }

      return evaluation;
    });

    return res.status(200).json({
      success: true,
      data: {
        evaluationChauds: evaluationsEnrichies,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit
      }
    });

  } catch (error) {
    console.error('Erreur getEvaluationsChaudByUtilisateurAvecEchelles:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};











