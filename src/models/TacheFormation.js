// models/TacheFormation.js
import mongoose from 'mongoose';

const tacheFormationSchema = new mongoose.Schema({
  titreFr: { type: String, required: true },
  titreEn: { type: String, required: true },
  formations:[
    {formation:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'},
    etat: { type: String, enum: ['NON_TERMINEE', 'TERMINEE'], default: 'NON_TERMINEE' }}],
}, { timestamps: true });

const TacheFormation = mongoose.model('TacheFormation', tacheFormationSchema);
export default TacheFormation;