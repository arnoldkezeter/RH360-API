// models/EvaluationFormateur.js
import mongoose from 'mongoose';

const evaluationFormateurSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation' },
  notes: [{
    participant:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
    moyenne:{type:Number}
  }]
}, { timestamps: true });

const EvaluationFormateur = mongoose.model('EvaluationFormateur', evaluationFormateurSchema);
export default EvaluationFormateur;