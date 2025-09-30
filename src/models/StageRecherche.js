// models/StageRecherche.js

import mongoose from 'mongoose';

const StageRechercheSchema = new mongoose.Schema({
    nomFr:{type:String, required: true},
    nomEn:{type:String, required: true},
    chercheur: {type: mongoose.Schema.Types.ObjectId, ref: 'Chercheur', required: true,},
    statut: {type: String,enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE'], default: 'EN_ATTENTE'},
    superviseur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
    dateDebut: {type: Date},
    dateFin: {type: Date},
    anneeStage: { type: Number, required: true },
    noteService:{type:String},
}, { timestamps: true }); // Inclut createdAt et updatedAt automatiquement

StageRechercheSchema.index({ chercheur: 1 });
StageRechercheSchema.index({ statut: 1 });

const StageRecherche = mongoose.model('StageRecherche', StageRechercheSchema);
export default StageRecherche;
