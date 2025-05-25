// models/Formation.js
import mongoose from 'mongoose';

const formationSchema = new mongoose.Schema({
  titre: {type:String, required:true},
  description:{type:String},
  axeStrategique:{type: mongoose.Schema.Types.ObjectId, ref: 'AxeStrategique'},
  programmeFormation:{type: mongoose.Schema.Types.ObjectId, ref: 'ProgrammeFormation'}
}, { timestamps: true });

const Formation = mongoose.model('Formation', formationSchema);
export default Formation;