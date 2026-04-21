// services/evaluationAChaudService.js
import mongoose from 'mongoose';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import TypeEchelleReponse from '../models/TypeEchelleDeReponse.js';
import EchelleReponse from '../models/EchelleDeReponse.js';
import TemplateConfig from '../models/TemplateConfig.js';
import {getRubriquesStatiquesCompletes} from './rubriqueStatiqueService.js';
import { Objectif } from '../models/Objectif.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTRUCTION DES RUBRIQUES (préremplissage à la création/modification)
// ═══════════════════════════════════════════════════════════════════════════════

async function chargerEchellesParType() {
    const types   = await TypeEchelleReponse.find({}).lean();
    const echelles = await EchelleReponse.find({}).sort({ ordre: 1 }).lean();

    // typeId -> [{_id, nomFr, nomEn, ordre}]
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
        // Indexé par _id du type
        result.set(tid, echellesCompletes);
        // Indexé par nomFr (pour compatibilité avec le reste du service)
        result.set(t.nomFr.toLowerCase().trim(), echellesCompletes);
    }
    return result;
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
        ordre: obj.ordre || 0
    }));
    
    const objectifsPersonnalises = config?.objectifsConfig?.objectifsPersonnalises || [];
    const objectifsSupprimes = config?.objectifsConfig?.objectifsSupprimes?.map(id => id.toString()) || [];
    const objectifsPersonnalisesSupprimes = config?.objectifsConfig?.objectifsPersonnalisesSupprimes || [];
    
    const objectifsBaseActifs = objectifsBaseFormates.filter(
        obj => !objectifsSupprimes.includes(obj.id.toString())
    );
    
    const objectifsPersonnalisesActifs = objectifsPersonnalises.filter(
        obj => !objectifsPersonnalisesSupprimes.includes(obj.id)
    );
    
    const tousObjectifs = [...objectifsBaseActifs, ...objectifsPersonnalisesActifs];
    tousObjectifs.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    
    return tousObjectifs;
}

/**
 * Construit les questions d'une rubrique en tenant compte de la configuration
 */

/**
 * Construit les questions d'une rubrique en tenant compte de la configuration
 */
