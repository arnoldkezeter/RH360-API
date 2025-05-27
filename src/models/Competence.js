// models/Competence.js
import mongoose from 'mongoose';

const competenceSchema = new mongoose.Schema({
  code: { type: String, required: true },
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  familleMetier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilleMetier',
    required: true
  }
}, { timestamps: true });

const Competence = mongoose.model('Competence', competenceSchema);
export default Competence;