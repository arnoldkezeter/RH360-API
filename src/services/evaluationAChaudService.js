// services/evaluationAChaudService.js
import mongoose from 'mongoose';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import EchelleReponse from '../models/EchelleDeReponse.js';
import TemplateConfig from '../models/TemplateConfig.js';
import { getRubriquesStatiquesCompletes } from './rubriqueStatiqueService.js';
import { Objectif } from '../models/Objectif.js';
import TypeEchelleReponse from '../models/TypeEchelleDeReponse.js';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRE : extraire un ID string de façon sûre
// Gère les cas : ObjectId, objet populé { _id }, string, null/undefined
// ═══════════════════════════════════════════════════════════════════════════════

function extractId(val) {
    if (!val) return null;
    // Objet populé Mongoose : { _id: ObjectId, nomFr: '...', ... }
    if (typeof val === 'object' && val._id) return val._id.toString();
    // ObjectId Mongoose ou string
    return val.toString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTRUCTION DES RUBRIQUES
// ═══════════════════════════════════════════════════════════════════════════════

async function chargerEchellesParType() {
    const types    = await TypeEchelleReponse.find({}).lean();
    const echelles = await EchelleReponse.find({}).sort({ ordre: 1 }).lean();

    // typeId (string) -> [{_id, nomFr, nomEn, ordre}]
    const echellesByTypeId = {};
    for (const e of echelles) {
        const tid = e.typeEchelle.toString();
        if (!echellesByTypeId[tid]) echellesByTypeId[tid] = [];
        echellesByTypeId[tid].push({
            _id:   e._id,
            nomFr: e.nomFr,
            nomEn: e.nomEn || '',
            ordre: e.ordre,
        });
    }

    const result = new Map();
    for (const t of types) {
        const tid = t._id.toString();
        const echellesCompletes = echellesByTypeId[tid] || [];
        // Indexé par _id du type (string)
        result.set(tid, echellesCompletes);
        // Indexé par nomFr normalisé (pour fallback éventuel)
        result.set(t.nomFr.toLowerCase().trim(), echellesCompletes);
    }
    return result;
}

/**
 * Résout les échelles d'une question à partir de son typeEchelle.
 * Robuste : fonctionne que typeEchelle soit un ObjectId, un objet populé ou une string.
 */
function resolveEchelles(typeEchelle, echellesMap) {
    const id = extractId(typeEchelle);
    if (!id) return [];
    return echellesMap.get(id) || [];
}

async function getObjectifsActifs(themeId, config) {
    if (!themeId) return [];

    const objectifsBase = await Objectif.find({ theme: themeId })
        .sort({ createdAt: 1 })
        .lean();

    const objectifsBaseFormates = objectifsBase.map(obj => ({
        id: obj._id,
        libelleFr: obj.nomFr,
        libelleEn: obj.nomEn,
        estPersonnalise: false,
        ordre: obj.ordre || 0,
    }));

    const objectifsPersonnalises             = config?.objectifsConfig?.objectifsPersonnalises || [];
    const objectifsSupprimes                 = config?.objectifsConfig?.objectifsSupprimes?.map(id => id.toString()) || [];
    const objectifsPersonnalisesSupprimes    = config?.objectifsConfig?.objectifsPersonnalisesSupprimes || [];

    const objectifsBaseActifs         = objectifsBaseFormates.filter(obj => !objectifsSupprimes.includes(obj.id.toString()));
    const objectifsPersonnalisesActifs = objectifsPersonnalises.filter(obj => !objectifsPersonnalisesSupprimes.includes(obj.id));

    const tousObjectifs = [...objectifsBaseActifs, ...objectifsPersonnalisesActifs];
    tousObjectifs.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

    return tousObjectifs;
}

/**
 * Construit les questions d'une rubrique en tenant compte de la configuration.
 * Correction clé : utilise resolveEchelles() au lieu de echellesMap.get(q.typeEchelle.toString())
 */
async function buildRubriqueQuestions(rubriqueStatique, rubriqueConfig, echellesMap) {
    const questions = [];

    if (!rubriqueConfig) {
        // Pas de configuration : questions statiques telles quelles
        for (const q of rubriqueStatique.questions) {
            questions.push({
                _id:              new mongoose.Types.ObjectId(),
                code:             q.code,
                libelleFr:        q.libelleFr,
                libelleEn:        q.libelleEn || '',
                type:             q.type,
                commentaireGlobal: q.commentaireGlobal,
                ordre:            q.ordre,
                typeEchelle:      extractId(q.typeEchelle) ? new mongoose.Types.ObjectId(extractId(q.typeEchelle)) : null,
                echelles:         resolveEchelles(q.typeEchelle, echellesMap),  // ← correction
                echellesPersonnalisees: [],
                sousQuestions:    (q.sousQuestions || []).map(sq => ({
                    _id:                  new mongoose.Types.ObjectId(),
                    code:                 sq.id || sq.code,
                    libelleFr:            sq.libelleFr,
                    libelleEn:            sq.libelleEn || '',
                    ordre:                sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire || false,
                })),
            });
        }
        return questions;
    }

    const questionsSupprimees    = rubriqueConfig.questionsSupprimees    || [];
    const questionsPersonnalisees = rubriqueConfig.questionsPersonnalisees || [];

    // Map des versions personnalisées (clé = code question originale)
    const customQuestionsMap = new Map();
    for (const qp of questionsPersonnalisees) {
        if (qp.id && qp.id.startsWith('custom_')) {
            const parts = qp.id.replace('custom_', '').split('_');
            const originalId = parts[0] + '_' + parts[1];
            customQuestionsMap.set(originalId, qp);
        }
    }

    // Questions statiques (originales ou remplacées)
    for (const q of rubriqueStatique.questions) {
        const customVersion = customQuestionsMap.get(q.code);

        // Supprimée sans remplacement custom → skip
        if (questionsSupprimees.includes(q.code) && !customVersion) continue;

        if (customVersion) {
            questions.push({
                _id:              new mongoose.Types.ObjectId(),
                code:             customVersion.id,
                libelleFr:        customVersion.libelleFr,
                libelleEn:        customVersion.libelleEn || '',
                type:             customVersion.typeQuestion || 'simple',
                commentaireGlobal: customVersion.commentaireObligatoire || false,
                ordre:            customVersion.ordre || q.ordre,
                typeEchelle:      extractId(customVersion.typeEchelleId) ? new mongoose.Types.ObjectId(extractId(customVersion.typeEchelleId)) : null,
                echelles:         resolveEchelles(customVersion.typeEchelleId, echellesMap),  // ← correction
                echellesPersonnalisees: [],
                sousQuestions:    (customVersion.sousQuestions || []).map(sq => ({
                    _id:                  new mongoose.Types.ObjectId(),
                    code:                 sq.id || sq.code,
                    libelleFr:            sq.libelleFr,
                    libelleEn:            sq.libelleEn || '',
                    ordre:                sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire || false,
                })),
            });
        } else {
            questions.push({
                _id:              new mongoose.Types.ObjectId(),
                code:             q.code,
                libelleFr:        q.libelleFr,
                libelleEn:        q.libelleEn || '',
                type:             q.type,
                commentaireGlobal: q.commentaireGlobal,
                ordre:            q.ordre,
                typeEchelle:      extractId(q.typeEchelle) ? new mongoose.Types.ObjectId(extractId(q.typeEchelle)) : null,
                echelles:         resolveEchelles(q.typeEchelle, echellesMap),  // ← correction
                echellesPersonnalisees: [],
                sousQuestions:    (q.sousQuestions || []).map(sq => ({
                    _id:                  new mongoose.Types.ObjectId(),
                    code:                 sq.id || sq.code,
                    libelleFr:            sq.libelleFr,
                    libelleEn:            sq.libelleEn || '',
                    ordre:                sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire || false,
                })),
            });
        }
    }

    // Nouvelles questions personnalisées (pas de prefix custom_)
    for (const qp of questionsPersonnalisees) {
        if (qp.id && qp.id.startsWith('custom_')) continue;

        questions.push({
            _id:              new mongoose.Types.ObjectId(),
            code:             qp.id,
            libelleFr:        qp.libelleFr,
            libelleEn:        qp.libelleEn || '',
            type:             qp.typeQuestion || 'simple',
            commentaireGlobal: qp.commentaireObligatoire || false,
            ordre:            qp.ordre || 999,
            typeEchelle:      extractId(qp.typeEchelleId) ? new mongoose.Types.ObjectId(extractId(qp.typeEchelleId)) : null,
            echelles:         resolveEchelles(qp.typeEchelleId, echellesMap),  // ← correction
            echellesPersonnalisees: [],
            sousQuestions:    (qp.sousQuestions || []).map(sq => ({
                _id:                  new mongoose.Types.ObjectId(),
                code:                 sq.id || sq.code,
                libelleFr:            sq.libelleFr,
                libelleEn:            sq.libelleEn || '',
                ordre:                sq.ordre,
                commentaireObligatoire: sq.commentaireObligatoire || false,
            })),
        });
    }

    questions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    return questions;
}

/**
 * Construit le tableau complet rubriques[].
 */
export async function buildRubriques(evaluationId, rubriquesPersonnalisees = []) {
    const evaluation = await EvaluationAChaud.findById(evaluationId).populate('theme').lean();
    if (!evaluation) throw new Error('Évaluation non trouvée');
    const themeId = evaluation.theme?._id || evaluation.theme;

    const rubriquesStatiques = await getRubriquesStatiquesCompletes();
    const config             = await TemplateConfig.findOne({ evaluationId }).lean();
    const echellesMap        = await chargerEchellesParType();
    const objectifsActifs    = await getObjectifsActifs(themeId, config);

    // Debug : log pour vérifier que les échelles sont bien chargées
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[buildRubriques] echellesMap size: ${echellesMap.size}`);
        console.log(`[buildRubriques] objectifsActifs count: ${objectifsActifs.length}`);
    }

    const rubriquesFinales = [];

    for (const rubriqueStatique of rubriquesStatiques) {
        const rubriqueConfig = config?.rubriquesConfig?.find(
            r => r.rubriqueReference === rubriqueStatique.code
        );

        if (rubriqueConfig?.estActive === false) continue;

        const questions = await buildRubriqueQuestions(rubriqueStatique, rubriqueConfig, echellesMap);

        // Questions 3.2 et 3.3 pour CONTENU_PEDAGOGIQUE
        if (rubriqueStatique.code === 'CONTENU_PEDAGOGIQUE' && objectifsActifs.length > 0) {

            // Vérifier qu'elles ne sont pas déjà présentes (via questions statiques)
            const dejaComprehension = questions.some(q => q.code === 'objectifs_comprehension');
            const dejaAtteinte      = questions.some(q => q.code === 'objectifs_atteinte');

            // Récupérer les typeEchelle IDs depuis les questions statiques existantes
            // plutôt que par findOne sur nomFr (fragile aux variations typographiques).
            // On cherche une question statique de référence qui utilise le bon type.
            // - Pour comprehension : question dédiée dans QuestionStatique (code objectifs_comprehension)
            //   ou à défaut on cherche dans tous les types disponibles.
            // - Pour atteinte : même typeEchelle que contenu_attentes / app_occasion
            //   (Echelle d'accord simplifiée = "68874a025cca419d04c10fdd").
            
            // Stratégie : parcourir toutes les questions de la rubrique statique pour
            // trouver les typeEchelle de référence déjà résolus.
            const qRefComprehension = rubriqueStatique.questions.find(
                q => q.code === 'objectifs_comprehension'
            );
            const qRefAtteinte = rubriqueStatique.questions.find(
                q => q.code === 'objectifs_atteinte'
            );

            // Fallback : chercher un typeEchelle connu via une autre question statique
            // qui utilise l'échelle d'accord (ex: contenu_attentes)
            const qRefAccord = rubriqueStatique.questions.find(
                q => q.code === 'contenu_attentes' && q.typeEchelle
            );

            if (!dejaComprehension) {
                // Résolution du typeEchelle pour la compréhension
                const typeEchelleComprehensionId = extractId(qRefComprehension?.typeEchelle) || null;
                const comprehensionEchelles = resolveEchelles(
                    qRefComprehension?.typeEchelle || null,
                    echellesMap
                );

                questions.push({
                    _id:              new mongoose.Types.ObjectId(),
                    code:             'objectifs_comprehension',
                    libelleFr:        "S'agissant spécifiquement des objectifs de la formation, quel est votre degré de compréhension :",
                    libelleEn:        'Regarding the specific training objectives, what is your level of understanding:',
                    type:             'objectifs_comprehension',
                    commentaireGlobal: false,
                    ordre:            2,
                    typeEchelle:      typeEchelleComprehensionId ? new mongoose.Types.ObjectId(typeEchelleComprehensionId) : null,
                    echelles:         comprehensionEchelles,
                    echellesPersonnalisees: [],
                    sousQuestions:    objectifsActifs.map((obj, idx) => ({
                        _id:                  new mongoose.Types.ObjectId(),
                        code:                 obj.id.toString(),
                        libelleFr:            obj.libelleFr,
                        libelleEn:            obj.libelleEn || obj.libelleFr,
                        ordre:                idx + 1,
                        commentaireObligatoire: false,
                    })),
                });
            }

            if (!dejaAtteinte) {
                // Résolution du typeEchelle pour l'atteinte :
                // priorité à la question statique objectifs_atteinte,
                // sinon fallback sur contenu_attentes (même type d'échelle d'accord)
                const typeEchelleAtteinteRef = qRefAtteinte?.typeEchelle || qRefAccord?.typeEchelle || null;
                const typeEchelleAtteinteId  = extractId(typeEchelleAtteinteRef);
                const accordEchelles         = resolveEchelles(typeEchelleAtteinteRef, echellesMap);

                questions.push({
                    _id:              new mongoose.Types.ObjectId(),
                    code:             'objectifs_atteinte',
                    libelleFr:        'Au terme de la formation, pensez-vous que les objectifs ont été atteints :',
                    libelleEn:        'At the end of the training, do you think the objectives were achieved:',
                    type:             'objectifs_atteinte',
                    commentaireGlobal: false,
                    ordre:            3,
                    typeEchelle:      typeEchelleAtteinteId ? new mongoose.Types.ObjectId(typeEchelleAtteinteId) : null,
                    echelles:         accordEchelles,
                    echellesPersonnalisees: [],
                    sousQuestions:    objectifsActifs.map((obj, idx) => ({
                        _id:                  new mongoose.Types.ObjectId(),
                        code:                 obj.id.toString(),
                        libelleFr:            `Objectif n°${idx + 1} : ${obj.libelleFr}`,
                        libelleEn:            obj.libelleEn
                            ? `Objective n°${idx + 1}: ${obj.libelleEn}`
                            : `Objective n°${idx + 1}: ${obj.libelleFr}`,
                        ordre:                idx + 1,
                        commentaireObligatoire: false,
                    })),
                });
            }
        }

        questions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        rubriquesFinales.push({
            _id:    new mongoose.Types.ObjectId(),
            code:   rubriqueStatique.code,
            titreFr: rubriqueConfig?.titreFr || rubriqueStatique.titreFr,
            titreEn: rubriqueConfig?.titreEn || rubriqueStatique.titreEn,
            ordre:   rubriqueConfig?.ordre   || rubriqueStatique.ordre,
            questions,
        });
    }

    // Rubriques personnalisées (ordre >= 5)
    const persoTriees = [...rubriquesPersonnalisees].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    for (let i = 0; i < persoTriees.length; i++) {
        const rp = persoTriees[i];
        const rubriqueQuestions = [];

        for (const q of rp.questions || []) {
            rubriqueQuestions.push({
                _id:              new mongoose.Types.ObjectId(),
                code:             q.id || `perso_${Date.now()}_${i}`,
                libelleFr:        q.libelleFr,
                libelleEn:        q.libelleEn || '',
                type:             q.typeQuestion || 'simple',
                commentaireGlobal: q.commentaireGlobal || false,
                ordre:            q.ordre || 0,
                typeEchelle:      extractId(q.typeEchelleId) ? new mongoose.Types.ObjectId(extractId(q.typeEchelleId)) : null,
                echelles:         resolveEchelles(q.typeEchelleId, echellesMap),  // ← correction
                echellesPersonnalisees: [],
                sousQuestions:    (q.sousQuestions || []).map(sq => ({
                    _id:                  new mongoose.Types.ObjectId(),
                    code:                 sq.id || sq.code,
                    libelleFr:            sq.libelleFr,
                    libelleEn:            sq.libelleEn || '',
                    ordre:                sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire || false,
                })),
            });
        }

        rubriqueQuestions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        rubriquesFinales.push({
            _id:    new mongoose.Types.ObjectId(),
            code:   `perso_${i}`,
            titreFr: rp.titreFr,
            titreEn: rp.titreEn || '',
            ordre:   5 + i,
            questions: rubriqueQuestions,
        });
    }

    rubriquesFinales.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    return rubriquesFinales;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

export function calculerProgression(rubriquesReponse, evaluationModel) {
    let totalQuestions = 0;
    let totalRepondu   = 0;

    for (const rubrique of evaluationModel.rubriques || []) {
        for (const question of rubrique.questions || []) {
            if (question.sousQuestions?.length > 0) {
                totalQuestions += question.sousQuestions.length;
            } else {
                totalQuestions += 1;
            }
        }
    }

    for (const rubriqueRep of rubriquesReponse || []) {
        for (const questionRep of rubriqueRep.questions || []) {
            if (questionRep.sousQuestions?.length > 0) {
                totalRepondu += questionRep.sousQuestions.filter(sq => sq.reponseEchelleId).length;
            } else if (questionRep.reponseEchelleId) {
                totalRepondu += 1;
            } else if (questionRep.commentaireGlobal?.trim()) {
                totalRepondu += 1;
            }
        }
    }

    return totalQuestions > 0 ? Math.round((totalRepondu / totalQuestions) * 100) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FORMATAGE DES RUBRIQUES
// ═══════════════════════════════════════════════════════════════════════════════

export function formatRubriques(rubriques = []) {
    return rubriques
        .filter(r => r.rubriqueId)
        .map(rubrique => ({
            rubriqueId: new mongoose.Types.ObjectId(rubrique.rubriqueId),
            questions: (rubrique.questions || [])
                .filter(q => q.questionId)
                .map(question => {
                    const qData = {
                        questionId:       new mongoose.Types.ObjectId(question.questionId),
                        commentaireGlobal: question.commentaireGlobal || '',
                    };
                    if (question.sousQuestions?.length > 0) {
                        qData.sousQuestions = question.sousQuestions
                            .filter(sq => sq.sousQuestionId && sq.reponseEchelleId)
                            .map(sq => ({
                                sousQuestionId:   new mongoose.Types.ObjectId(sq.sousQuestionId),
                                reponseEchelleId: new mongoose.Types.ObjectId(sq.reponseEchelleId),
                                commentaire:      sq.commentaire || '',
                            }));
                    } else if (question.reponseEchelleId) {
                        qData.reponseEchelleId = new mongoose.Types.ObjectId(question.reponseEchelleId);
                    }
                    return qData;
                }),
        }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════════

export function findQuestionInEvaluation(evaluation, questionId) {
    for (const rubrique of evaluation.rubriques || []) {
        for (const question of rubrique.questions || []) {
            if (question._id.toString() === questionId.toString()) return question;
        }
    }
    return null;
}

export function getBasePipelineForStats(evaluationId) {
    return [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $addFields: {
                reponseEchelleIds: {
                    $cond: {
                        if:   { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
                        then: '$rubriques.questions.sousQuestions.reponseEchelleId',
                        else: ['$rubriques.questions.reponseEchelleId'],
                    },
                },
                questionId: '$rubriques.questions.questionId',
                rubriqueId: '$rubriques.rubriqueId',
            },
        },
        { $match: { reponseEchelleIds: { $not: { $in: [null, [null]] } } } },
        {
            $lookup: {
                from:         'echellereponses',
                localField:   'reponseEchelleIds',
                foreignField: '_id',
                as:           'echellesReponse',
            },
        },
        {
            $addFields: {
                valeurNumerique:  { $avg: '$echellesReponse.ordre' },
                ordresNumeriques: '$echellesReponse.ordre',
            },
        },
        { $match: { valeurNumerique: { $ne: null } } },
    ];
}

export function getSousQuestionsPipeline(evaluationId) {
    return [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $unwind: '$rubriques.questions.sousQuestions' },
        {
            $lookup: {
                from:         'echellereponses',
                localField:   'rubriques.questions.sousQuestions.reponseEchelleId',
                foreignField: '_id',
                as:           'echelleReponse',
            },
        },
        { $unwind: '$echelleReponse' },
        {
            $group: {
                _id: {
                    questionId:    '$rubriques.questions.questionId',
                    sousQuestionId:'$rubriques.questions.sousQuestions.sousQuestionId',
                },
                moyenne: { $avg: '$echelleReponse.ordre' },
                min:     { $min: '$echelleReponse.ordre' },
                max:     { $max: '$echelleReponse.ordre' },
                count:   { $sum: 1 },
                ordres:  { $push: '$echelleReponse.ordre' },
            },
        },
    ];
}

export async function getQuestionStats(evaluationId, questionId, lang) {
    const evaluation = await EvaluationAChaud.findById(evaluationId).lean();
    const question   = findQuestionInEvaluation(evaluation, questionId);
    if (!question) throw new Error('Question non trouvée');

    const repartitionBrute = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        {
            $addFields: {
                reponsesPourStats: {
                    $cond: {
                        if:   { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
                        then: '$rubriques.questions.sousQuestions',
                        else: [{ reponseEchelleId: '$rubriques.questions.reponseEchelleId' }],
                    },
                },
            },
        },
        { $unwind: '$reponsesPourStats' },
        { $group: { _id: '$reponsesPourStats.reponseEchelleId', count: { $sum: 1 } } },
        { $lookup: { from: 'echellereponses', localField: '_id', foreignField: '_id', as: 'echelleData' } },
        { $unwind: '$echelleData' },
        { $addFields: { ordre: '$echelleData.ordre' } },
        { $sort: { ordre: 1 } },
    ]);

    let totalReponses = 0, somme = 0;
    for (const item of repartitionBrute) { totalReponses += item.count; somme += item.ordre * item.count; }
    const moyenne = totalReponses > 0 ? somme / totalReponses : 0;

    const couleurs = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    const repartitionFormatee = (question.echelles || [])
        .sort((a, b) => a.ordre - b.ordre)
        .map((echelle, index) => {
            const item = repartitionBrute.find(r => r.ordre === echelle.ordre);
            return {
                echelle: lang === 'fr' ? echelle.nomFr : (echelle.nomEn || echelle.nomFr),
                valeur:  item?.count || 0,
                couleur: couleurs[index] || '#6b7280',
            };
        });

    const sousQuestionsStats = await getSousQuestionsStats(evaluationId, questionId, question, lang);

    return {
        id:            questionId,
        libelle:       lang === 'fr' ? question.libelleFr : (question.libelleEn || question.libelleFr),
        moyenne:       parseFloat(moyenne.toFixed(2)),
        totalReponses,
        repartition:   repartitionFormatee,
        sousQuestions: sousQuestionsStats,
    };
}

export async function getSousQuestionsStats(evaluationId, questionId, question, lang) {
    if (!question.sousQuestions?.length) return [];

    const statsRaw = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $match: { 'rubriques.questions.questionId': new mongoose.Types.ObjectId(questionId) } },
        { $unwind: '$rubriques.questions.sousQuestions' },
        {
            $group: {
                _id: {
                    sousQuestionId:   '$rubriques.questions.sousQuestions.sousQuestionId',
                    reponseEchelleId: '$rubriques.questions.sousQuestions.reponseEchelleId',
                },
                count: { $sum: 1 },
            },
        },
    ]);

    return question.sousQuestions.map(sousQuestion => {
        const reponsesSubQ = statsRaw.filter(
            s => s._id.sousQuestionId?.toString() === sousQuestion._id.toString()
        );
        let totalReponses = 0, somme = 0;
        for (const reponse of reponsesSubQ) {
            const echelleItem = (question.echelles || []).find(
                e => e._id.toString() === reponse._id.reponseEchelleId?.toString()
            );
            if (echelleItem) { totalReponses += reponse.count; somme += echelleItem.ordre * reponse.count; }
        }
        return {
            sousQuestionId: sousQuestion._id,
            libelle:        lang === 'fr' ? sousQuestion.libelleFr : (sousQuestion.libelleEn || sousQuestion.libelleFr),
            moyenne:        totalReponses > 0 ? parseFloat((somme / totalReponses).toFixed(2)) : 0,
            totalReponses,
        };
    });
}

export async function getAdvancedEvaluationStats(evaluationId) {
    const totalParticipants = await EvaluationAChaudReponse.countDocuments({
        modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis',
    });

    const commentairesAgg = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $group: {
                _id: null,
                generaux:  { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$commentaireGeneral', ''] } }, 0] }, 1, 0] } },
                questions: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$rubriques.questions.commentaireGlobal', ''] } }, 0] }, 1, 0] } },
            },
        },
        { $project: { _id: 0, nombreTotal: { $add: ['$generaux', '$questions'] } } },
    ]);
    const nombreTotalCommentaires = commentairesAgg[0]?.nombreTotal || 0;

    const statsParQuestion = await EvaluationAChaudReponse.aggregate([
        ...getBasePipelineForStats(evaluationId),
        {
            $group: {
                _id:       '$questionId',
                rubriqueId:{ $first: '$rubriqueId' },
                valeurs:   { $push: '$valeurNumerique' },
                moyenne:   { $avg:  '$valeurNumerique' },
                minimum:   { $min:  '$valeurNumerique' },
                maximum:   { $max:  '$valeurNumerique' },
                count:     { $sum:  1 },
            },
        },
    ]);

    let totalReponsesGlobal = 0, sommeMoyennes = 0;
    const distributionGlobale = {}, rubriquesMap = {}, statsParQuestionFinal = [];

    for (const q of statsParQuestion) {
        const dist = q.valeurs.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
        const countLow  = dist[q.minimum] || 0;
        const countHigh = dist[q.maximum] || 0;

        statsParQuestionFinal.push({
            questionId:   q._id,
            moyenne:      parseFloat(q.moyenne.toFixed(2)),
            nbReponses:   q.count,
            distribution: dist,
            tendance:     countHigh > countLow ? 'positive' : countLow > countHigh ? 'négative' : 'neutre',
        });

        totalReponsesGlobal += q.count;
        sommeMoyennes       += q.moyenne;
        for (const [note, count] of Object.entries(dist)) {
            distributionGlobale[note] = (distributionGlobale[note] || 0) + count;
        }

        const rid = q.rubriqueId?.toString();
        if (rid) {
            if (!rubriquesMap[rid]) rubriquesMap[rid] = { sumMoyennes: 0, countQuestions: 0, nbReponses: 0 };
            rubriquesMap[rid].sumMoyennes    += q.moyenne;
            rubriquesMap[rid].countQuestions += 1;
            rubriquesMap[rid].nbReponses     += q.count;
        }
    }

    const moyenneGlobale = statsParQuestion.length > 0
        ? parseFloat((sommeMoyennes / statsParQuestion.length).toFixed(2)) : 0;

    const performanceRubriques = Object.entries(rubriquesMap).map(([id, v]) => ({
        id,
        moyenne:    parseFloat((v.sumMoyennes / v.countQuestions).toFixed(2)),
        nbReponses: v.nbReponses,
    }));

    const reponsesManquantes = await EvaluationAChaudReponse.aggregate([
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $match: {
                'rubriques.questions.reponseEchelleId': { $in: [null, undefined] },
                'rubriques.questions.sousQuestions':    { $size: 0 },
                'rubriques.questions.commentaireGlobal':{ $in: ['', null] },
            },
        },
        { $group: { _id: '$rubriques.questions.questionId', nombreManquant: { $sum: 1 } } },
    ]);

    return {
        statistiquesDescriptives: {
            moyenne:            moyenneGlobale,
            count:              totalReponsesGlobal,
            minimum:            totalReponsesGlobal > 0 ? Math.min(...Object.keys(distributionGlobale).map(Number)) : 0,
            maximum:            totalReponsesGlobal > 0 ? Math.max(...Object.keys(distributionGlobale).map(Number)) : 0,
            nombreParticipants: totalParticipants,
            nombreCommentaires: nombreTotalCommentaires,
        },
        distribution:        { details: distributionGlobale },
        performanceRubriques,
        statsParQuestion:    statsParQuestionFinal,
        reponsesManquantes:  reponsesManquantes.map(r => ({ questionId: r._id, nombre: r.nombreManquant })),
    };
}

export async function getStatsGroupedByField(evaluationId, field) {
    try {
        const stats = await EvaluationAChaudReponse.aggregate([
            { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
            { $lookup: { from: 'utilisateurs', localField: 'utilisateur', foreignField: '_id', as: 'utilisateur' } },
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
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 25] }, then: 'Moins de 25' },
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 35] }, then: '26-35' },
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 45] }, then: '36-45' },
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 55] }, then: '46-55' },
                                            ],
                                            default: 'Plus de 55',
                                        },
                                    },
                                },
                                { case: { $eq: [field, 'familleMetier'] },           then: '$utilisateur.categorieProfessionnelle.familleMetier' },
                                { case: { $eq: [field, 'categorieProfessionnelle'] }, then: '$utilisateur.categorieProfessionnelle.nom' },
                                { case: { $eq: [field, 'service'] },                 then: '$utilisateur.service.nom' },
                                { case: { $eq: [field, 'sexe'] },                    then: '$utilisateur.sexe' },
                            ],
                            default: null,
                        },
                    },
                },
            },
            { $unwind: '$rubriques' },
            { $unwind: '$rubriques.questions' },
            {
                $lookup: {
                    from:         'echellereponses',
                    localField:   'rubriques.questions.reponseEchelleId',
                    foreignField: '_id',
                    as:           'echelleDirecte',
                },
            },
            {
                $group: {
                    _id:     { groupe: '$groupKey', rubriqueId: '$rubriques.rubriqueId', questionId: '$rubriques.questions.questionId' },
                    moyenne: { $avg: { $arrayElemAt: ['$echelleDirecte.ordre', 0] } },
                    total:   { $sum: 1 },
                },
            },
            {
                $group: {
                    _id:      '$_id.groupe',
                    questions:{ $push: { rubriqueId: '$_id.rubriqueId', questionId: '$_id.questionId', moyenne: '$moyenne', total: '$total' } },
                },
            },
        ]);
        return { success: true, data: stats };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

export async function getEvolutionMensuelle(nombreMois, themeId) {
    const evolution = [], maintenant = new Date();
    for (let i = nombreMois - 1; i >= 0; i--) {
        const debut = new Date(maintenant);
        debut.setMonth(debut.getMonth() - i - 1); debut.setDate(1); debut.setHours(0, 0, 0, 0);
        const fin = new Date(debut); fin.setMonth(fin.getMonth() + 1);

        const pipeline = [
            { $match: { dateSoumission: { $gte: debut, $lt: fin }, statut: 'soumis' } },
            { $lookup: { from: 'evaluationachauds', localField: 'modele', foreignField: '_id', as: 'evaluation' } },
            { $unwind: '$evaluation' },
        ];
        if (themeId) pipeline.push({ $match: { 'evaluation.theme': new mongoose.Types.ObjectId(themeId) } });
        pipeline.push({ $count: 'total' });

        const result = await EvaluationAChaudReponse.aggregate(pipeline);
        evolution.push({
            mois:          debut.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
            totalReponses: result[0]?.total || 0,
            periode:       { debut: debut.toISOString(), fin: fin.toISOString() },
        });
    }
    return evolution;
}

export async function getTopEvaluations(matchCondition, lang, limit) {
    return EvaluationAChaud.aggregate([
        { $match: matchCondition },
        { $lookup: { from: 'evaluationachaudreponses', localField: '_id', foreignField: 'modele', as: 'reponses' } },
        { $addFields: { totalReponses: { $size: '$reponses' } } },
        { $sort: { totalReponses: -1 } },
        { $limit: limit },
        { $project: { titre: lang === 'fr' ? '$titreFr' : '$titreEn', totalReponses: 1 } },
    ]);
}

export function formatToCSV(donnees, evaluation, lang) {
    const headers = ['Participant', 'Rubrique', 'Question', 'Valeur Échelle', 'Commentaire', 'Date'];
    const rows = donnees.map(item => [
        item.participant || '', item.rubrique || '', item.question || '',
        item.valeur || '', item.commentaire || '',
        item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '',
    ]);
    return [headers, ...rows]
        .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXPORT GOOGLE FORMS
// ═══════════════════════════════════════════════════════════════════════════════

export function buildGoogleFormDefinition(evaluation, lang) {
    const titre = lang === 'fr' ? evaluation.titreFr : (evaluation.titreEn || evaluation.titreFr);
    const desc  = lang === 'fr' ? (evaluation.descriptionFr || '') : (evaluation.descriptionEn || '');

    const form     = { info: { title: titre, description: desc } };
    const requests = [];
    let insertIndex = 0;

    for (const rubrique of evaluation.rubriques || []) {
        const rubTitre = lang === 'fr' ? rubrique.titreFr : (rubrique.titreEn || rubrique.titreFr);

        requests.push({
            createItem: {
                item: { title: `Rubrique ${rubrique.ordre} — ${rubTitre}`, pageBreakItem: {} },
                location: { index: insertIndex++ },
            },
        });

        for (const question of rubrique.questions || []) {
            const qLibelle = lang === 'fr' ? question.libelleFr : (question.libelleEn || question.libelleFr);
            const echelles = [...(question.echelles || [])].sort((a, b) => b.ordre - a.ordre);

            if (question.sousQuestions?.length > 0 && echelles.length > 0) {
                requests.push({
                    createItem: {
                        item: {
                            title: qLibelle,
                            questionGroupItem: {
                                questions: question.sousQuestions.map(sq => ({
                                    required:    false,
                                    rowQuestion: { title: lang === 'fr' ? sq.libelleFr : (sq.libelleEn || sq.libelleFr) },
                                })),
                                grid: {
                                    columns: {
                                        type:    'RADIO',
                                        options: echelles.map(e => ({ value: lang === 'fr' ? e.nomFr : (e.nomEn || e.nomFr) })),
                                    },
                                    shuffleQuestions: false,
                                },
                            },
                        },
                        location: { index: insertIndex++ },
                    },
                });
            } else if (echelles.length > 0) {
                requests.push({
                    createItem: {
                        item: {
                            title: qLibelle,
                            questionItem: {
                                question: {
                                    required: false,
                                    choiceQuestion: {
                                        type:    'RADIO',
                                        options: echelles.map(e => ({ value: lang === 'fr' ? e.nomFr : (e.nomEn || e.nomFr) })),
                                        shuffle: false,
                                    },
                                },
                            },
                        },
                        location: { index: insertIndex++ },
                    },
                });
            } else {
                requests.push({
                    createItem: {
                        item: {
                            title:        qLibelle,
                            questionItem: { question: { required: false, textQuestion: { paragraph: true } } },
                        },
                        location: { index: insertIndex++ },
                    },
                });
            }

            if (question.commentaireGlobal) {
                requests.push({
                    createItem: {
                        item: {
                            title:        `Commentaires — ${qLibelle}`,
                            questionItem: { question: { required: false, textQuestion: { paragraph: true } } },
                        },
                        location: { index: insertIndex++ },
                    },
                });
            }
        }
    }

    return { form, requests };
}