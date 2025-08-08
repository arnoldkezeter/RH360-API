// models/Groupe.js
import mongoose from 'mongoose';

const groupeSchema = new mongoose.Schema({
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
    numero: { type: Number, required: true },
    stagiaires: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required: true }],
}, { timestamps: true });

// Index pour optimiser les recherches par stagiaires
groupeSchema.index({ stage: 1 });

export const Groupe = mongoose.model('Groupe', groupeSchema);

