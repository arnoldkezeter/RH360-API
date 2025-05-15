// models/Competence.js
import mongoose from 'mongoose';

const competenceSchema = new mongoose.Schema({
  code: { type: String, required: true },
  nom: { type: String, required: true },
  description: String,
  familleMetier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilleMetier',
    required: true
  }
}, { timestamps: true });

const Competence = mongoose.model('Competence', competenceSchema);
export default Competence;