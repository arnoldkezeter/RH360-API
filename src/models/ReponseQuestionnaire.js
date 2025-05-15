// models/ReponseQuestionnaire.js
import mongoose from 'mongoose';

const reponseSchema = new mongoose.Schema({
  questionnaire: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionnaireBesoin' },
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
  reponses: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    valeur: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

const ReponseQuestionnaire = mongoose.model('ReponseQuestionnaire', reponseSchema);
export default ReponseQuestionnaire;