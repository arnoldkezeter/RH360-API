// models/Structure.js
import mongoose from 'mongoose';

const structureSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  chefStructure:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'}
}, { timestamps: true });

const Structure = mongoose.model('Structure', structureSchema);
export default Structure;