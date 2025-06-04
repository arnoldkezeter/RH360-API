// models/Rotation.js
import mongoose from 'mongoose';

const rotationSchema = new mongoose.Schema({
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    groupe: { type: mongoose.Schema.Types.ObjectId, ref: 'Groupe', required: true },
    superviseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    dateDebut: { type: Date, required: true },
    dateFin: { type: Date, required: true },
}, { timestamps: true });

// Index pour éviter les conflits de services
rotationSchema.index(
    { service: 1, dateDebut: 1, dateFin: 1 },
    { unique: true, partialFilterExpression: { service: { $exists: true } } }
);

export const Rotation = mongoose.model('Rotation', rotationSchema);
