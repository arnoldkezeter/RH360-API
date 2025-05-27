// models/Etablissement.js
import mongoose from 'mongoose';

const etablissementSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String },
}, { timestamps: true });

const Etablissement = mongoose.model('Etablissement', etablissementSchema);
export default Etablissement;