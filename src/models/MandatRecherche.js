// models/MandatRecherche.js

import mongoose from 'mongoose';

const MandatRechercheSchema = new mongoose.Schema({
    chercheur: {type: mongoose.Schema.Types.ObjectId, ref: 'Chercheur', required: true,},
    statut: {type: String,enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE'], default: 'EN_ATTENTE'},
    superviseur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
    structure: {type: mongoose.Schema.Types.ObjectId, ref: 'Structure', required: true},
    dateDebut: {type: Date},
    dateFin: {type: Date},
    noteService:{type: mongoose.Schema.Types.ObjectId, ref: 'NoteService'},
}, { timestamps: true }); // Inclut createdAt et updatedAt automatiquement

MandatRechercheSchema.index({ chercheur: 1 });
MandatRechercheSchema.index({ structure: 1 });
MandatRechercheSchema.index({ statut: 1 });

const MandatRecherche = mongoose.model('MandatRecherche', MandatRechercheSchema);
export default MandatRecherche;
