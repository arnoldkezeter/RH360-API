// models/ProgrammeFormation.js
import mongoose from 'mongoose';

const programmeFormationSchema = new mongoose.Schema({
  titreFr: {type:String},
  titreEn: {type:String},
  annee: {type:Number, required:true},
  creePar:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
}, { timestamps: true });

const ProgrammeFormation = mongoose.model('ProgrammeFormation', programmeFormationSchema);
export default ProgrammeFormation;