async function buildRubriqueQuestions(rubriqueStatique, rubriqueConfig, echellesMap) {
    const questions = [];
    
    if (!rubriqueConfig) {
        // Pas de configuration, utiliser les questions statiques telles quelles
        for (const q of rubriqueStatique.questions) {
            questions.push({
                _id: new mongoose.Types.ObjectId(),
                code: q.code,
                libelleFr: q.libelleFr,
                libelleEn: q.libelleEn,
                type: q.type,
                commentaireGlobal: q.commentaireGlobal,
                ordre: q.ordre,
                typeEchelle: q.typeEchelle,
                echelles: q.typeEchelle ? (echellesMap.get(q.typeEchelle.toString()) || []) : [],
                sousQuestions: q.sousQuestions?.map(sq => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: sq.id,
                    libelleFr: sq.libelleFr,
                    libelleEn: sq.libelleEn,
                    ordre: sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire
                })) || []
            });
        }
        return questions;
    }
    
    const questionsSupprimees = rubriqueConfig.questionsSupprimees || [];
    const questionsModifiees = rubriqueConfig.questionsModifiees || [];
    const questionsPersonnalisees = rubriqueConfig.questionsPersonnalisees || [];
    
    // 1. Créer une Map de TOUTES les questions personnalisées (clé = id de la question originale)
    const customQuestionsMap = new Map(); // key: originalId, value: la question personnalisée
    
    for (const qp of questionsPersonnalisees) {
        // Vérifier si c'est une modification de question statique (id commence par custom_)
        if (qp.id && qp.id.startsWith('custom_')) {
            // Extraire l'ID original (ex: custom_profil_structure_1234567890 -> profil_structure)
            const originalId = qp.id.replace('custom_', '').split('_')[0] + '_' + qp.id.replace('custom_', '').split('_')[1];
            customQuestionsMap.set(originalId, qp);
        }
    }
    
    // 2. Ajouter les questions statiques (originales ou remplacées par custom_)
    for (const q of rubriqueStatique.questions) {
        // Vérifier si la question a été supprimée
        if (questionsSupprimees.includes(q.code)) continue;
        
        // Vérifier si une version personnalisée existe (via custom_)
        const customVersion = customQuestionsMap.get(q.code);
        
        if (customVersion) {
            // ✅ Utiliser la version personnalisée (remplace l'originale)
            questions.push({
                _id: new mongoose.Types.ObjectId(),
                code: customVersion.id,
                libelleFr: customVersion.libelleFr,
                libelleEn: customVersion.libelleEn || '',
                type: customVersion.typeQuestion || 'simple',
                commentaireGlobal: customVersion.commentaireObligatoire || false,
                ordre: customVersion.ordre || q.ordre,
                typeEchelle: customVersion.typeEchelleId,
                echelles: customVersion.typeEchelleId ? (echellesMap.get(customVersion.typeEchelleId.toString()) || []) : [],
                sousQuestions: customVersion.sousQuestions?.map(sq => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: sq.id,
                    libelleFr: sq.libelleFr,
                    libelleEn: sq.libelleEn,
                    ordre: sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire
                })) || []
            });
        } else {
            // ✅ Version originale (non modifiée)
            questions.push({
                _id: new mongoose.Types.ObjectId(),
                code: q.code,
                libelleFr: q.libelleFr,
                libelleEn: q.libelleEn,
                type: q.type,
                commentaireGlobal: q.commentaireGlobal,
                ordre: q.ordre,
                typeEchelle: q.typeEchelle,
                echelles: q.typeEchelle ? (echellesMap.get(q.typeEchelle.toString()) || []) : [],
                sousQuestions: q.sousQuestions?.map(sq => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: sq.id,
                    libelleFr: sq.libelleFr,
                    libelleEn: sq.libelleEn,
                    ordre: sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire
                })) || []
            });
        }
    }
    
    // 3. Ajouter les questions personnalisées (uniquement les NOUVELLES questions, pas les custom_)
    for (const qp of questionsPersonnalisees) {
        // Ignorer les questions custom_ (déjà traitées)
        if (qp.id && qp.id.startsWith('custom_')) continue;
        
        questions.push({
            _id: new mongoose.Types.ObjectId(),
            code: qp.id,
            libelleFr: qp.libelleFr,
            libelleEn: qp.libelleEn || '',
            type: qp.typeQuestion || 'simple',
            commentaireGlobal: qp.commentaireObligatoire || false,
            ordre: qp.ordre || 999,
            typeEchelle: qp.typeEchelleId,
            echelles: qp.typeEchelleId ? (echellesMap.get(qp.typeEchelleId.toString()) || []) : [],
            sousQuestions: qp.sousQuestions?.map(sq => ({
                _id: new mongoose.Types.ObjectId(),
                code: sq.id,
                libelleFr: sq.libelleFr,
                libelleEn: sq.libelleEn,
                ordre: sq.ordre,
                commentaireObligatoire: sq.commentaireObligatoire
            })) || []
        });
    }
    
    // 4. Trier par ordre
    questions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    
    return questions;
}

/**
 * Construit le tableau complet rubriques[] avec les vraies echelles de la base.
 * - Rubriques 1-4 sont préremplies (modifiables comme n'importe quelle rubrique)
 * - Rubriques 3.2 et 3.3 sont générées depuis objectifs[]
 * - Rubriques personnalisées ajoutées à partir de l'ordre 5
 */
