// models/LieuFormation.js
import mongoose from 'mongoose';

const participantFormationSchema = new mongoose.Schema({
    theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    statut: { type: String, enum: ['INSCRIT', 'PRESENT', 'ABSENT'], default: 'INSCRIT' }

}, { timestamps: true });

export const ParticipantFormation = mongoose.model('ParticipantFormation', participantFormationSchema);
