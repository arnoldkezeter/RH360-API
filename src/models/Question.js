// models/Question.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  texte: String,
  type: {
    type: String,
    enum: ['texte', 'choix_multiple', 'choix_unique'],
    default: 'choix_unique'
  },
  options: [String],
  competenceLiee: { type: mongoose.Schema.Types.ObjectId, ref: 'Competence' }
}, { timestamps: true });

const Question = mongoose.model('Question', questionSchema);
export default Question;