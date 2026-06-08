// models/GroupeFormation.js
import mongoose from 'mongoose';

const groupeFormationSchema = new mongoose.Schema({
    theme: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ThemeFormation', 
        required: true 
    },
    // Structure d'origine (peut être null si fusion entre structures)
    structure: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Structure',
        default: null
    },
    // Numéro d'affichage ex: "Groupe 2 - Direction Yaoundé"
    numeroGroupe: { type: Number, required: true },
    
    // Configuré groupe par groupe par le responsable
    lieu: { type: String, default: null },
    formateurs: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Formateur' 
    }],
    dateDebut: { type: Date, default: null },
    dateFin: { type: Date, default: null },
    
    statut: { 
        type: String, 
        enum: ['BROUILLON', 'PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE'], 
        default: 'BROUILLON'  // BROUILLON tant que lieu/dates non renseignés
    },
}, { timestamps: true });

groupeFormationSchema.index({ theme: 1, structure: 1 });

export const GroupeFormation = mongoose.model('GroupeFormation', groupeFormationSchema);