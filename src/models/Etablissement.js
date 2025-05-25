// models/Etablissement.js
import mongoose from 'mongoose';

const etablissementSchema = new mongoose.Schema({
  nom: { type: String, required: true },
}, { timestamps: true });

const Etablissement = mongoose.model('Etablissement', etablissementSchema);
export default Etablissement;