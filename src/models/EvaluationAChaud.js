// models/EvaluationAChaud.js
import mongoose from 'mongoose';

const SousQuestionSchema = new mongoose.Schema({
    code: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    commentaireObligatoire: { type: Boolean, default: false },
    ordre: { type: Number, required: true },
}, { _id: true });

const EchelleSnapshotSchema = new mongoose.Schema({
    _id:    { type: mongoose.Schema.Types.ObjectId },
    nomFr:  { type: String, required: true },
    nomEn:  { type: String, default: '' },
    ordre:  { type: Number, required: true },
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
    code: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    
    // Type de question
    type: { 
        type: String, 
        enum: ['simple', 'avec_sous_questions', 'texte_libre', 'objectifs_comprehension', 'objectifs_atteinte'],
        default: 'simple'
    },
    
    // ✅ NOUVEAU : Référence vers TypeEchelleReponse (au lieu de EchelleReponse)
    typeEchelle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'TypeEchelleReponse',
        default: null
    },

    echelles: [EchelleSnapshotSchema],
    
    // ⚠️ À conserver uniquement pour les échelles personnalisées (cas exceptionnel)
    echellesPersonnalisees: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'EchelleReponse' 
    }],
    
    // Pour les questions avec sous-questions intégrées (ex: Genre)
    sousQuestions: [SousQuestionSchema],
    commentaireGlobal: { type: Boolean, default: false },
    ordre: { type: Number, required: true },
    
}, { _id: true });

const RubriqueSchema = new mongoose.Schema({
    code: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    titreFr: { type: String, required: true },
    titreEn: { type: String, default: '' },
    ordre: { type: Number, required: true },
    questions: [QuestionSchema],
}, { _id: true });

// ─── Schéma principal ─────────────────────────────────────────────────────────
const EvaluationAChaudSchema = new mongoose.Schema({
    titreFr: { type: String, required: true },
    titreEn: { type: String, default: '' },
    theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true },
    descriptionFr: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    dateFormation: { type: Date },
    creePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },

    /**
     * Versionnage des objectifs (capture au moment de la création)
     * Utile pour l'historique même si les objectifs changent plus tard
     */
    objectifsVersionnes: [{
        code: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        libelleFr: String,
        libelleEn: String,
        ordre: Number
    }],

    /**
     * Tableau complet des rubriques
     */
    rubriques: [RubriqueSchema],

    /**
     * Référence vers la configuration personnalisée
     */
    templateConfig: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateConfig' },

    /**
     * Version du template
     */
    version: { type: Number, default: 1 },

    actif: { type: Boolean, default: true },
}, { timestamps: true });

// Index
EvaluationAChaudSchema.index({ theme: 1, actif: 1 });
EvaluationAChaudSchema.index({ dateFormation: -1 });

const EvaluationAChaud = mongoose.model('EvaluationAChaud', EvaluationAChaudSchema);
export default EvaluationAChaud;