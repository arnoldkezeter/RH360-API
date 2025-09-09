// controllers/ChatController.js
import Chat from '../models/Chat.js';
import Utilisateur from '../models/Utilisateur.js'; // Assurez-vous que ce modèle est toujours nécessaire
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import { io } from '../../server.js'; // Assurez-vous que Socket.io est initialisé et exporté depuis un fichier d'entrée (ex: app.js ou server.js)
import TacheThemeFormation from '../models/TacheThemeFormation.js';

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
    const {creatorId} = req.params;

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

    // Récupérer les informations des participants pour enrichir l'objet de la base de données
    let participantIds = participants.map(p => p.userId);
    const existingUsers = await Utilisateur.find({ _id: { $in: participantIds } }).select('_id nom prenom email role');

    const chatParticipants = participants.map(p => {
      const user = existingUsers.find(u => u._id.toString() === p.userId.toString());
      if (!user) return null;

      const userRole = user.role.toLowerCase() || p.role.toLowerCase();
      return {
        user: user._id,
        role: userRole,
        addedBy: creatorId,
        permissions: p.permissions || {
          canAddParticipants: ['super-admin', 'admin', 'responsable'].includes(userRole),
          canRemoveParticipants: ['super-admin', 'admin', 'responsable'].includes(userRole),
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
    
    // Peupler le chat pour la réponse
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'nom prenom email role')
      .populate('createdBy', 'nom prenom email');

    return res.status(201).json({
      success: true,
      message: t('chat_cree_succes', lang),
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

// Récupérer tous les chats de l'utilisateur avec des détails enrichis
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

        // On récupère les chats avec les informations des participants et du créateur.
        const chats = await Chat.find(query)
            .populate('participants.user', 'nom prenom email role')
            .populate('createdBy', 'nom prenom email')
            .sort({ lastActivity: -1 })
            .lean();

        // On map sur les chats pour transformer la structure des données.
        const chatsWithDetails = chats.map(chat => {
            // On s'assure que le champ `participants` est toujours un tableau
            const transformedParticipants = (chat.participants || []).map(p => {
                // Si l'utilisateur a été peuplé, on aplatit l'objet pour correspondre à l'interface souhaitée.
                if (p.user) {
                    return {
                        userId: p.user._id.toString(), // Convertir en string si nécessaire
                        nom: p.user.nom,
                        prenom: p.user.prenom,
                        email: p.user.email,
                        role: p.user.role.toLowerCase(), // Le rôle de l'utilisateur (global)
                        permissions: p.permissions,
                    };
                }
                return p;
            });
            
            // Calcul du nombre de messages non lus pour l'utilisateur
            const unreadCount = (chat.messages || []).filter(msg => 
                msg.sender.toString() !== userId.toString() &&
                !msg.isRead.some(r => r.user.toString() === userId.toString())
            ).length;
            
            // On récupère le dernier message s'il existe
            const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;

            return {
                ...chat,
                participants: transformedParticipants, // On utilise la nouvelle liste de participants
                unreadCount,
                lastMessage,
            };
        });

        return res.status(200).json({
            success: true,
            message: t('recuperation_succes', lang),
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

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const adder = chat.participants.find(p => p.user.toString() === addedBy.toString());
    if (!adder || !['super-admin', 'admin', 'responsable'].includes(adder.role)) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }
    
    const newParticipantIds = newParticipantsData.map(p => p.userId);
    const existingUtilisateurIds = chat.participants.map(p => p.user.toString());
    
    const usersToAdd = await Utilisateur.find({ _id: { $in: newParticipantIds, $nin: existingUtilisateurIds } }).select('_id nom prenom email role');
    
    usersToAdd.forEach(user => {
      const participantData = newParticipantsData.find(p => p.userId.toString() === user._id.toString());
      chat.participants.push({
        user: user._id,
        role: user.role,
        addedBy: addedBy,
        permissions: participantData.permissions || {
          canAddParticipants: ['super-admin', 'admin', 'responsable'].includes(user.role),
          canRemoveParticipants: ['super-admin', 'admin', 'responsable'].includes(user.role),
          canSendMessages: true,
        },
      });
    });

    if (usersToAdd.length > 0) {
      chat.lastActivity = new Date();
      await chat.save();
      
      const systemMessage = {
        sender: addedBy,
        content: t('participants_ajoutes', lang, { count: usersToAdd.length }),
        messageType: 'system',
        timestamp: new Date(),
      };
      chat.messages.push(systemMessage);
      await chat.save();
      
      const roomName = `chat_${chatId}`;
      io.to(roomName).emit('participants_added', {
        chatId,
        newParticipants: usersToAdd,
        addedBy: addedBy,
        message: systemMessage,
      });
    }
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'nom prenom email role')
      .lean();

    return res.status(200).json({
      success: true,
      message: t('participants_ajoutes_succes', lang),
      data: populatedChat,
    });

  } catch (error) {
    console.log(error)
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

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: t('chat_non_trouve', lang),
      });
    }
    
    const remover = chat.participants.find(p => p.user.toString() === removedBy.toString());
    if (!remover || !['super-admin', 'admin', 'responsable'].includes(remover.role)) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }
    
    const initialParticipantsCount = chat.participants.length;

    chat.participants = chat.participants.filter(p => 
      !participantIds.includes(p.user.toString()) || p.user.toString() === chat.createdBy.toString()
    );

    const removedCount = initialParticipantsCount - chat.participants.length;
    
    if (removedCount > 0) {
      chat.lastActivity = new Date();
      
      const systemMessage = {
        sender: removedBy,
        content: t('participants_retires', lang, { count: removedCount }),
        messageType: 'system',
        timestamp: new Date(),
      };
      chat.messages.push(systemMessage);
      await chat.save();
      
      const roomName = `chat_${chatId}`;
      io.to(roomName).emit('participants_removed', {
        chatId,
        removedParticipants: participantIds,
        removedBy: removedBy,
        message: systemMessage,
      });
    }
    
    await chat.save();
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'nom prenom email role')
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
    const {currentUtilisateurId, entityId} = req.params;

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
      });
    }

    let usersToExclude = [currentUtilisateurId];
    let availableUsers = [];
    
    if (entityType === 'TacheExecutee') {
      const tache = await TacheThemeFormation.findById(entityId).populate('responsable').lean();
      if (tache) {
        availableUsers = await Utilisateur.find({
          $or: [
            { _id: tache.responsable },
            { role: { $in: ['admin', 'super-admin'] } },
          ],
          _id: { $ne: currentUtilisateurId },
          isActive: true
        }).select('nom prenom email role');
      }
    } else {
      availableUsers = await Utilisateur.find({ isActive: true, _id: { $ne: currentUtilisateurId } }).select('nom prenom email role');
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
    
    chat.messages.push(newMessage);
    chat.lastActivity = new Date();
    await chat.save();
    
    const populatedMessage = {
      ...newMessage,
      sender: await Utilisateur.findById(senderId).select('nom prenom email').lean()
    };
    
    const roomName = `chat_${chatId}`;
    io.to(roomName).emit('new_message', {
      chatId,
      message: populatedMessage,
      entityType: chat.entityType,
      entityId: chat.entityId,
    });

    return res.status(201).json({
      success: true,
      // message: t('message_envoye_succes', lang),
      data: populatedMessage,
    });

  } catch (error) {
    console.log(error)
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
      .populate('participants.user', 'nom prenom email role')
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
      message: t('recuperation_succes', lang),
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
    console.log(error)
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
    const userId = req.user.id;

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
    
    const isCreatorOrAdmin = chat.createdBy.toString() === userId.toString() || chat.participants.some(p => p.user.toString() === userId.toString() && ['super-admin', 'admin', 'responsable'].includes(p.role));

    if (!isCreatorOrAdmin) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      isActive: false,
      lastActivity: new Date(),
    }, { new: true });
    
    if (updatedChat) {
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
      .populate('participants.user', 'nom prenom email role')
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
    const { permissions } = req.body;
    const userId = req.user.id;
    
    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(participantId)) {
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

    const currentUser = chat.participants.find(p => p.user.toString() === userId.toString());
    const isCreatorOrAdmin = chat.createdBy.toString() === userId.toString() || ['super-admin', 'admin', 'responsable'].includes(currentUser.role);
    
    if (!currentUser || !isCreatorOrAdmin) {
      return res.status(403).json({
        success: false,
        message: t('permissions_insuffisantes', lang),
      });
    }

    const participant = chat.participants.find(p => p.user.toString() === participantId.toString());
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: t('participant_non_trouve', lang),
      });
    }

    Object.assign(participant.permissions, permissions);
    
    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'nom prenom email role')
      .lean();

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