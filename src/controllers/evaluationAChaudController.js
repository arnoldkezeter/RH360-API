// controllers/evaluationAChaudController.js
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import { LieuFormation } from '../models/LieuFormation.js';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import Utilisateur from '../models/Utilisateur.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import {
    buildRubriques,
    getAdvancedEvaluationStats,
    findQuestionInEvaluation,
    getQuestionStats,
    getStatsGroupedByField,
    getTopEvaluations,
    getEvolutionMensuelle,
    getBasePipelineForStats,
    getSousQuestionsPipeline,
    buildGoogleFormDefinition,
    formatToCSV,
} from '../services/evaluationAChaudService.js';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import EchelleReponse from '../models/EchelleDeReponse.js';
import { Objectif } from '../models/Objectif.js';
import QRCode from 'qrcode';
import { getLogoBase64 } from '../utils/logoBase64.js';
import TemplateConfig from '../models/TemplateConfig.js';
import { getRubriquesStatiquesCompletes } from '../services/rubriqueStatiqueService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS_DIR = path.join(__dirname, '..', 'views');

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD ÉVALUATION
// ═══════════════════════════════════════════════════════════════════════════════

export const createEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: t('champs_obligatoires', lang), errors: errors.array().map(e => e.msg) });
    }

    const { titreFr, titreEn, theme, descriptionFr, descriptionEn,
            dateFormation, objectifsVersionnes = [], rubriquesPersonnalisees = [], actif } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({ 
                success: false, 
                message: t('identifiant_invalide', lang) 
            });
        }

        const themeExists = await ThemeFormation.findById(theme);
        if (!themeExists) {
            return res.status(404).json({ 
                success: false,
                message: t('theme_non_trouve', lang) 
            });
        }

        const existsFr = await EvaluationAChaud.findOne({ titreFr });
        if (existsFr) {
            return res.status(409).json({ 
                success: false, 
                message: t('evaluation_existe_fr', lang) 
            });
        }

        // Création temporaire pour avoir un ID
        const evaluation = new EvaluationAChaud({
            titreFr, titreEn, theme, descriptionFr, descriptionEn,
            dateFormation, 
            objectifsVersionnes,
            actif: actif !== undefined ? actif : true,
            creePar: req.user._id,
        });

        // Sauvegarde pour obtenir l'ID
        await evaluation.save();

        // Construction des rubriques avec l'ID
        evaluation.rubriques = await buildRubriques(evaluation._id, rubriquesPersonnalisees);
        await evaluation.save();
        const populatedEvaluation = await EvaluationAChaud.findById(evaluation._id)
            .populate('theme', 'titreFr titreEn')
            .lean();

        return res.status(201).json({ 
            success: true, 
            message: t('ajouter_succes', lang), 
            data: populatedEvaluation 
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const updateEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const { titreFr, titreEn, theme, descriptionFr, descriptionEn,
            dateFormation, objectifsVersionnes, rubriquesPersonnalisees, actif } = req.body;

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: t('champs_obligatoires', lang), errors: errors.array().map(e => e.msg) });
        }

        if (theme && !mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        if (theme) {
            const themeExists = await ThemeFormation.findById(theme);
            if (!themeExists) {
                return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
            }
        }

        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        if (titreFr && titreFr !== evaluation.titreFr) {
            const existsFr = await EvaluationAChaud.findOne({ titreFr, _id: { $ne: id } });
            if (existsFr) {
                return res.status(409).json({ success: false, message: t('evaluation_existe_fr', lang) });
            }
        }

        // Mise à jour des champs simples
        if (titreFr !== undefined) evaluation.titreFr = titreFr;
        if (titreEn !== undefined) evaluation.titreEn = titreEn;
        if (theme !== undefined) evaluation.theme = theme;
        if (descriptionFr !== undefined) evaluation.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) evaluation.descriptionEn = descriptionEn;
        if (dateFormation !== undefined) evaluation.dateFormation = dateFormation;
        if (actif !== undefined) evaluation.actif = actif;
        if (objectifsVersionnes !== undefined) evaluation.objectifsVersionnes = objectifsVersionnes;
        // Incrémenter la version
        evaluation.version = (evaluation.version || 1) + 1;

        // Reconstruction des rubriques
        const nouvellesPerso = rubriquesPersonnalisees || [];
        evaluation.rubriques = await buildRubriques(evaluation._id, nouvellesPerso);

        await evaluation.save();
        const populatedEvaluation = await EvaluationAChaud.findById(evaluation._id)
            .populate('theme', 'titreFr titreEn')
            .lean();

        return res.status(200).json({ success: true, message: t('modifier_succes', lang), data: populatedEvaluation });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const deleteEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // 1. Supprimer l'évaluation
        const evaluation = await EvaluationAChaud.findByIdAndDelete(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        // 2. Supprimer le TemplateConfig associé s'il existe
        await TemplateConfig.findOneAndDelete({ evaluationId: id });

        return res.status(200).json({ 
            success: true, 
            message: t('supprimer_succes', lang) 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LECTURE
// ═══════════════════════════════════════════════════════════════════════════════

export const getFilteredEvaluation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();

    try {
        const filter = {};
        if (search) {
            filter.$or = [
                { titreFr: { $regex: search, $options: 'i' } },
                { titreEn: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await EvaluationAChaud.countDocuments(filter);
        const evaluations = await EvaluationAChaud.find(filter)
            .populate('theme', 'titreFr titreEn')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        console.log(evaluations)

        return res.status(200).json({
            success: true,
            data: { evaluationChauds: evaluations, totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit), pageSize: limit },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getEvaluationAChaudById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const evaluation = await EvaluationAChaud.findById(id)
            .populate('theme', 'nomFr nomEn')
            .populate('rubriques.questions.typeEchelle', 'nomFr nomEn')
            .lean();

        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        return res.status(200).json({ success: true, data: evaluation });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getEvaluationForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
        const evaluations = await EvaluationAChaud
            .find({ theme: themeId, actif: true })
            .select('titreFr titreEn')
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: { evaluationChauds: evaluations, totalItems: evaluations.length, currentPage: 1, totalPages: 1, pageSize: evaluations.length },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getEvaluationsChaudByUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { utilisateurId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();

    try {
        const cohortesIds = await CohorteUtilisateur
            .find({ utilisateur: utilisateurId }).distinct('cohorte');

        const themeIds = await LieuFormation
            .find({ cohortes: { $in: cohortesIds } }).distinct('theme');

        const filter = {
            theme: { $in: themeIds },
            actif: true,
            ...(search && {
                $or: [
                    { titreFr: { $regex: search, $options: 'i' } },
                    { titreEn: { $regex: search, $options: 'i' } },
                ],
            }),
        };

        const [total, evaluations] = await Promise.all([
            EvaluationAChaud.countDocuments(filter),
            EvaluationAChaud.find(filter)
                .populate('theme', 'nomFr nomEn')
                .populate('rubriques.questions.typeEchelle', 'nomFr nomEn')
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);

        const evaluationIds = evaluations.map(e => e._id);
        const reponses = await EvaluationAChaudReponse.find({
            utilisateur: utilisateurId,
            modele: { $in: evaluationIds },
        }).lean();

        const reponsesByModele = new Map(reponses.map(r => [r.modele.toString(), r]));

        const enrichies = evaluations.map(ev => {
            const reponse = reponsesByModele.get(ev._id.toString());

            let totalQ = 0, reponduQ = 0;
            for (const rub of ev.rubriques || []) {
                for (const q of rub.questions || []) {
                    totalQ += q.sousQuestions?.length || 1;
                }
            }
            if (reponse?.rubriques) {
                for (const rubRep of reponse.rubriques) {
                    for (const qRep of rubRep.questions) {
                        if (qRep.sousQuestions?.length > 0) reponduQ += qRep.sousQuestions.filter(sq => sq.reponseEchelleId).length;
                        else if (qRep.reponseEchelleId) reponduQ += 1;
                        else if (qRep.commentaireGlobal) reponduQ += 1;
                    }
                }
            }

            return {
                ...ev,
                reponse: reponse || null,
                statut: reponse?.statut || 'non_commence',
                progression: totalQ > 0 ? Math.round((reponduQ / totalQ) * 100) : 0,
            };
        });

        return res.status(200).json({
            success: true,
            data: { evaluationChauds: enrichies, totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit), pageSize: limit },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════════

export const getEvaluationStats = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const { participantsAttendus } = req.query;

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId)
            .populate('theme', 'nomFr nomEn');
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const stats = await getAdvancedEvaluationStats(evaluationId);
        const totalParticipants = stats.statistiquesDescriptives.nombreParticipants;
        const participantsAttendusParsed = parseInt(participantsAttendus) || totalParticipants;
        const tauxReponse = participantsAttendusParsed > 0
            ? parseFloat(((totalParticipants / participantsAttendusParsed) * 100).toFixed(1)) : 100;

        return res.status(200).json({
            success: true,
            data: {
                evaluation: {
                    id: evaluation._id,
                    titre: lang === 'fr' ? evaluation.titreFr : evaluation.titreEn,
                    description: lang === 'fr' ? evaluation.descriptionFr : evaluation.descriptionEn,
                    theme: lang === 'fr' ? evaluation.theme?.nomFr : evaluation.theme?.nomEn,
                },
                statistiques: { ...stats.statistiquesDescriptives, tauxReponse },
                distribution: stats.distribution,
                performanceRubriques: stats.performanceRubriques,
                statsParQuestion: stats.statsParQuestion,
                reponsesManquantes: stats.reponsesManquantes,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getResultatsByRubrique = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId).lean();
        
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const [statsRubriquesQuestions, sousQuestionsStats] = await Promise.all([
            EvaluationAChaudReponse.aggregate([
                ...getBasePipelineForStats(evaluationId),
                { $group: { _id: '$questionId', rubriqueId: { $first: '$rubriqueId' }, moyenne: { $avg: '$valeurNumerique' }, ordres: { $push: '$ordresNumeriques' } } },
                { $group: { _id: '$rubriqueId', moyenne: { $avg: '$moyenne' }, questions: { $push: { id: '$_id', moyenne: '$moyenne', ordres: '$ordres' } } } },
                { $sort: { _id: 1 } },
            ]),
            EvaluationAChaudReponse.aggregate(getSousQuestionsPipeline(evaluationId)),
        ]);

        const couleurs = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

        const rubriquesFinales = evaluation.rubriques.map(rubrique => {
            const statsRubrique = statsRubriquesQuestions.find(s => s._id.toString() === rubrique._id.toString());

            const questionsFinales = rubrique.questions.map(question => {
                const statsQuestion = statsRubrique?.questions.find(q => q.id.toString() === question._id.toString());
                const ordresAplatit = statsQuestion ? statsQuestion.ordres.flat() : [];
                const repartitionMap = ordresAplatit.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});

                const echelles = [...(question.echelles || [])].sort((a, b) => a.ordre - b.ordre);

                const repartitionFormatee = echelles.map((echelle, index) => ({
                    echelle: lang === 'fr' ? echelle.nomFr : echelle.nomEn,
                    valeur: repartitionMap[echelle.ordre] || 0,
                    couleur: couleurs[index] || '#6b7280',
                }));

                const sousQuestionsFinales = question.sousQuestions.map(sousQ => {
                    const statsSousQ = sousQuestionsStats.find(s => s._id.sousQuestionId?.toString() === sousQ._id.toString());
                    const sousQRep = statsSousQ?.ordres.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {}) || {};

                    return {
                        id: sousQ._id,
                        libelle: lang === 'fr' ? sousQ.libelleFr : sousQ.libelleEn,
                        moyenne: statsSousQ ? parseFloat(statsSousQ.moyenne.toFixed(2)) : 0,
                        min: statsSousQ?.min || 0,
                        max: statsSousQ?.max || 0,
                        count: statsSousQ?.count || 0,
                        repartition: echelles.map((echelle, index) => ({
                            echelle: lang === 'fr' ? echelle.nomFr : echelle.nomEn,
                            valeur: sousQRep[echelle.ordre] || 0,
                            couleur: couleurs[index] || '#6b7280',
                        })),
                    };
                });

                return {
                    id: question._id,
                    libelleFr: question.libelleFr,
                    libelleEn: question.libelleEn,
                    moyenne: statsQuestion ? parseFloat(statsQuestion.moyenne.toFixed(2)) : 0,
                    repartition: repartitionFormatee,
                    sousQuestions: sousQuestionsFinales,
                };
            }).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

            return {
                id: rubrique._id,
                titreFr: rubrique.titreFr,
                titreEn: rubrique.titreEn,
                moyenne: statsRubrique ? parseFloat(statsRubrique.moyenne.toFixed(2)) : 0,
                questions: questionsFinales,
            };
        }).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        return res.status(200).json({ success: true, data: rubriquesFinales });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getQuestionDetails = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId, questionId } = req.params;

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const question = findQuestionInEvaluation(evaluation, questionId);
        if (!question) {
            return res.status(404).json({ success: false, message: t('question_non_trouvee', lang) });
        }

        const questionStats = await getQuestionStats(evaluationId, questionId, lang);
        return res.status(200).json({ success: true, data: questionStats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getCommentairesByEvaluation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;

    try {
        const pipeline = [
            { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
            { $unwind: '$rubriques' },
            { $unwind: '$rubriques.questions' },
            {
                $project: {
                    _id: 0,
                    tousLesCommentaires: {
                        $concatArrays: [
                            { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$rubriques.questions.commentaireGlobal', ''] } }, 0] }, ['$rubriques.questions.commentaireGlobal'], []] },
                            { $cond: [{ $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] }, '$rubriques.questions.sousQuestions.commentaire', []] },
                        ],
                    },
                },
            },
            { $unwind: '$tousLesCommentaires' },
            { $match: { tousLesCommentaires: { $nin: ['', null] } } },
        ];

        if (limit && limit > 0) pipeline.push({ $limit: limit });

        pipeline.push({ $group: { _id: null, commentaires: { $addToSet: '$tousLesCommentaires' } } });
        pipeline.push({ $project: { _id: 0, commentaires: 1 } });

        const result = await EvaluationAChaudReponse.aggregate(pipeline);
        return res.status(200).json({ success: true, data: result[0]?.commentaires || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

export const getStatsByField = async (req, res) => {
    const { evaluationId } = req.params;
    const { field } = req.query;

    const result = await getStatsGroupedByField(evaluationId, field);
    return res.status(result.success ? 200 : 500).json(result);
};

export const getDashboardEvaluations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { periode = 3, themeId } = req.query;

    try {
        const dateDebut = new Date();
        dateDebut.setMonth(dateDebut.getMonth() - parseInt(periode));

        const matchCondition = { createdAt: { $gte: dateDebut }, actif: true };
        if (themeId && mongoose.Types.ObjectId.isValid(themeId)) {
            matchCondition.theme = new mongoose.Types.ObjectId(themeId);
        }

        const [topEvaluations, evolution, totalEvaluations, totalReponses] = await Promise.all([
            getTopEvaluations(matchCondition, lang, 5),
            getEvolutionMensuelle(parseInt(periode), themeId),
            EvaluationAChaud.countDocuments(matchCondition),
            EvaluationAChaudReponse.countDocuments({ statut: 'soumis', createdAt: { $gte: dateDebut } }),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                periode: `${periode} mois`,
                statistiques: { totalEvaluations, totalReponses },
                topEvaluations,
                evolutionMensuelle: evolution,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ============================================================================
// CONFIGURATION ET PERSONNALISATION
// ============================================================================

/**
 * Récupère la configuration complète d'une évaluation
 * GET /api/evaluations-chaud/:id/config
 */
export const getEvaluationConfig = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Récupérer l'évaluation
        const evaluation = await EvaluationAChaud.findById(id)
            .populate('theme', 'nomFr nomEn')
            .lean();

        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        // Récupérer la configuration personnalisée
        const config = await TemplateConfig.findOne({ evaluationId: id }).lean();

        // Récupérer les rubriques statiques pour référence
        const rubriquesStatiques = await getRubriquesStatiquesCompletes();

        // Récupérer les objectifs de base du thème
        const objectifsBase = await Objectif.find({ theme: evaluation.theme })
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                evaluation: {
                    id: evaluation._id,
                    titreFr: evaluation.titreFr,
                    titreEn: evaluation.titreEn,
                    theme: evaluation.theme,
                },
                rubriquesStatiques,
                objectifsBase,
                config: config || {
                    rubriquesConfig: [],
                    objectifsConfig: {
                        estActive: true,
                        personnalisationAutorisee: true,
                        objectifsPersonnalises: [],
                        objectifsSupprimes: [],
                        objectifsPersonnalisesSupprimes: []
                    }
                }
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/**
 * Met à jour la configuration d'une évaluation
 * PUT /api/evaluations-chaud/:id/config
 */
export const updateEvaluationConfig = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { rubriquesConfig, objectifsConfig } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que l'évaluation existe
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }


        // Trouver ou créer la configuration
        let config = await TemplateConfig.findOne({ evaluationId: id });
        if (!config) {
            config = new TemplateConfig({ evaluationId: id });
        }

        // Mettre à jour les champs
        if (rubriquesConfig !== undefined) {
            config.rubriquesConfig = rubriquesConfig;
        }
        if (objectifsConfig !== undefined) {
            config.objectifsConfig = objectifsConfig;
        }

        await config.save();

        // Incrémenter la version de l'évaluation
        evaluation.version = (evaluation.version || 1) + 1;
        await evaluation.save();

        return res.status(200).json({
            success: true,
            message: t('config_mise_a_jour', lang),
            data: config
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/**
 * Régénère les rubriques d'une évaluation à partir de sa configuration
 * POST /api/evaluations-chaud/:id/regenerate
 */
export const regenerateRubriques = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que l'évaluation existe
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        // Régénérer les rubriques
        const rubriques = await buildRubriques(evaluation._id, []);

        // Mettre à jour l'évaluation
        evaluation.rubriques = rubriques;
        evaluation.version = (evaluation.version || 1) + 1;
        await evaluation.save();

        return res.status(200).json({
            success: true,
            message: t('rubriques_regenerées', lang),
            data: { rubriques, version: evaluation.version }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/**
 * Ajoute un objectif personnalisé à une évaluation
 * POST /api/evaluations-chaud/:id/objectifs
 */
export const addObjectifPersonnalise = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { libelleFr, libelleEn, ordre } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    if (!libelleFr || libelleFr.trim() === '') {
        return res.status(400).json({ success: false, message: t('libelle_requis', lang) });
    }

    try {
        // Vérifier que l'évaluation existe
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

       
        // Trouver ou créer la configuration
        let config = await TemplateConfig.findOne({ evaluationId: id });
        if (!config) {
            config = new TemplateConfig({ evaluationId: id });
        }

        // Créer le nouvel objectif
        const nouvelObjectif = {
            id: new mongoose.Types.ObjectId().toString(),
            libelleFr: libelleFr.trim(),
            libelleEn: libelleEn || '',
            ordre: ordre !== undefined ? ordre : (config.objectifsConfig?.objectifsPersonnalises?.length || 0)
        };

        // Initialiser objectifsConfig si nécessaire
        if (!config.objectifsConfig) {
            config.objectifsConfig = {
                estActive: true,
                personnalisationAutorisee: true,
                objectifsPersonnalises: [],
                objectifsSupprimes: [],
                objectifsPersonnalisesSupprimes: []
            };
        }

        // Ajouter l'objectif
        config.objectifsConfig.objectifsPersonnalises.push(nouvelObjectif);
        await config.save();

        // Régénérer les rubriques pour prendre en compte le nouvel objectif
        const rubriques = await buildRubriques(evaluation._id, []);
        evaluation.rubriques = rubriques;
        evaluation.version = (evaluation.version || 1) + 1;
        await evaluation.save();

        return res.status(201).json({
            success: true,
            message: t('objectif_ajoute', lang),
            data: nouvelObjectif
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/**
 * Supprime un objectif personnalisé d'une évaluation
 * DELETE /api/evaluations-chaud/:id/objectifs/:objectifId
 */
export const removeObjectifPersonnalise = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id, objectifId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Vérifier que l'évaluation existe
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        // Trouver la configuration
        const config = await TemplateConfig.findOne({ evaluationId: id });
        if (!config || !config.objectifsConfig) {
            return res.status(404).json({ success: false, message: t('config_non_trouvee', lang) });
        }

        // Vérifier si l'objectif existe
        const objectifExiste = config.objectifsConfig.objectifsPersonnalises.find(
            obj => obj.id === objectifId
        );

        if (!objectifExiste) {
            return res.status(404).json({ success: false, message: t('objectif_non_trouve', lang) });
        }

        // Ajouter l'ID à la liste des supprimés (soft delete)
        if (!config.objectifsConfig.objectifsPersonnalisesSupprimes) {
            config.objectifsConfig.objectifsPersonnalisesSupprimes = [];
        }
        config.objectifsConfig.objectifsPersonnalisesSupprimes.push(objectifId);

        // Supprimer de la liste active (optionnel, on peut juste marquer comme supprimé)
        config.objectifsConfig.objectifsPersonnalises = config.objectifsConfig.objectifsPersonnalises.filter(
            obj => obj.id !== objectifId
        );

        await config.save();

        // Régénérer les rubriques pour prendre en compte la suppression
        const rubriques = await buildRubriques(evaluation._id, []);
        evaluation.rubriques = rubriques;
        evaluation.version = (evaluation.version || 1) + 1;
        await evaluation.save();

        return res.status(200).json({
            success: true,
            message: t('objectif_supprime', lang)
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (PDF, Google Forms)
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Génère un QR code pour la vérification
 */
async function generateQRCode(evaluationId, reponseId = null) {
    try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        let urlVerification;
        
        if (reponseId) {
            urlVerification = `${baseUrl}/api/evaluations-chaud/verifier/${evaluationId}/${reponseId}`;
        } else {
            urlVerification = `${baseUrl}/api/evaluations-chaud/verifier/${evaluationId}`;
        }
        
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 80,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        return { qrCodeDataUrl, urlVerification };
    } catch (error) {
        console.warn('Erreur génération QR code:', error.message);
        return { qrCodeDataUrl: null, urlVerification: null };
    }
}

/**
 * Génère le PDF de la fiche d'évaluation
 */
export const exportFichePDF = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const { reponseId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // 1. Récupérer l'évaluation — les echelles sont déjà snapshotées dans chaque question
        const evaluation = await EvaluationAChaud.findById(evaluationId)
            .populate('theme', 'nomFr nomEn')
            .populate('creePar', 'nom prenom')
            .lean();

        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        // 2. Récupérer la réponse et l'utilisateur si demandé
        let reponse     = null;
        let utilisateur = null;

        if (reponseId && mongoose.Types.ObjectId.isValid(reponseId)) {
            reponse = await EvaluationAChaudReponse.findById(reponseId)
                .populate('utilisateur', 'nom prenom matricule email structure service posteDeTravail')
                .lean();
            if (reponse?.utilisateur) utilisateur = reponse.utilisateur;
        }

        // 3. Construire la map des réponses  rubriqueId -> questionId -> réponse
        const reponseMap = {};
        for (const rr of reponse?.rubriques || []) {
            const rid = rr.rubriqueId?.toString();
            if (!rid) continue;
            reponseMap[rid] = {};
            for (const qr of rr.questions || []) {
                const qid = qr.questionId?.toString();
                if (!qid) continue;
                reponseMap[rid][qid] = qr;
            }
        }

        // 4. QR code + logo
        const { qrCodeDataUrl } = await generateQRCode(evaluationId, reponseId);
        const logoUrl = getLogoBase64(__dirname);
        const createur = `${evaluation.creePar.nom} ${evaluation.creePar.prenom || ''}`.trim();

        // 5. Données du template — evaluation.rubriques[].questions[].echelles est déjà peuplé
        const templateData = {
            lang,
            evaluation,   // ✅ plus besoin d'evaluationEnrichie
            description:  lang === 'fr' ? evaluation.descriptionFr : (evaluation.descriptionEn || evaluation.descriptionFr),
            reponse,
            utilisateur,
            reponseMap,
            estVierge:    !reponse,
            logoUrl,
            qrCodeUrl:    qrCodeDataUrl,
            referenceSysteme: evaluation.reference || `EVAL-${evaluation._id.toString().slice(-8).toUpperCase()}`,
            dateGeneration:   new Date().toLocaleDateString('fr-FR'),
            createur:      evaluation.creePar?`${evaluation.creePar.nom} ${evaluation.creePar.prenom || ''}`.trim():""
        };

        // 6. Générer et envoyer le PDF
        const pdfBuffer = await renderPDF('fiche-evaluation', templateData);

        const nomFichier = reponse
            ? `evaluation_${evaluationId}_reponse_${reponseId}.pdf`
            : `evaluation_${evaluationId}_vierge.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);

    } catch (err) {
        console.error('Erreur exportFichePDF:', err);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
        }
    }
};

/**
 * Met à jour la fonction renderPDF avec pagination et footer
 */
export async function renderPDF(templateName, data, pdfOptions = {}) {
    const templatePath = path.join(VIEWS_DIR, `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, data, { async: true });

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '25px',
                right: '15px',
                bottom: '40px',
                left: '15px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${data.createur}
                    </div>
                    <div style="text-align: center; flex: 1;">
                        Le ${data.dateGeneration}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `,
            ...pdfOptions
        });

        return pdfBuffer;
    } finally {
        await browser.close();
    }
}

export const exportGoogleForms = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;

    try {
        const evaluation = await EvaluationAChaud.findById(evaluationId)
            .populate('rubriques.questions.typeEchelle', 'nomFr nomEn')
            .lean();

        if (!evaluation) {
            return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });
        }

        const formDefinition = buildGoogleFormDefinition(evaluation, lang);

        return res.status(200).json({
            success: true,
            instructions: [
                "1. Activez l'API Google Forms dans votre projet GCP",
                "2. POST https://forms.googleapis.com/v1/forms avec le champ 'form' ci-dessous",
                "3. Récupérez le formId dans la réponse",
                "4. PATCH https://forms.googleapis.com/v1/forms/{formId}:batchUpdate avec le champ 'requests' ci-dessous",
            ],
            data: formDefinition,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};