export async function buildRubriques(evaluationId, rubriquesPersonnalisees = []) {
    // 1. Récupérer l'évaluation
    const evaluation = await EvaluationAChaud.findById(evaluationId).populate('theme').lean();
    if (!evaluation) throw new Error('Évaluation non trouvée');
    const themeId = evaluation.theme?._id || evaluation.theme;
    
    // 2. Récupérer les rubriques statiques
    const rubriquesStatiques = await getRubriquesStatiquesCompletes();
    
    // 3. Récupérer la configuration
    const config = await TemplateConfig.findOne({ evaluationId }).lean();
    
    // 4. Récupérer les échelles
    const echellesMap = await chargerEchellesParType();
    
    // 5. Récupérer les objectifs actifs
    const objectifsActifs = await getObjectifsActifs(themeId, config);
    
    const rubriquesFinales = [];
    
    // 6. Parcourir les rubriques statiques
    for (const rubriqueStatique of rubriquesStatiques) {
        const rubriqueConfig = config?.rubriquesConfig?.find(
            r => r.rubriqueReference === rubriqueStatique.code
        );
        
        if (rubriqueConfig?.estActive === false) continue;
        
        // Construire les questions de la rubrique
        const questions = await buildRubriqueQuestions(rubriqueStatique, rubriqueConfig, echellesMap);
        
        // Section 3.2 et 3.3 pour CONTENU_PEDAGOGIQUE
        if (rubriqueStatique.code === 'CONTENU_PEDAGOGIQUE' && objectifsActifs.length > 0) {
            const typeComprehension = await TypeEchelleReponse.findOne({ 
                nomFr: { $regex: new RegExp('^Echelle compréhension$', 'i') }
            }).lean();
            
            const typeAccord = await TypeEchelleReponse.findOne({ 
                nomFr: { $regex: new RegExp("^Echelle d’accord simplifiée$", 'i') }
            }).lean();
            
            const comprehensionEchelles = typeComprehension ? (echellesMap.get(typeComprehension._id.toString()) || []) : [];
            const accordEchelles = typeAccord ? (echellesMap.get(typeAccord._id.toString()) || []) : [];
            
            // 3.2 - Compréhension
            questions.push({
                _id: new mongoose.Types.ObjectId(),
                code: 'objectifs_comprehension',
                libelleFr: "S'agissant spécifiquement des objectifs de la formation, quel est votre degré de compréhension :",
                libelleEn: 'Regarding the specific training objectives, what is your level of understanding:',
                type: 'objectifs_comprehension',
                commentaireGlobal: false,
                ordre: 2,
                typeEchelle: typeComprehension?._id || null,
                echelles: comprehensionEchelles,
                sousQuestions: objectifsActifs.map((obj, idx) => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: obj.id,
                    libelleFr: obj.libelleFr,
                    libelleEn: obj.libelleEn || obj.libelleFr,
                    ordre: idx + 1,
                    commentaireObligatoire: false
                }))
            });
            
            // 3.3 - Atteinte
            questions.push({
                _id: new mongoose.Types.ObjectId(),
                code: 'objectifs_atteinte',
                libelleFr: 'Au terme de la formation, pensez-vous que les objectifs ont été atteints :',
                libelleEn: 'At the end of the training, do you think the objectives were achieved:',
                type: 'objectifs_atteinte',
                commentaireGlobal: false,
                ordre: 3,
                typeEchelle: typeAccord?._id || null,
                echelles: accordEchelles,
                sousQuestions: objectifsActifs.map((obj, idx) => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: obj.id,
                    libelleFr: `Objectif n°${idx + 1} : ${obj.libelleFr}`,
                    libelleEn: obj.libelleEn ? `Objective n°${idx + 1}: ${obj.libelleEn}` : `Objective n°${idx + 1}: ${obj.libelleFr}`,
                    ordre: idx + 1,
                    commentaireObligatoire: false
                }))
            });
        }
        
        // Trier les questions
        questions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        
        rubriquesFinales.push({
            _id: new mongoose.Types.ObjectId(),
            code: rubriqueStatique.code,
            titreFr: rubriqueConfig?.titreFr || rubriqueStatique.titreFr,
            titreEn: rubriqueConfig?.titreEn || rubriqueStatique.titreEn,
            ordre: rubriqueConfig?.ordre || rubriqueStatique.ordre,
            questions
        });
    }
    
    // 7. Ajouter les rubriques personnalisées (ordre >= 5)
    const persoTriees = [...rubriquesPersonnalisees].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    for (let i = 0; i < persoTriees.length; i++) {
        const rp = persoTriees[i];
        const rubriqueQuestions = [];  // ✅ Déclaration correcte
        
        for (const q of rp.questions || []) {
            rubriqueQuestions.push({
                _id: new mongoose.Types.ObjectId(),
                code: q.id || `perso_${Date.now()}_${i}`,
                libelleFr: q.libelleFr,
                libelleEn: q.libelleEn || '',
                type: q.typeQuestion || 'simple',
                commentaireGlobal: q.commentaireGlobal || false,
                ordre: q.ordre || 0,
                typeEchelle: q.typeEchelleId,
                echelles: q.typeEchelleId ? (echellesMap.get(q.typeEchelleId.toString()) || []) : [],
                sousQuestions: (q.sousQuestions || []).map(sq => ({
                    _id: new mongoose.Types.ObjectId(),
                    code: sq.id,
                    libelleFr: sq.libelleFr,
                    libelleEn: sq.libelleEn,
                    ordre: sq.ordre,
                    commentaireObligatoire: sq.commentaireObligatoire || false
                }))
            });
        }
        
        rubriqueQuestions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));  // ✅ Correction ici
        
        rubriquesFinales.push({
            _id: new mongoose.Types.ObjectId(),
            code: `perso_${i}`,
            titreFr: rp.titreFr,
            titreEn: rp.titreEn || '',
            ordre: 5 + i,
            questions: rubriqueQuestions
        });
    }
    
    // Trier les rubriques par ordre
    rubriquesFinales.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    
    return rubriquesFinales;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

