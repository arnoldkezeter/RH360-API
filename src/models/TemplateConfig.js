// models/TemplateConfig.js
import mongoose from 'mongoose';

/**
 * Sous-question personnalisée
 */
const SousQuestionPersonnaliseeSchema = new mongoose.Schema({
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    commentaireObligatoire: { type: Boolean, default: false },
    ordre: { type: Number, default: 0 }
}, { _id: false });

/**
 * Question personnalisée (ajoutée par l'utilisateur)
 */
const QuestionPersonnaliseeSchema = new mongoose.Schema({
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    typeQuestion: { 
        type: String, 
        enum: ['simple', 'avec_sous_questions', 'texte_libre'],
        default: 'simple'
    },
    typeEchelleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TypeEchelleReponse', default: null },
    commentaireObligatoire: { type: Boolean, default: false },
    ordre: { type: Number, default: 0 },
    sousQuestions: [SousQuestionPersonnaliseeSchema]
}, { _id: false });

/**
 * Question statique modifiée (remplacement d'une question statique)
 */
const QuestionModifieeSchema = new mongoose.Schema({
    questionOriginaleId: { type: String, required: true }, // code de la question statique
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    typeQuestion: { 
        type: String, 
        enum: ['simple', 'avec_sous_questions', 'texte_libre'],
        default: 'simple'
    },
    typeEchelleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TypeEchelleReponse', default: null },
    commentaireObligatoire: { type: Boolean, default: false },
    ordre: { type: Number, default: 0 },
    sousQuestions: [SousQuestionPersonnaliseeSchema]
}, { _id: false });

/**
 * Configuration d'une rubrique statique
 */
const RubriqueConfigSchema = new mongoose.Schema({
    rubriqueReference: { 
        type: String, 
        required: true,
        enum: ['PROFIL', 'ORGANISATION', 'CONTENU_PEDAGOGIQUE', 'APPRENTISSAGE']
    },
    // Personnalisation du titre
    titreFr: { type: String, default: '' },
    titreEn: { type: String, default: '' },
    // Activer/désactiver toute la rubrique
    estActive: { type: Boolean, default: true },
    // Ordre d'affichage personnalisé
    ordre: { type: Number, default: 0 },
    
    // ✅ Questions personnalisées ajoutées par l'utilisateur
    questionsPersonnalisees: [QuestionPersonnaliseeSchema],
    
    // ✅ Questions statiques supprimées (IDs/codes)
    questionsSupprimees: [{ type: String }],
    
    // ✅ Questions statiques modifiées (remplacement)
    questionsModifiees: [QuestionModifieeSchema]
}, { _id: false });

/**
 * Objectif personnalisé
 */
const ObjectifPersonnaliseSchema = new mongoose.Schema({
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    ordre: { type: Number, default: 0 }
}, { _id: false });

/**
 * Configuration des objectifs (rubriques 3.2 et 3.3)
 */
const ObjectifsConfigSchema = new mongoose.Schema({
    estActive: { type: Boolean, default: true },
    personnalisationAutorisee: { type: Boolean, default: true },
    objectifsPersonnalises: [ObjectifPersonnaliseSchema],
    objectifsSupprimes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Objectif' }],
    objectifsPersonnalisesSupprimes: [{ type: String }]
}, { _id: false });

/**
 * Configuration personnalisée complète d'une évaluation à chaud
 */
const TemplateConfigSchema = new mongoose.Schema({
    // Référence à l'évaluation concernée
    evaluationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'EvaluationAChaud', 
        required: true,
        unique: true
    },
    
    // Configuration des rubriques statiques
    rubriquesConfig: [RubriqueConfigSchema],
    
    // Configuration des objectifs
    objectifsConfig: { type: ObjectifsConfigSchema, default: () => ({}) },
    
    // Version de la configuration (pour suivi)
    version: { type: Number, default: 1 }
    
}, { timestamps: true });

// Index pour faciliter les recherches
TemplateConfigSchema.index({ evaluationId: 1 });

const TemplateConfig = mongoose.model('TemplateConfig', TemplateConfigSchema);
export default TemplateConfig;