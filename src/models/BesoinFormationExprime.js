// models/BesoinFormationExprime.js
import mongoose from 'mongoose';

const besoinFormationExprimeSchema = new mongoose.Schema({
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    besoin: { type: mongoose.Schema.Types.ObjectId, ref: 'BesoinFormationExprime', required: true },
    commentaire: { type: String },
    priorite: { type: String, enum: ['Faible', 'Moyenne', 'Haute'], default: 'Moyenne' },
    statut: { type: String, enum: ['En attente', 'Validé', 'Rejeté'], default: 'En attente' },
    dateSoumission: { type: Date, default: Date.now },
    dateValidation: { type: Date },
    validePar: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' } // administrateur
}, { timestamps: true });

const BesoinFormationExprime = mongoose.model('BesoinFormationExprime', besoinFormationExprimeSchema);
export default BesoinFormationExprime;
