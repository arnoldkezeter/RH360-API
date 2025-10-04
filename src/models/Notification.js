// models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    destinataire: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Utilisateur', 
        required: true
    },
    type: {
        type: String,
        enum: [
            // Types existants pour les tâches
            'TACHE_STATUT_CHANGE', 
            'TACHE_EXECUTEE', 
            'TACHE_EN_RETARD',
            // Nouveaux types pour les chats
            'CHAT_CREE',
            'CHAT_NOUVEAU_MESSAGE',
            'CHAT_PARTICIPANT_AJOUTE',
            'CHAT_PARTICIPANT_RETIRE',
            'CHAT_PERMISSIONS_MODIFIEES',
            'CHAT_DESACTIVE'
        ],
        required: true
    },
    titre: {
        fr: { type: String, required: true },
        en: { type: String, required: true }
    },
    message: {
        fr: { type: String, required: true },
        en: { type: String, required: true }
    },
    donnees: {
        // Données existantes pour les tâches
        tacheId: mongoose.Schema.Types.ObjectId,
        themeId: mongoose.Schema.Types.ObjectId,
        ancienStatut: String,
        nouveauStatut: String,
        modifiePar: mongoose.Schema.Types.ObjectId,
        
        // Nouvelles données pour les chats
        chatId: mongoose.Schema.Types.ObjectId,
        chatTitle: String,
        messageId: mongoose.Schema.Types.ObjectId,
        messageContent: String,
        senderId: mongoose.Schema.Types.ObjectId,
        senderNom: String,
        senderPrenom: String,
        entityType: String,
        entityId: mongoose.Schema.Types.ObjectId,
        addedBy: mongoose.Schema.Types.ObjectId,
        removedBy: mongoose.Schema.Types.ObjectId,
        deactivatedBy: mongoose.Schema.Types.ObjectId,
        createrId: mongoose.Schema.Types.ObjectId,
        permissions: {
            canAddParticipants: Boolean,
            canRemoveParticipants: Boolean,
            canSendMessages: Boolean
        }
    },
    lue: {
        type: Boolean, 
        default: false
    },
    dateCreation: {
        type: Date, 
        default: Date.now
    },
    dateLecture: Date
}, {
    timestamps: true
});

// Index pour optimiser les requêtes
notificationSchema.index({ destinataire: 1, lue: 1, dateCreation: -1 });
notificationSchema.index({ 'donnees.chatId': 1 });
notificationSchema.index({ type: 1, dateCreation: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);