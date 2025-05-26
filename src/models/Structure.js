// models/Structure.js
import mongoose from 'mongoose';

const structureSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  chefStructure:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'}
}, { timestamps: true });

const Structure = mongoose.model('Structure', structureSchema);
export default Structure;