// controllers/ChatController.js
import Chat from '../models/Chat.js';
import Utilisateur from '../models/Utilisateur.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import TacheThemeFormation from '../models/TacheThemeFormation.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { getIO } from '../utils/socket.js';
import { 
    notifierCreationChat,
  notifierAjoutParticipants,
  notifierRetraitParticipants,
  notifierNouveauMessage,
  notifierModificationPermissions,
  notifierDesactivationChat
} from '../services/chatServiceNotification.js';


// ✅ Vérifie si l'utilisateur a un des rôles requis dans sa liste de rôles
const hasRequiredRole = (user, requiredRoles) => {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;
  return user.roles.some(role => requiredRoles.includes(role.toUpperCase()));
};

// ✅ Vérifie si l'utilisateur est responsable du thème de formation
const isResponsableTheme = async (userId, entityId, entityType) => {
  if (entityType !== 'ThemeFormation') return false;
  
  const theme = await ThemeFormation.findById(entityId).select('responsable').lean();
  if (!theme) return false;
  
  return theme.responsable.toString() === userId.toString();
};

// ✅ Vérifie si l'utilisateur peut gérer le chat
const canManageChat = async (user, entityId, entityType) => {
  if (hasRequiredRole(user, ['SUPER-ADMIN', 'ADMIN', 'RESPONSABLE-FORMATION'])) {
    return true;
  }
  
  if (await isResponsableTheme(user._id, entityId, entityType)) {
    return true;
  }
  
  return false;
};

