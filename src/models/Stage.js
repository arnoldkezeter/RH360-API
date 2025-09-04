// models/Stage.js
import mongoose from 'mongoose';

const StageSchema = new mongoose.Schema({
    nomFr:{type:String, required: true},
    nomEn:{type:String, required: true},
    type: { type: String, enum: ["INDIVIDUEL", "GROUPE"], required: true },
    stagiaire: { type: mongoose.Schema.Types.ObjectId, ref: "Stagiaire" }, // si individuel
    groupes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Groupe" }], // si groupe

    dateDebut: { type: Date, required: true },
    dateFin: { type: Date, required: true },
    anneeStage: { type: Number, required: true },
    noteService: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteService' },
    statut: {type: String,enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE'],required: true,},
},{ timestamps: true });

// Index pertinent pour les recherches fréquentes
StageSchema.index({ type: 1, anneeStage: 1, statut: 1 });
StageSchema.index({ dateDebut: 1, dateFin: 1 });

const Stage = mongoose.model('Stage', StageSchema);
export default Stage;
