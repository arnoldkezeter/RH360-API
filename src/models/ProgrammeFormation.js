// models/ProgrammeFormation.js
import mongoose from 'mongoose';

const programmeFormationSchema = new mongoose.Schema({
  titre: {type:String},
  annee: {type:Number, required:true},
  creePar:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
  formations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Formation' }]
}, { timestamps: true });

const ProgrammeFormation = mongoose.model('ProgrammeFormation', programmeFormationSchema);
export default ProgrammeFormation;