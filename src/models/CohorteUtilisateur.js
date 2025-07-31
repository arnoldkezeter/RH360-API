// models/CohorteUtilisateur.js
import mongoose from 'mongoose';

const cohorteUtilisateurSchema = new mongoose.Schema({
    utilisateur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
    cohorte: {type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte',required: true},
    dateAjout: {type: Date, default: Date.now}
}, { timestamps: true });

cohorteUtilisateurSchema.index({ utilisateur: 1, cohorte: 1 });

export const CohorteUtilisateur = mongoose.model('CohorteUtilisateur', cohorteUtilisateurSchema);
