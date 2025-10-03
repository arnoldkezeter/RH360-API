// controllers/notificationController.js
import Utilisateur from '../models/Utilisateur.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { Notification } from '../models/Notification.js';
import { sendNotificationToUser } from '../utils/socket.js';

/**
 * Créer une notification en base de données
 */
export const creerNotification = async ({
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
    console.error('Erreur création notification:', error);
    throw error;
  }
};

/**
 * Envoyer une notification en temps réel via Socket.IO
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

    // Utiliser la fonction de socket.js
    sendNotificationToUser(
      destinataireId.toString(),
      'nouvelle_notification',
      notificationData
    );

    console.log(`Notification envoyée à l'utilisateur ${destinataireId}`);
  } catch (error) {
    console.error('Erreur envoi notification temps réel:', error);
    // Ne pas throw l'erreur pour ne pas bloquer le processus principal
  }
};

/**
 * Notifier le changement de statut d'une tâche
 */
export const notifierChangementStatutTache = async ({
  tache,
  ancienStatut,
  nouveauStatut,
  modifiePar,
  theme
}) => {
  try {
    // Récupérer les utilisateurs à notifier
    const utilisateursANotifier = await obtenirUtilisateursANotifier(theme._id);

    if (utilisateursANotifier.length === 0) {
      console.log('Aucun utilisateur à notifier');
      return [];
    }

    // Préparer le message
    const messages = construireMessageStatut(
      tache,
      ancienStatut,
      nouveauStatut,
      theme
    );

    // Créer et envoyer les notifications
    const notifications = await Promise.all(
      utilisateursANotifier.map(async (userId) => {
        const notification = await creerNotification({
          destinataireId: userId,
          type: 'TACHE_STATUT_CHANGE',
          titreFr: messages.titreFr,
          titreEn: messages.titreEn,
          messageFr: messages.messageFr,
          messageEn: messages.messageEn,
          donnees: {
            tacheId: tache._id,
            themeId: theme._id,
            ancienStatut,
            nouveauStatut,
            modifiePar
          }
        });

        // Envoyer en temps réel
        await envoyerNotificationTempsReel(userId, notification);

        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification changement statut:', error);
    throw error;
  }
};

/**
 * Notifier l'acceptation/refus d'un stage
 */
export const notifierStatutStage = async (stage, stagiaires, statut) => {
  try {
    const messages = statut === 'ACCEPTE' 
      ? {
          titreFr: 'Stage accepté',
          titreEn: 'Internship accepted',
          messageFr: 'Votre demande de stage a été acceptée',
          messageEn: 'Your internship request has been accepted'
        }
      : {
          titreFr: 'Stage refusé',
          titreEn: 'Internship rejected',
          messageFr: 'Votre demande de stage a été refusée',
          messageEn: 'Your internship request has been rejected'
        };

    const notifications = await Promise.all(
      stagiaires.map(async (stagiaire) => {
        const notification = await creerNotification({
          destinataireId: stagiaire._id,
          type: statut === 'ACCEPTE' ? 'STAGE_ACCEPTE' : 'STAGE_REFUSE',
          titreFr: messages.titreFr,
          titreEn: messages.titreEn,
          messageFr: messages.messageFr,
          messageEn: messages.messageEn,
          donnees: {
            stageId: stage._id,
            statut
          }
        });

        await envoyerNotificationTempsReel(stagiaire._id, notification);

        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification statut stage:', error);
    throw error;
  }
};

/**
 * Notifier plusieurs utilisateurs d'un événement
 */
export const notifierEvenementFormation = async ({
  theme,
  type,
  titreFr,
  titreEn,
  messageFr,
  messageEn,
  utilisateursIds
}) => {
  try {
    const notifications = await Promise.all(
      utilisateursIds.map(async (userId) => {
        const notification = await creerNotification({
          destinataireId: userId,
          type,
          titreFr,
          titreEn,
          messageFr,
          messageEn,
          donnees: {
            themeId: theme._id,
            themeTitre: theme.titreFr
          }
        });

        await envoyerNotificationTempsReel(userId, notification);

        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error('Erreur notification événement formation:', error);
    throw error;
  }
};

/**
 * Obtenir la liste des utilisateurs à notifier pour un thème
 */
const obtenirUtilisateursANotifier = async (themeId) => {
  try {
    // Récupérer le thème avec les responsables
    const theme = await ThemeFormation.findById(themeId)
      .populate('responsable')
      .lean();

    if (!theme) {
      console.warn(`Thème ${themeId} non trouvé`);
      return [];
    }

    const utilisateursIds = new Set();

    // Ajouter les responsables du thème
    if (theme.responsable && Array.isArray(theme.responsable)) {
      theme.responsable.forEach(resp => {
        if (resp && resp._id) {
          utilisateursIds.add(resp._id.toString());
        }
      });
    }

    // Récupérer tous les SUPER-ADMINs et ADMINs
    const admins = await Utilisateur.find({
      role: { $in: ['SUPER-ADMIN', 'ADMIN'] }
    }).select('_id').lean();

    admins.forEach(admin => {
      utilisateursIds.add(admin._id.toString());
    });

    return Array.from(utilisateursIds);
  } catch (error) {
    console.error('Erreur obtention utilisateurs à notifier:', error);
    return [];
  }
};

/**
 * Construire le message de notification pour un changement de statut
 */
const construireMessageStatut = (tache, ancienStatut, nouveauStatut, theme) => {
  const statutsTraduction = {
    'A_FAIRE': { fr: 'À faire', en: 'To do' },
    'EN_ATTENTE': { fr: 'En attente', en: 'Pending' },
    'EN_COURS': { fr: 'En cours', en: 'In progress' },
    'TERMINE': { fr: 'Terminé', en: 'Completed' }
  };

  const ancienStatutTrad = statutsTraduction[ancienStatut] || { fr: ancienStatut, en: ancienStatut };
  const nouveauStatutTrad = statutsTraduction[nouveauStatut] || { fr: nouveauStatut, en: nouveauStatut };

  return {
    titreFr: 'Changement de statut de tâche',
    titreEn: 'Task status change',
    messageFr: `Le statut de la tâche "${tache.libelleFr || 'Sans titre'}" du thème "${theme.titreFr || 'Sans titre'}" est passé de "${ancienStatutTrad.fr}" à "${nouveauStatutTrad.fr}".`,
    messageEn: `The status of the task "${tache.libelleEn || 'Untitled'}" for the theme "${theme.titreEn || 'Untitled'}" changed from "${ancienStatutTrad.en}" to "${nouveauStatutTrad.en}".`
  };
};

/**
 * Récupérer les notifications d'un utilisateur
 */
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, nonLues } = req.query;

    const query = { destinataire: userId };
    if (nonLues === 'true') {
      query.lue = false;
    }

    const notifications = await Notification.find(query)
      .sort({ dateCreation: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * Marquer une notification comme lue
 */
export const marquerCommeLue = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { lue: true, dateLecture: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    return res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Erreur marquage notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * Marquer toutes les notifications comme lues
 */
export const marquerToutesCommeLues = async (req, res) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany(
      { destinataire: userId, lue: false },
      { lue: true, dateLecture: new Date() }
    );

    return res.status(200).json({
      success: true,
      message: 'Toutes les notifications ont été marquées comme lues'
    });
  } catch (error) {
    console.error('Erreur marquage toutes notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};