// models/QuestionnaireBesoin.js
import mongoose from 'mongoose';

const questionnaireSchema = new mongoose.Schema({
  titre: String,
  description: String,
  dateDebut: Date,
  dateFin: Date,
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  cible: {
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    famillesMetiers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier' }]
  }
}, { timestamps: true });

const QuestionnaireBesoin = mongoose.model('QuestionnaireBesoin', questionnaireSchema);
export default QuestionnaireBesoin;