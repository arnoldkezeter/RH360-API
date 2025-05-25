// models/Stage.js
import mongoose from 'mongoose';

const stageSchema = new mongoose.Schema({
    annee:{type:Number},
    stagiaire:{type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required:true},
    noteService:{type: mongoose.Schema.Types.ObjectId, ref: 'NoteService', required:true},
    servicesAffectes:[{
        dateDebut:{type:Date},
        dateFin:{type:Date},
        serviceAffecte:{type: mongoose.Schema.Types.ObjectId, ref: 'Service', required:true},
        superviseur:[{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required:true}],
    }],
    
    statut:{type:String, enum:['EN_ATTENTE', 'ACCEPTE', 'REFUSE'], required: true}
}, { timestamps: true });

const Stage = mongoose.model('Stage', stageSchema);
export default Stage;
