import { Notification } from "../models/Notification.js";
import { t } from '../utils/i18n.js';
import mongoose from "mongoose";

export const obtenirNotifications = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    // Assurez-vous que req.user.id existe et est valide pour votre middleware d'auth
    const userId = req.params.userId; 

    // Conversion des chaînes de requête en types appropriés et gestion des valeurs par défaut
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const nonLues = req.query.nonLues === 'true'; // Convertit explicitement en booléen

    // Validation des paramètres de pagination
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
        return res.status(400).json({
            success: false,
            message: t('pagination_invalide', lang) // Assurez-vous d'avoir cette traduction
        });
    }

    try {
        const query = { destinataire: userId };
        if (nonLues) {
            query.lue = false;
        }
        
        const skip = (page - 1) * limit;

        // Exécution des trois requêtes en parallèle (optimisation des performances)
        const [notifications, total, nonLuesCount] = await Promise.all([
            // 1. Les notifications paginées
            Notification.find(query)
                .sort({ dateCreation: -1 })
                .limit(limit)
                .skip(skip)
                .lean(), 

            // 2. Le compte total (pour la pagination)
            Notification.countDocuments(query),
            
            // 3. Le compte total des non-lues (pour l'affichage du badge)
            Notification.countDocuments({
                destinataire: userId,
                lue: false
            })
        ]);
        console.log(notifications)
        return res.json({
            success: true,
            data: {
                notifications,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
                nonLuesCount
            }
        });
    } catch (error) {
        console.error('Erreur obtention notifications:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

export const marquerCommeLue = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { notificationId, userId } = req.params;
  console.log(userId)
  console.log(notificationId)
  try {
    if (!notificationId || !userId || 
        !mongoose.Types.ObjectId.isValid(notificationId) || 
        !mongoose.Types.ObjectId.isValid(userId)) {
        
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, destinataire: userId },
      { lue: true, dateLecture: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: t('notification_non_trouvee', lang)
      });
    }

    return res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Erreur marquage notification:', error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang)
    });
  }
};

export const marquerToutesCommeLues = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const userId = req.params.userId;

  try {
    await Notification.updateMany(
      { destinataire: userId, lue: false },
      { lue: true, dateLecture: new Date() }
    );

    return res.json({
      success: true,
      message: t('notifications_marquees_lues', lang)
    });
  } catch (error) {
    console.error('Erreur marquage notifications:', error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang)
    });
  }
};

export const supprimerNotification = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { notificationId, userId } = req.params;

  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      destinataire: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: t('notification_non_trouvee', lang)
      });
    }

    return res.json({
      success: true,
      message: t('notification_supprimee', lang)
    });
  } catch (error) {
    console.error('Erreur suppression notification:', error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang)
    });
  }
};