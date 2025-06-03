import mongoose from 'mongoose';

const SousQuestionReponseSchema = new mongoose.Schema({
  sousQuestionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reponseEchelleId: { type: mongoose.Schema.Types.ObjectId, required: true },
  commentaire: { type: String }
}, { _id: false });

const QuestionReponseSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reponseEchelleId: { type: mongoose.Schema.Types.ObjectId }, // si pas de sous-question
  sousReponses: [SousQuestionReponseSchema],
  commentaireGlobal: { type: String }
}, { _id: false });

const RubriqueReponseSchema = new mongoose.Schema({
  rubriqueId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questions: [QuestionReponseSchema]
}, { _id: false });

const EvaluationAChaudReponseSchema = new mongoose.Schema({
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  modele: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationAChaud', required: true },
  rubriques: [RubriqueReponseSchema],
  commentaireGeneral: { type: String },
  dateSoumission: { type: Date, default: Date.now }
}, { timestamps: true });

const EvaluationAChaudReponse = mongoose.model('EvaluationAChaudReponse', EvaluationAChaudReponseSchema);
export default EvaluationAChaudReponse;
