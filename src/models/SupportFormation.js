// models/SupportFormation.js
import mongoose from 'mongoose';

const supportFormationSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  fichier: { type: String}, // Chemin ou URL du fichier
  taille:{type:Number},
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true}
}, { timestamps: true });

const SupportFormation = mongoose.model('SupportFormation', supportFormationSchema);
export default SupportFormation;