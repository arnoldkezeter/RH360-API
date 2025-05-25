// models/CategorieProfessionnelle.js
import mongoose from 'mongoose';

const categorieProfessionnelleSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type : String},
  grade:{ type: mongoose.Schema.Types.ObjectId, ref: 'Grade' }
}, { timestamps: true });

const CategorieProfessionnelle = mongoose.model('CategorieProfessionnelle', categorieProfessionnelleSchema);
export default CategorieProfessionnelle;