export function calculerProgression(rubriquesReponse, evaluationModel) {
    let totalQuestions = 0;
    let totalRepondu = 0;

    for (const rubrique of evaluationModel.rubriques || []) {
        for (const question of rubrique.questions || []) {
            if (question.sousQuestions?.length > 0) {
                totalQuestions += question.sousQuestions.length;
            } else if (question.echelles?.length > 0) {
                totalQuestions += 1;
            } else {
                totalQuestions += 1;
            }
        }
    }

    for (const rubriqueRep of rubriquesReponse || []) {
        for (const questionRep of rubriqueRep.questions || []) {
            if (questionRep.sousQuestions?.length > 0) {
                const repondues = questionRep.sousQuestions.filter(sq => sq.reponseEchelleId).length;
                totalRepondu += repondues;
            } else if (questionRep.reponseEchelleId) {
                totalRepondu += 1;
            } else if (questionRep.commentaireGlobal && questionRep.commentaireGlobal.trim() !== '') {
                totalRepondu += 1;
            }
        }
    }

    return totalQuestions > 0 ? Math.round((totalRepondu / totalQuestions) * 100) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FORMATAGE DES RUBRIQUES (body → ObjectIds pour persistance)
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
                        questionId: new mongoose.Types.ObjectId(question.questionId),
                        commentaireGlobal: question.commentaireGlobal || '',
                    };
                    if (question.sousQuestions?.length > 0) {
                        qData.sousQuestions = question.sousQuestions
                            .filter(sq => sq.sousQuestionId && sq.reponseEchelleId)
                            .map(sq => ({
                                sousQuestionId: new mongoose.Types.ObjectId(sq.sousQuestionId),
                                reponseEchelleId: new mongoose.Types.ObjectId(sq.reponseEchelleId),
                                commentaire: sq.commentaire || '',
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

/**
 * Pipeline de base réutilisable.
 * CORRECTION : filtre sur statut:'soumis' et utilise sousQuestions.reponseEchelleId
 */
export function getBasePipelineForStats(evaluationId) {
    return [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        {
            $addFields: {
                reponseEchelleIds: {
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
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
                from: 'echellereponses',
                localField: 'reponseEchelleIds',
                foreignField: '_id',
                as: 'echellesReponse',
            },
        },
        {
            $addFields: {
                valeurNumerique: { $avg: '$echellesReponse.ordre' },
                ordresNumeriques: '$echellesReponse.ordre',
            },
        },
        { $match: { valeurNumerique: { $ne: null } } },
    ];
}

/**
 * Pipeline détaillé pour les sous-questions.
 * CORRECTION : sousQuestions.sousQuestionId et sousQuestions.reponseEchelleId
 */
export function getSousQuestionsPipeline(evaluationId) {
    return [
        { $match: { modele: new mongoose.Types.ObjectId(evaluationId), statut: 'soumis' } },
        { $unwind: '$rubriques' },
        { $unwind: '$rubriques.questions' },
        { $unwind: '$rubriques.questions.sousQuestions' },
        {
            $lookup: {
                from: 'echellereponses',
                localField: 'rubriques.questions.sousQuestions.reponseEchelleId',
                foreignField: '_id',
                as: 'echelleReponse',
            },
        },
        { $unwind: '$echelleReponse' },
        {
            $group: {
                _id: {
                    questionId: '$rubriques.questions.questionId',
                    sousQuestionId: '$rubriques.questions.sousQuestions.sousQuestionId',
                },
                moyenne: { $avg: '$echelleReponse.ordre' },
                min: { $min: '$echelleReponse.ordre' },
                max: { $max: '$echelleReponse.ordre' },
                count: { $sum: 1 },
                ordres: { $push: '$echelleReponse.ordre' },
            },
        },
    ];
}

export async function getQuestionStats(evaluationId, questionId, lang) {
    const evaluation = await EvaluationAChaud.findById(evaluationId).lean();
    const question = findQuestionInEvaluation(evaluation, questionId);
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
                        if: { $gt: [{ $size: { $ifNull: ['$rubriques.questions.sousQuestions', []] } }, 0] },
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
            return { echelle: lang === 'fr' ? echelle.nomFr : echelle.nomEn, valeur: item?.count || 0, couleur: couleurs[index] || '#6b7280' };
        });

    const sousQuestionsStats = await getSousQuestionsStats(evaluationId, questionId, question, lang);

    return {
        id:            questionId,
        libelle:       lang === 'fr' ? question.libelleFr : question.libelleEn,
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
        const reponsesSubQ = statsRaw.filter(s => s._id.sousQuestionId?.toString() === sousQuestion._id.toString());
        let totalReponses = 0, somme = 0;
        for (const reponse of reponsesSubQ) {
            const echelleItem = (question.echelles || []).find(e => e._id.toString() === reponse._id.reponseEchelleId?.toString());
            if (echelleItem) { totalReponses += reponse.count; somme += echelleItem.ordre * reponse.count; }
        }
        return {
            sousQuestionId: sousQuestion._id,
            libelle:        lang === 'fr' ? sousQuestion.libelleFr : sousQuestion.libelleEn,
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
    let distributionGlobale = {};
    const rubriquesMap = {}, statsParQuestionFinal = [];

    for (const q of statsParQuestion) {
        const dist = q.valeurs.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
        const countLow = dist[q.minimum] || 0, countHigh = dist[q.maximum] || 0;

        statsParQuestionFinal.push({
            questionId: q._id,
            moyenne:    parseFloat(q.moyenne.toFixed(2)),
            nbReponses: q.count,
            distribution: dist,
            tendance: countHigh > countLow ? 'positive' : countLow > countHigh ? 'négative' : 'neutre',
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

// CORRECTION : filtre sur modele (pas formation)
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
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 35] }, then: '26-35'       },
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 45] }, then: '36-45'       },
                                                { case: { $lte: [{ $subtract: [{ $year: new Date() }, { $year: '$utilisateur.dateNaissance' }] }, 55] }, then: '46-55'       },
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

// CORRECTION : utilise EvaluationAChaudReponse + filtre statut (pas ReponseEvaluation)
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
            mois:         debut.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
            totalReponses:result[0]?.total || 0,
            periode:      { debut: debut.toISOString(), fin: fin.toISOString() },
        });
    }
    return evolution;
}

