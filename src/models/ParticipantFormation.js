// models/ParticipantFormation.js
import mongoose from 'mongoose';

const participantFormationSchema = new mongoose.Schema({
    theme: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ThemeFormation', 
        required: true 
    },
    participant: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Utilisateur', 
        required: true 
    },
    // Structure de rattachement déduite au moment de la génération
    structure: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Structure',
        default: null
    },
    // Groupe auquel ce participant est affecté (null = pas encore affecté)
    groupe: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'GroupeFormation',
        default: null 
    },
    statut: { 
        type: String, 
        enum: ['EN_ATTENTE', 'AFFECTE', 'PRESENT', 'ABSENT'], 
        default: 'EN_ATTENTE' 
    },
    ajoutManuellement: { type: Boolean, default: false },
    ajoutePar: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Utilisateur', 
        default: null 
    },
}, { timestamps: true });

participantFormationSchema.index({ theme: 1, participant: 1 }, { unique: true });
participantFormationSchema.index({ theme: 1, structure: 1 });
participantFormationSchema.index({ groupe: 1 });

export const ParticipantFormation = mongoose.model('ParticipantFormation', participantFormationSchema);