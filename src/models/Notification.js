import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    destinataire: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
    type: {type: String,enum: ['TACHE_STATUT_CHANGE', 'TACHE_EXECUTEE', 'TACHE_EN_RETARD'],required: true},
    titre: {fr: { type: String, required: true },en: { type: String, required: true }},
    message: {fr: { type: String, required: true },en: { type: String, required: true }},
    donnees: {
        tacheId: mongoose.Schema.Types.ObjectId,
        themeId: mongoose.Schema.Types.ObjectId,
        ancienStatut: String,
        nouveauStatut: String,
        modifiePar: mongoose.Schema.Types.ObjectId
    },
    lue: {type: Boolean, default: false},
    dateCreation: {type: Date, default: Date.now},
    dateLecture: Date
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
notificationSchema.index({ destinataire: 1, lue: 1, dateCreation: -1 });
export const Notification = mongoose.model('Notification', notificationSchema);
