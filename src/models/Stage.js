// models/Stage.js
import mongoose from 'mongoose';

const stageSchema = new mongoose.Schema({
        typeStage: { type: String, enum: ['INDIVIDUEL', 'GROUPE'], required: true },
        stagiaires: [
            {
                stagiaire: { type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required: true },
                servicesAffectes: [
                    {
                        service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
                        annee: { type: Number, required: true },
                        dateDebut: { type: Date, required: true },
                        dateFin: { type: Date, required: true },
                        superviseurs: [
                            { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
                        ],
                    },
                ],
            },
        ],//Utilisé uniquement pour des stages individuels
        noteService: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteService' },
        statut: {
            type: String,
            enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE'],
            required: true,
        },
    },
    { timestamps: true }
);

// Index pertinent pour les recherches fréquentes
stageSchema.index({ typeStage: 1, statut: 1 });

const Stage = mongoose.model('Stage', stageSchema);
export default Stage;
