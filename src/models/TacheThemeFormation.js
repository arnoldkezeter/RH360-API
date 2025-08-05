// models/TacheFormation.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const TacheThemeFormationSchema = new Schema({
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true},
    tache: {type: mongoose.Schema.Types.ObjectId, ref: 'TacheGenerique', required: true},
    dateDebut: {type: Date },
    dateFin: {type: Date},
    estExecutee: {type: Boolean, default: false},
    fichierJoint: {type: String},
    donnees: {type: Schema.Types.Mixed}, // Pour stocker des données personnalisées (budget, uploads, etc.)
    dateExecution: {type: Date},
    responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }, // Celui qui exécute
    statut: {type: String, enum: ['EN_ATTENTE', 'EN_COURS', 'TERMINE'], default: 'EN_ATTENTE',},
    commentaires: {type:String},
}, {
  timestamps: true
});

// Évite de dupliquer une même tâche pour un même thème
TacheThemeFormationSchema.index({ theme: 1, tache: 1 }, { unique: true });

const TacheThemeFormation = mongoose.model('TacheThemeFormation', TacheThemeFormationSchema);
export default TacheThemeFormation;




