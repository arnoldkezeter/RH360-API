// models/NoteService.js
import mongoose from 'mongoose';

const noteServiceSchema = new mongoose.Schema({
    reference:{type:String, required:true},
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'},
    typeNote: {type:String, enum:["convocation", "acceptation_stage", "mandat"]},
    titreFr:{type:String},
    titreEn:{type:String},
    participants: [{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'}],
    stagiaires: [{type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire'}],
    responsables: [{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'}],
    copieA: [String],
    fichierJoint :  {type:String},// note signée scannée
    creePar:[{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'}],
    valideParDG: {type:Boolean}
}, { timestamps: true });

const NoteService = mongoose.model('NoteService', noteServiceSchema);
export default NoteService;