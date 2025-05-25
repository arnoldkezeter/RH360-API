// models/EvaluationAChaud.js
import mongoose from 'mongoose';

const evaluationAChaudSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation' },
  rubriques: [{
    titre,
    questions: [{
      type: { type: String, enum: ['qcm', 'vrai_faux', 'echelle', 'commentaire'] },
      question: { type: String },
      options: [String]
    }]
  }]
}, { timestamps: true });

const EvaluationAChaud = mongoose.model('EvaluationAChaud', evaluationAChaudSchema);
export default EvaluationAChaud;