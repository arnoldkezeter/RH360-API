// models/ThemeFormation.js
import mongoose from 'mongoose';

const themeFormationSchema = new mongoose.Schema({
  titre: {type:String, required:true},
  publicCible: [{type: mongoose.Schema.Types.ObjectId, ref: 'PosteDeTravail'}],
  lieux: [{lieu:{type : String}, cohorte:{type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte'}}],
  dateDebut: {type : Date},
  dateFin: {type : Date},
  formateurs: [{formateur:{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }, interne:{type:Boolean}}],
  responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
  supports: [String],
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
}, { timestamps: true });

const ThemeFormation = mongoose.model('ThemeFormation', themeFormationSchema);
export default ThemeFormation;