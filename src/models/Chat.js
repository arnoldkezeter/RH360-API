// models/Chat.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
    content: {type: String, required: true, trim: true},
    timestamp: {type: Date, default: Date.now},
    isRead: [{
            user: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
            readAt: {type: Date, default: Date.now}
        }],
    messageType: {type: String, enum: ['text', 'file', 'system'], default: 'text' }
});

const chatSchema = new mongoose.Schema({
    // Référence générique vers n'importe quelle collection
    entityType: {type: String, required: true, enum: ['TacheExecutee', 'Project', 'Order', 'Support']}, // Ajoutez selon vos besoins
    entityId: {type: mongoose.Schema.Types.ObjectId, required: true},
    
    // Créateur du chat
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
    
    // Titre personnalisé du chat (optionnel)
    title: {type: String, trim: true},
    
    // Type de chat
    chatType: {type: String, enum: ['general', 'private', 'group'], default: 'general'},
    
    // Participants du chat
    participants: [{
        user: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true},
        role: {type: String, required: true},
        joinedAt: {type: Date,default: Date.now},
        addedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
        // Permissions spécifiques du participant
        permissions: {
            canAddParticipants: {type: Boolean,default: false},
            canRemoveParticipants: {type: Boolean,default: false},
            canSendMessages: { type: Boolean, default: true}
        }
    }],
    
    // Messages
    messages: [messageSchema],
    
    // Métadonnées
    isActive: {type: Boolean,default: true},
    lastActivity: {type: Date,default: Date.now},
    
    // Paramètres du chat
    settings: {
        allowFileUpload: {type: Boolean, default: true},
        maxParticipants: {type: Number, default: 50}
    }
    }, {timestamps: true}
);

// Index composé pour optimiser les requêtes
chatSchema.index({ entityType: 1, entityId: 1 });
chatSchema.index({ 'participants.user': 1 });
chatSchema.index({ lastActivity: -1 });

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;