// CORRECTION : lookup sur evaluationachaudreponses (pas reponseevaluations)
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

/**
 * Construit la définition JSON compatible API Google Forms v1.
 * Retourne { form, requests } :
 *   - form     → POST /v1/forms  (titre + description)
 *   - requests → PATCH /v1/forms/{id}:batchUpdate  (toutes les questions)
 *
 * Types Google Forms utilisés :
 *   - Sous-questions + échelles → GRID (questionGroupItem)
 *   - Question simple + échelles → RADIO
 *   - Texte libre (echelles vide) → PARAGRAPH
 */
export function buildGoogleFormDefinition(evaluation, lang) {
    const titre = lang === 'fr' ? evaluation.titreFr : (evaluation.titreEn || evaluation.titreFr);
    const desc  = lang === 'fr' ? (evaluation.descriptionFr || '') : (evaluation.descriptionEn || '');

    const form     = { info: { title: titre, description: desc } };
    const requests = [];
    let insertIndex = 0;

    for (const rubrique of evaluation.rubriques || []) {
        const rubTitre = lang === 'fr' ? rubrique.titreFr : (rubrique.titreEn || rubrique.titreFr);

        // Section break par rubrique
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
                // Grille (GRID)
                requests.push({
                    createItem: {
                        item: {
                            title: qLibelle,
                            questionGroupItem: {
                                questions: question.sousQuestions.map(sq => ({
                                    required: false,
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
                // Choix unique (RADIO)
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
                // Texte libre (PARAGRAPH)
                requests.push({
                    createItem: {
                        item: {
                            title: qLibelle,
                            questionItem: { question: { required: false, textQuestion: { paragraph: true } } },
                        },
                        location: { index: insertIndex++ },
                    },
                });
            }

            // Champ commentaire additionnel si commentaireGlobal = true
            if (question.commentaireGlobal) {
                requests.push({
                    createItem: {
                        item: {
                            title: `Commentaires — ${qLibelle}`,
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