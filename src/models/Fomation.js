// models/Formation.js
import mongoose from 'mongoose';

const formationSchema = new mongoose.Schema({
    titreFr: {type:String, required:true},
    titreEn: {type:String, required:true},
    descriptionFr:{type:String},
    descriptionEn:{type:String},
    familleMetier:[{type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier'}],
    axeStrategique:{type: mongoose.Schema.Types.ObjectId, ref: 'AxeStrategique', required: true},
    programmeFormation:{type: mongoose.Schema.Types.ObjectId, ref: 'ProgrammeFormation', required:true}
}, { timestamps: true });

const Formation = mongoose.model('Formation', formationSchema);
export default Formation;