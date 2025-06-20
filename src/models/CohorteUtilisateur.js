// models/CohorteUtilisateur.js
import mongoose from 'mongoose';

const cohorteUtilisateurSchema = new mongoose.Schema({
    utilisateur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
    cohorte: {type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte',required: true},
    dateAjout: {type: Date, default: Date.now}
}, { timestamps: true });

export const CohorteUtilisateur = mongoose.model('CohorteUtilisateur', cohorteUtilisateurSchema);
