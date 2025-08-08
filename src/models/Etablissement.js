// models/Etablissement.js
import mongoose from 'mongoose';

const etablissementSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String },
}, { timestamps: true });
etablissementSchema.index({ nomFr: 1 });
etablissementSchema.index({ nomEn: 1 });

const Etablissement = mongoose.model('Etablissement', etablissementSchema);
export default Etablissement;