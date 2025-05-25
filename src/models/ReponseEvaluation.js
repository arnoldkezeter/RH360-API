// models/ReponseEvaluation.js
import mongoose from 'mongoose';

const reponseEvaluationSchema = new mongoose.Schema({
  evaluation: {type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationAChaud'},
  participant: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
  reponses: [{
    questionId: { type: mongoose.Schema.Types.ObjectId },
    reponse: mongoose.Schema.Types.Mixed,
    commentaire: { type: String }
  }]
}, { timestamps: true });

const ReponseEvaluation = mongoose.model('ReponseEvaluation', reponseEvaluationSchema);
export default ReponseEvaluation;