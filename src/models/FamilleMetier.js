// models/FamilleMetier.js
import mongoose from 'mongoose';

const familleMetierSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String}
}, { timestamps: true });

const FamilleMetier = mongoose.model('FamilleMetier', familleMetierSchema);
export default FamilleMetier;