import mongoose from "mongoose";
import { t } from "../utils/i18n.js"; // si tu utilises ton helper de traduction
import TacheThemeFormation from "../models/TacheThemeFormation.js";

/**
 * Met à jour le statut d'une tâche avec logique métier.
 * 
 * @param {String} tacheFormationId - L'ID de la tâche
 * @param {String} statut - Le nouveau statut (ex: 'EN_ATTENTE')
 * @param {String} donnees - Info additionnelle (ex: référence ou note associée)
 * @param {String} lang - Langue pour les messages
 * @param {Object} session - Session mongoose (optionnelle pour transaction)
 * 
 * @returns {Object} tache mise à jour
 * @throws {Error} en cas de problème
 */
export const mettreAJourTache = async ({
    tacheFormationId,
    statut,
    donnees = "",
    lang = "fr",
    executePar,
    session = null
    }) => {
    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(tacheFormationId)) {
        throw new Error(t('identifiant_invalide', lang));
    }

    const tache = await TacheThemeFormation.findById(tacheFormationId);

    if (!tache) {
        throw new Error(t('tache_non_trouvee', lang));
    }

    // Logique métier
    if (statut === 'TERMINE' && !tache.estExecutee) {
        throw new Error(t('tache_non_executee', lang));
    }

    if (statut === 'EN_ATTENTE' || statut === 'EN_COURS') {
        tache.dateDebut = tache.dateDebut || new Date();
    }

    if (statut === 'TERMINE') {
        tache.dateFin = new Date();
    }

    tache.executePar = executePar;
    tache.statut = statut;
    tache.donnees = donnees;

    await tache.save({ session });

    return tache;
};
