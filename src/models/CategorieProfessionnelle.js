// models/CategorieProfessionnelle.js
import mongoose from 'mongoose';

const categorieProfessionnelleSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type : String},
  descriptionEn: {type : String},
  grades:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required:true }]
}, { timestamps: true });

const CategorieProfessionnelle = mongoose.model('CategorieProfessionnelle', categorieProfessionnelleSchema);
export default CategorieProfessionnelle;