// models/Groupe.js
import mongoose from 'mongoose';

const groupeSchema = new mongoose.Schema({
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
    numero: { type: Number, required: true },
    stagiaires: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required: true }],
    serviceFinal: {
        service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: false },
        superviseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: false },
        dateDebut: { type: Date, required: false },
        dateFin: { type: Date, required: false },
    },
}, { timestamps: true });

// Index pour optimiser les recherches par stagiaires
groupeSchema.index({ stagiaires: 1 });

export const Groupe = mongoose.model('Groupe', groupeSchema);


