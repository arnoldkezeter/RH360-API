// models/FamilleMetier.js
import mongoose from 'mongoose';

const familleMetierSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: String
}, { timestamps: true });

const FamilleMetier = mongoose.model('FamilleMetier', familleMetierSchema);
export default FamilleMetier;



