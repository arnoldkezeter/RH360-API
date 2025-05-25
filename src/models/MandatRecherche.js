// models/MandatRecherche.js
import mongoose from 'mongoose';

const mandatRechercheSchema = new mongoose.Schema({
    annee:{type:Number},
    mandate:{type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required:true},
    theme:{type:String, required:true},
    noteService:{type: mongoose.Schema.Types.ObjectId, ref: 'NoteService', required:true},
    structureAffecte:{type: mongoose.Schema.Types.ObjectId, ref: 'Structure', required:true},
    superviseur:[{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required:true}],
    statut:{type:String, enum:['EN_ATTENTE', 'ACCEPTE', 'REFUSE'], required: true}
}, { timestamps: true });

const MandatRecherche = mongoose.model('MandatRecherche', mandatRechercheSchema);
export default MandatRecherche;
