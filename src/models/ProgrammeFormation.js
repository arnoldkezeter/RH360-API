// models/ProgrammeFormation.js
import mongoose from 'mongoose';

const programmeFormationSchema = new mongoose.Schema({
  titreFr: {type:String},
  titreEn: {type:String},
  annee: {type:Number, required:true},
  creePar:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
  formations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Formation' }],
  etat:{type:String, enum:['TERMINE', 'NON_TERMINEE']}
}, { timestamps: true });

const ProgrammeFormation = mongoose.model('ProgrammeFormation', programmeFormationSchema);
export default ProgrammeFormation;