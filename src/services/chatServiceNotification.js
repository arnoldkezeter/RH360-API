// services/chatNotificationService.js
import { Notification } from '../models/Notification.js';
import { sendNotificationToUser } from '../utils/socket.js';

/**
 * Créer une notification pour un chat
 */
export const creerNotificationChat = async ({
  destinataireId,
  type,
  titreFr,
  titreEn,
  messageFr,
  messageEn,
  donnees
}) => {
  try {
    const notification = new Notification({
      destinataire: destinataireId,
      type,
      titre: {
        fr: titreFr,
        en: titreEn
      },
      message: {
        fr: messageFr,
        en: messageEn
      },
      donnees
    });

    await notification.save();
    await notification.populate('destinataire', 'nom prenom email');

    return notification;
  } catch (error) {
    console.error('Erreur création notification chat:', error);
    throw error;
  }
};

/**
 * Envoyer une notification en temps réel
 */
export const envoyerNotificationTempsReel = async (destinataireId, notification) => {
  try {
    const notificationData = {
      id: notification._id,
      type: notification.type,
      titre: notification.titre,
      message: notification.message,
      donnees: notification.donnees,
      dateCreation: notification.dateCreation,
      lue: notification.lue
    };

    sendNotificationToUser(
      destinataireId.toString(),
      'nouvelle_notification',
      notificationData
    );
  } catch (error) {
    console.error('Erreur envoi notification temps réel:', error);
  }
};

/**
 * Notifier la création d'un nouveau chat
 */
export const notifierCreationChat = async ({ chat, participants, createur }) => {
  try {
    const notifications = await Promise.all(
      participants
        .filter(p => p.userId !== createur.toString())
        .map(async (participant) => {
          const notification = await creerNotificationChat({
            destinataireId: participant.userId,
            type: 'CHAT_CREE',
            titreFr: 'Nouveau chat',
            titreEn: 'New chat',
            messageFr: `Vous avez été ajouté au chat "${chat.title}"`,
            messageEn: `You have been added to the chat "${chat.title}"`,
            donnees: {
              chatId: chat._id,
              chatTitle: chat.title,
              entityType: chat.entityType,
              entityId: chat.entityId,
              createrId: createur
            }
          });

          await envoyerNotificationTempsReel(participant.userId, notification);
          return notification;
        })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification création chat:', error);
    return [];
  }
};

/**
 * Notifier l'ajout de participants
 */
export const notifierAjoutParticipants = async ({ 
  chatId, 
  chatTitle, 
  nouveauxParticipants, 
  addedBy,
  entityType,
  entityId
}) => {
  try {
    const notifications = await Promise.all(
      nouveauxParticipants.map(async (participant) => {
        const notification = await creerNotificationChat({
          destinataireId: participant._id,
          type: 'CHAT_PARTICIPANT_AJOUTE',
          titreFr: 'Ajouté à un chat',
          titreEn: 'Added to a chat',
          messageFr: `Vous avez été ajouté au chat "${chatTitle}"`,
          messageEn: `You have been added to the chat "${chatTitle}"`,
          donnees: {
            chatId,
            chatTitle,
            entityType,
            entityId,
            addedBy
          }
        });

        await envoyerNotificationTempsReel(participant._id, notification);
        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification ajout participants:', error);
    return [];
  }
};

/**
 * Notifier le retrait de participants
 */
export const notifierRetraitParticipants = async ({ 
  chatId, 
  chatTitle, 
  participantsRetires, 
  removedBy 
}) => {
  try {
    const notifications = await Promise.all(
      participantsRetires.map(async (participantId) => {
        const notification = await creerNotificationChat({
          destinataireId: participantId,
          type: 'CHAT_PARTICIPANT_RETIRE',
          titreFr: 'Retiré d\'un chat',
          titreEn: 'Removed from a chat',
          messageFr: `Vous avez été retiré du chat "${chatTitle}"`,
          messageEn: `You have been removed from the chat "${chatTitle}"`,
          donnees: {
            chatId,
            chatTitle,
            removedBy
          }
        });

        await envoyerNotificationTempsReel(participantId, notification);
        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification retrait participants:', error);
    return [];
  }
};

/**
 * Notifier un nouveau message dans un chat
 */
export const notifierNouveauMessage = async ({ 
  chatId, 
  chatTitle, 
  message, 
  senderId, 
  senderNom,
  senderPrenom,
  participants,
  entityType,
  entityId
}) => {
  try {
    // Notifier tous les participants sauf l'expéditeur
    const notifications = await Promise.all(
      participants
        .filter(p => p.user.toString() !== senderId.toString())
        .map(async (participant) => {
          const notification = await creerNotificationChat({
            destinataireId: participant.user,
            type: 'CHAT_NOUVEAU_MESSAGE',
            titreFr: 'Nouveau message',
            titreEn: 'New message',
            messageFr: `${senderPrenom} ${senderNom} : ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
            messageEn: `${senderPrenom} ${senderNom}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
            donnees: {
              chatId,
              chatTitle,
              messageId: message._id,
              senderId,
              senderNom,
              senderPrenom,
              entityType,
              entityId,
              messageContent: message.content
            }
          });

          await envoyerNotificationTempsReel(participant.user, notification);
          return notification;
        })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification nouveau message:', error);
    return [];
  }
};

/**
 * Notifier la modification des permissions
 */
export const notifierModificationPermissions = async ({ 
  chatId, 
  chatTitle, 
  participantId, 
  nouvelles, permissions,
  modifiePar 
}) => {
  try {
    const notification = await creerNotificationChat({
      destinataireId: participantId,
      type: 'CHAT_PERMISSIONS_MODIFIEES',
      titreFr: 'Permissions modifiées',
      titreEn: 'Permissions modified',
      messageFr: `Vos permissions dans le chat "${chatTitle}" ont été modifiées`,
      messageEn: `Your permissions in the chat "${chatTitle}" have been modified`,
      donnees: {
        chatId,
        chatTitle,
        permissions,
        modifiePar
      }
    });

    await envoyerNotificationTempsReel(participantId, notification);
    return notification;
  } catch (error) {
    console.error('Erreur notification modification permissions:', error);
    return null;
  }
};

/**
 * Notifier la désactivation d'un chat
 */
export const notifierDesactivationChat = async ({ 
  chatId, 
  chatTitle, 
  participants, 
  deactivatedBy 
}) => {
  try {
    const notifications = await Promise.all(
      participants
        .filter(p => p.user.toString() !== deactivatedBy.toString())
        .map(async (participant) => {
          const notification = await creerNotificationChat({
            destinataireId: participant.user,
            type: 'CHAT_DESACTIVE',
            titreFr: 'Chat désactivé',
            titreEn: 'Chat deactivated',
            messageFr: `Le chat "${chatTitle}" a été désactivé`,
            messageEn: `The chat "${chatTitle}" has been deactivated`,
            donnees: {
              chatId,
              chatTitle,
              deactivatedBy
            }
          });

          await envoyerNotificationTempsReel(participant.user, notification);
          return notification;
        })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification désactivation chat:', error);
    return [];
  }
};