// models/CarnetStage.js
import mongoose from 'mongoose';

const carnetStageSchema = new mongoose.Schema({
  stagiaire:{type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire'},
  tâches:[
    {tache:{type:String},
    etat:{type: Number, enum:[0, 1, 2]},
    dateConcernee:{type:Date}}],
}, { timestamps: true });

const CarnetStage = mongoose.model('CarnetStage', carnetStageSchema);
export default CarnetStage;