// Créer un nouveau chat avec participants sélectionnés
export const createChat = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
      errors: errors.array().map(err => err.msg),
    });
  }

  try {
    const { entityType, entityId, participants, title, chatType = 'general' } = req.body;
    const { creatorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(creatorId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const creator = await Utilisateur.findById(creatorId).select('_id roles nom prenom').lean();
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang),
      });
    }

    const canCreate = await canManageChat(creator, entityId, entityType);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }

    let participantIds = participants.map(p => p.userId);
    const existingUsers = await Utilisateur.find({ _id: { $in: participantIds } })
      .select('_id nom prenom email role roles')
      .lean();

    const chatParticipants = participants.map(p => {
      const user = existingUsers.find(u => u._id.toString() === p.userId.toString());
      if (!user) return null;

      const canManage = hasRequiredRole(user, ['SUPER-ADMIN', 'ADMIN', 'RESPONSABLE-FORMATION']);
      
      return {
        user: user._id,
        role: user.role.toUpperCase(),
        addedBy: creatorId,
        permissions: p.permissions || {
          canAddParticipants: canManage,
          canRemoveParticipants: canManage,
          canSendMessages: true,
        },
      };
    }).filter(p => p !== null);

    const chat = new Chat({
      entityType,
      entityId,
      createdBy: creatorId,
      title,
      chatType,
      participants: chatParticipants
    });
    
    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'nom prenom email role roles')
      .populate('createdBy', 'nom prenom email');

    // 🔔 Notifier les participants
    await notifierCreationChat({
      chat: populatedChat,
      participants: chatParticipants,
      createur: creatorId
    });

    // 📡 Émettre l'événement Socket.IO
    const io = getIO();
    chatParticipants.forEach(p => {
      if (p.user.toString() !== creatorId.toString()) {
        io.to(`user_${p.user}`).emit('chat_created', {
          chat: populatedChat
        });
      }
    });

    return res.status(201).json({
      success: true,
      message: t('ajouter_succes', lang),
      data: populatedChat,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Récupérer tous les chats de l'utilisateur
export const getUtilisateurChats = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const { entityType } = req.query;
    const { userId } = req.params;

    const query = {
      'participants.user': userId,
      isActive: true
    };

    if (entityType) {
      query.entityType = entityType;
    }

    const chats = await Chat.find(query)
      .populate('participants.user', 'nom prenom email role roles')
      .populate('createdBy', 'nom prenom email')
      .sort({ lastActivity: -1 })
      .lean();

    const chatsWithDetails = chats.map(chat => {
      const transformedParticipants = (chat.participants || []).map(p => {
        if (p.user) {
          return {
            userId: p.user._id.toString(),
            nom: p.user.nom,
            prenom: p.user.prenom,
            email: p.user.email,
            role: p.user.role.toUpperCase(),
            permissions: p.permissions,
          };
        }
        return p;
      });
      
      const unreadCount = (chat.messages || []).filter(msg => 
        msg.sender.toString() !== userId.toString() &&
        !msg.isRead.some(r => r.user.toString() === userId.toString())
      ).length;
      
      const lastMessage = chat.messages && chat.messages.length > 0 
        ? chat.messages[chat.messages.length - 1] 
        : null;

      return {
        ...chat,
        participants: transformedParticipants,
        unreadCount,
        lastMessage,
      };
    });

    return res.status(200).json({
      success: true,
    //   message: t('recuperation_succes', lang),
      data: {
        chats: chatsWithDetails,
        currentPage: 1,
        totalPages: 1,
        totalItems: chatsWithDetails.length,
        pageSize: chatsWithDetails.length,
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Ajouter des participants à un chat existant
export const addParticipants = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
      errors: errors.array().map(err => err.msg),
    });
  }

  try {
    const { chatId, addedBy } = req.params;
    const { participants: newParticipantsData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const adder = await Utilisateur.findById(addedBy).select('_id roles nom prenom').lean();
    if (!adder) {
      return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang),
      });
    }

    const canAdd = await canManageChat(adder, chat.entityId, chat.entityType);
    if (!canAdd) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }
    
    const newParticipantIds = newParticipantsData.map(p => p.userId);
    const existingUtilisateurIds = chat.participants.map(p => p.user.toString());
    
    const usersToAdd = await Utilisateur.find({ 
      _id: { $in: newParticipantIds, $nin: existingUtilisateurIds } 
    }).select('_id nom prenom email role roles').lean();
    
    const chatDoc = await Chat.findById(chatId);
    
    usersToAdd.forEach(user => {
      const participantData = newParticipantsData.find(p => p.userId.toString() === user._id.toString());
      const canManage = hasRequiredRole(user, ['SUPER-ADMIN', 'ADMIN', 'RESPONSABLE-FORMATION']);
      
      chatDoc.participants.push({
        user: user._id,
        role: user.role.toUpperCase(),
        addedBy: addedBy,
        permissions: participantData?.permissions || {
          canAddParticipants: canManage,
          canRemoveParticipants: canManage,
          canSendMessages: true,
        },
      });
    });

    if (usersToAdd.length > 0) {
      chatDoc.lastActivity = new Date();
      
      const systemMessage = {
        sender: addedBy,
        content: t('participants_ajoutes', lang, { count: usersToAdd.length }),
        messageType: 'system',
        timestamp: new Date(),
      };
      chatDoc.messages.push(systemMessage);
      await chatDoc.save();

      // 🔔 Notifier les nouveaux participants
      await notifierAjoutParticipants({
        chatId,
        chatTitle: chat.title,
        nouveauxParticipants: usersToAdd,
        addedBy,
        entityType: chat.entityType,
        entityId: chat.entityId
      });
      
      const io = getIO();
      const roomName = `chat_${chatId}`;
      
      // Faire rejoindre les nouveaux participants à la room
      usersToAdd.forEach(user => {
        io.to(`user_${user._id}`).emit('added_to_chat', {
          chatId,
          chat: chatDoc,
          addedBy
        });
        // Simuler la jonction à la room (côté client devra gérer la jonction)
      });

      // Notifier les participants existants
      io.to(roomName).emit('participants_added', {
        chatId,
        newParticipants: usersToAdd,
        addedBy: addedBy,
        message: systemMessage,
      });
    }
    
    const populatedChat = await Chat.findById(chatDoc._id)
      .populate('participants.user', 'nom prenom email role roles')
      .lean();

    return res.status(200).json({
      success: true,
      message: t('participants_ajoutes_succes', lang),
      data: populatedChat,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Retirer des participants d'un chat
export const removeParticipants = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t('champs_obligatoires', lang),
      errors: errors.array().map(err => err.msg),
    });
  }

  try {
    const { chatId, removedBy } = req.params;
    const { participantIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const remover = await Utilisateur.findById(removedBy).select('_id roles').lean();
    if (!remover) {
      return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang),
      });
    }

    const canRemove = await canManageChat(remover, chat.entityId, chat.entityType);
    if (!canRemove) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }
    
    const chatDoc = await Chat.findById(chatId);
    const initialParticipantsCount = chatDoc.participants.length;

    chatDoc.participants = chatDoc.participants.filter(p => 
      !participantIds.includes(p.user.toString()) || p.user.toString() === chat.createdBy.toString()
    );

    const removedCount = initialParticipantsCount - chatDoc.participants.length;
    
    if (removedCount > 0) {
      chatDoc.lastActivity = new Date();
      
      const systemMessage = {
        sender: removedBy,
        content: t('participants_retires', lang, { count: removedCount }),
        messageType: 'system',
        timestamp: new Date(),
      };
      chatDoc.messages.push(systemMessage);
      await chatDoc.save();

      // 🔔 Notifier les participants retirés
      await notifierRetraitParticipants({
        chatId,
        chatTitle: chat.title,
        participantsRetires: participantIds,
        removedBy
      });
      
      const io = getIO();
      const roomName = `chat_${chatId}`;
      
      // Notifier les participants retirés
      participantIds.forEach(participantId => {
        io.to(`user_${participantId}`).emit('removed_from_chat', {
          chatId,
          removedBy
        });
      });

      // Notifier les participants restants
      io.to(roomName).emit('participants_removed', {
        chatId,
        removedParticipants: participantIds,
        removedBy: removedBy,
        message: systemMessage,
      });
    }
    
    const populatedChat = await Chat.findById(chatDoc._id)
      .populate('participants.user', 'nom prenom email role roles')
      .lean();

    return res.status(200).json({
      success: true,
      message: t('participants_retires_succes', lang),
      data: populatedChat,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};


// Récupérer les utilisateurs disponibles pour une entité
export const getAvailableParticipants = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const { entityType } = req.query;
    const { currentUtilisateurId, entityId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    let availableUsers = [];
    
    if (entityType === 'ThemeFormation') {
      const theme = await ThemeFormation.findById(entityId)
        .populate('responsable', '_id nom prenom email role roles')
        .populate('formateurs.formateur', '_id nom prenom email role roles')
        .lean();
      
      if (theme) {
        // Ajouter le responsable
        if (theme.responsable) {
          availableUsers.push(theme.responsable);
        }
        
        // Ajouter les formateurs
        theme.formateurs?.forEach(f => {
          if (f.formateur && !availableUsers.find(u => u._id.toString() === f.formateur._id.toString())) {
            availableUsers.push(f.formateur);
          }
        });
        
        // Ajouter les admins et super-admins
        const admins = await Utilisateur.find({
          roles: { $in: ['ADMIN', 'SUPER-ADMIN', 'RESPONSABLE-FORMATION'] },
          _id: { $ne: currentUtilisateurId },
          isActive: true
        }).select('_id nom prenom email role roles').lean();
        
        admins.forEach(admin => {
          if (!availableUsers.find(u => u._id.toString() === admin._id.toString())) {
            availableUsers.push(admin);
          }
        });
      }
    } else if (entityType === 'TacheExecutee') {
      const tache = await TacheThemeFormation.findById(entityId)
        .populate('responsable', '_id nom prenom email role roles')
        .lean();
      
      if (tache) {
        availableUsers = await Utilisateur.find({
          $or: [
            { _id: tache.responsable },
            { roles: { $in: ['ADMIN', 'SUPER-ADMIN', 'RESPONSABLE-FORMATION'] } },
          ],
          _id: { $ne: currentUtilisateurId },
          isActive: true
        }).select('_id nom prenom email role roles').lean();
      }
    } else {
      availableUsers = await Utilisateur.find({ 
        isActive: true, 
        _id: { $ne: currentUtilisateurId } 
      }).select('_id nom prenom email role roles').lean();
    }

    return res.status(200).json({
      success: true,
      message: t('recuperation_succes', lang),
      data: availableUsers,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Ajouter un message
export const addMessage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { chatId, senderId } = req.params;
        const { content, messageType = 'text' } = req.body;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: t('chat_non_trouve', lang),
            });
        }
        
        const participant = chat.participants.find(p => p.user.toString() === senderId.toString());
        
        if (!participant || !participant.permissions.canSendMessages) {
            return res.status(403).json({
                success: false,
                message: t('non_autorise', lang),
            });
        }
        
        const newMessage = {
            sender: senderId,
            content,
            messageType,
            timestamp: new Date(),
            isRead: [{ user: senderId, readAt: new Date() }]
        };
        
        // 1. Sauvegarder le message dans la BDD
        chat.messages.push(newMessage);
        chat.lastActivity = new Date();
        await chat.save();
        
        // 2. Préparer le message à envoyer via Socket.io et pour les notifications
        const savedMessage = chat.messages[chat.messages.length - 1]; // Récupérer le message avec son _id
        const senderUser = await Utilisateur.findById(senderId).select('nom prenom email').lean();
        
        const populatedMessage = {
            ...savedMessage.toObject(), // Utilisez .toObject() si newMessage était un sous-document Mongoose
            sender: senderUser
        };
        
        // 3. Émettre l'événement Socket.io (temps réel dans le chat)
        const io = getIO();
        const roomName = `chat_${chatId}`;
        io.to(roomName).emit('new_message', {
            chatId,
            message: populatedMessage,
            entityType: chat.entityType,
            entityId: chat.entityId,
        });

        // 4. Déclencher les notifications (BDD et temps réel NOTIF)
        await notifierNouveauMessage({
            chatId: chat._id, 
            chatTitle: chat.title, 
            message: savedMessage, 
            senderId: senderId, 
            senderNom: senderUser.nom,
            senderPrenom: senderUser.prenom,
            participants: chat.participants, // La liste des participants est déjà dans 'chat'
            entityType: chat.entityType,
            entityId: chat.entityId
        });

        return res.status(201).json({
            success: true,
            data: populatedMessage,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Marquer messages comme lus
export const markMessagesAsRead = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const { chatId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const isParticipant = chat.participants.some(p => p.user.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: t('non_autorise', lang),
      });
    }
    
    chat.messages.forEach(message => {
      if (message.sender.toString() !== userId.toString()) {
        const existingRead = message.isRead.find(r => r.user.toString() === userId.toString());
        if (!existingRead) {
          message.isRead.push({ user: new mongoose.Types.ObjectId(userId), readAt: new Date() });
        }
      }
    });
    
    await chat.save();
    
    const io = getIO();
    const roomName = `chat_${chatId}`;
    io.to(roomName).emit('messages_read', {
      chatId,
      userId,
      readAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: t('messages_marques_lus', lang),
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Récupérer les messages d'un chat
export const getChatMessages = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const { chatId, userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('participants.user', 'nom prenom email role roles')
      .populate('messages.sender', 'nom prenom email')
      .lean();
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const isParticipant = chat.participants.some(p => p.user && p.user._id.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: t('non_autorise', lang),
      });
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const totalMessages = chat.messages.length;
    const startIndex = Math.max(0, totalMessages - (pageNum * limitNum));
    const endIndex = totalMessages - ((pageNum - 1) * limitNum);
    
    const paginatedMessages = chat.messages.slice(startIndex, endIndex).reverse();

    return res.status(200).json({
      success: true,
    //   message: t('recuperation_succes', lang),
      data: {
        ...chat,
        messages: paginatedMessages,
        totalMessages,
        hasMore: startIndex > 0,
        currentPage: pageNum,
        totalPages: Math.ceil(totalMessages / limitNum),
      },
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Désactiver un chat
export const deactivateChat = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const { chatId } = req.params;
        const userId = req.user.id; // L'utilisateur qui désactive

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const chat = await Chat.findById(chatId).lean();
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: t('chat_non_trouve', lang),
            });
        }
        
        // Vérifier les permissions
        const user = await Utilisateur.findById(userId).select('_id roles').lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        const isCreator = chat.createdBy.toString() === userId.toString();
        // NOTE: Assurez-vous que la fonction canManageChat existe et est correctement implémentée
        const canDeactivate = isCreator || await canManageChat(user, chat.entityId, chat.entityType);

        if (!canDeactivate) {
            return res.status(403).json({
                success: false,
                message: t('permissions_insuffisantes', lang),
            });
        }

        // 1. Mettre à jour dans la BDD
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
            isActive: false,
            lastActivity: new Date(),
        }, { new: true });
        
        if (updatedChat) {
            // 2. Notifier tous les participants
            await notifierDesactivationChat({
                chatId: updatedChat._id, 
                chatTitle: updatedChat.title, 
                participants: updatedChat.participants, // Les participants sont dans le updatedChat
                deactivatedBy: userId 
            });

            // 3. Émettre l'événement Socket.io (temps réel dans le chat)
            const io = getIO();
            const roomName = `chat_${chatId}`;
            io.to(roomName).emit('chat_deactivated', {
                chatId,
                deactivatedBy: userId,
            });
        }

        return res.status(200).json({
            success: true,
            message: t('chat_desactive_succes', lang),
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Obtenir les détails d'un chat
export const chatDetails = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('participants.user', 'nom prenom email role roles')
      .populate('createdBy', 'nom prenom email')
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }

    const isParticipant = chat.participants.some(p => p.user._id.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: t('non_autorise', lang),
      });
    }

    return res.status(200).json({
      success: true,
      message: t('recuperation_succes', lang),
      data: chat,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};

// Modifier les permissions d'un participant
export const updatePartipantPermission = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const { chatId, participantId } = req.params;
        const { permissions } = req.body; // Nouvelles permissions
        const userId = req.user.id; // L'utilisateur qui modifie
        
        if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(participantId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const chat = await Chat.findById(chatId).lean();
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: t('chat_non_trouve', lang),
            });
        }

        // Vérifier les permissions (logique conservée)
        const currentUser = await Utilisateur.findById(userId).select('_id roles').lean();
        // ... (Vérifications de canUpdate omises pour la concision, on suppose qu'elles sont bonnes)
        const isCreator = chat.createdBy.toString() === userId.toString();
        const canUpdate = isCreator || await canManageChat(currentUser, chat.entityId, chat.entityType);
        
        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: t('permissions_insuffisantes', lang),
            });
        }

        // 1. Mettre à jour les permissions dans la BDD
        const chatDoc = await Chat.findById(chatId);
        const participant = chatDoc.participants.find(p => p.user.toString() === participantId.toString());
        if (!participant) {
            return res.status(404).json({
                success: false,
                message: t('participant_non_trouve', lang),
            });
        }

        Object.assign(participant.permissions, permissions);
        await chatDoc.save();
        
        // 2. Notifier le participant concerné
        await notifierModificationPermissions({
            chatId: chatDoc._id, 
            chatTitle: chatDoc.title, 
            participantId: participant.user, // ID du participant dont les permissions ont changé
            permissions: participant.permissions, // Les nouvelles permissions
            modifiePar: userId // L'utilisateur qui a fait la modification
        });

        // 3. Récupérer et envoyer la réponse (logique conservée)
        const populatedChat = await Chat.findById(chatDoc._id)
            .populate('participants.user', 'nom prenom email role roles')
            .lean();
        
        // Émettre un événement Socket.io pour mettre à jour la vue des participants
        const io = getIO();
        io.to(`chat_${chatId}`).emit('participant_permissions_updated', {
            chatId,
            participantId,
            permissions: participant.permissions
        });

        return res.status(200).json({
            success: true,
            message: t('permissions_modifiees_succes', lang),
            data: populatedChat,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};
// Rechercher des messages
export const searchMessage = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  
  try {
    const { chatId } = req.params;
    const { q } = req.query;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    if (!q) {
      return res.status(400).json({
        success: false,
        message: t('champs_obligatoires', lang),
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('messages.sender', 'nom prenom email')
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }

    const isParticipant = chat.participants.some(p => p.user.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: t('non_autorise', lang),
      });
    }

    const searchResults = chat.messages.filter(message =>
      message.content && message.content.toLowerCase().includes(q.toLowerCase())
    );

    return res.status(200).json({
      success: true,
      message: t('recherche_terminee', lang),
      data: {
        results: searchResults,
        count: searchResults.length,
        searchTerm: q,
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};