// models/EvaluationAChaudReponse.js
import mongoose from 'mongoose';

const SousQuestionReponseSchema = new mongoose.Schema({
    sousQuestionId:  { type: mongoose.Schema.Types.ObjectId, required: true },
    reponseEchelleId:{ type: mongoose.Schema.Types.ObjectId, ref: 'EchelleReponse', required: true },
    commentaire:     { type: String, default: '' },
}, { _id: false });

const QuestionReponseSchema = new mongoose.Schema({
    questionId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    reponseEchelleId: { type: mongoose.Schema.Types.ObjectId, ref: 'EchelleReponse' }, // si pas de sous-question
    sousQuestions:    [SousQuestionReponseSchema],
    commentaireGlobal:{ type: String, default: '' },
}, { _id: false });

const RubriqueReponseSchema = new mongoose.Schema({
    rubriqueId:{ type: mongoose.Schema.Types.ObjectId, required: true },
    questions: [QuestionReponseSchema],
}, { _id: false });

const EvaluationAChaudReponseSchema = new mongoose.Schema({
    utilisateur:      { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    modele:           { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationAChaud', required: true },
    rubriques:        [RubriqueReponseSchema],
    commentaireGeneral:{ type: String, default: '' },
    dateSoumission:   { type: Date },

    // Gestion brouillon / soumis
    statut: {
        type: String,
        enum: ['brouillon', 'soumis'],
        default: 'brouillon',
    },
    progression: { type: Number, default: 0, min: 0, max: 100 }, // %
}, { timestamps: true });

// Index pour éviter les doublons soumis (un utilisateur soumet une fois par évaluation)
EvaluationAChaudReponseSchema.index({ utilisateur: 1, modele: 1 });


const EvaluationAChaudReponse = mongoose.model('EvaluationAChaudReponse', EvaluationAChaudReponseSchema);
export default EvaluationAChaudReponse;