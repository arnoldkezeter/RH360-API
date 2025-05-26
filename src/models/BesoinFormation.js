// models/BesoinFormation.js
import mongoose from 'mongoose';

const besoinFormationSchema = new mongoose.Schema({
  competence: { type: mongoose.Schema.Types.ObjectId, ref: 'Competence' },
  familleMetier: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier' },
  annee: {type:Number},
  priorite: { type: String, enum: ['Haute', 'Moyenne', 'Basse'], default: 'Moyenne' },
  source: { type: String, enum: ['SONDAGE', 'MANUEL'], default: 'SONDAGE' },
  nbDemandes: {type:Number}
}, { timestamps: true });

const BesoinFormation = mongoose.model('BesoinFormation', besoinFormationSchema);
export default BesoinFormation;