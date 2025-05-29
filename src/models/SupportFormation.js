// models/SupportFormation.js
import mongoose from 'mongoose';

const supportFormationSchema = new mongoose.Schema({
  titreFr: { type: String, required: true },
  titreEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  fichier: { type: String}, // Chemin ou URL du fichier
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true}
}, { timestamps: true });

const SupportFormation = mongoose.model('SupportFormation', supportFormationSchema);
export default SupportFormation;