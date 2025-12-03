import BudgetFormation from "../models/BudgetFormation.js";
import ThemeFormation from "../models/ThemeFormation.js";

/**
 * Enrichit une liste de formations avec des données agrégées provenant des thèmes de formation associés.
 * Pour chaque formation, calcule :
 * - le nombre de thèmes associés,
 * - le total des publics cibles,
 * - la période globale (date de début/fin minimale/maximale),
 * - le coût estimatif prévu total basé sur les lignes budgétaires.
 *
 * @param {Array<Object>} formations - Liste des objets Formation (issus de MongoDB, avec _id)
 * @returns {Promise<Array<Object>>} - Liste des formations enrichies avec les champs :
 *   - nbThemes
 *   - totalPublicCible
 *   - dateDebutGlobale
 *   - dateFinGlobale
 *   - coutEstimeTotal
 */


export const enrichirFormations = async (formations) => {
    const formationIds = formations.map(f => f._id);

    // Récupère tous les thèmes de ces formations
    const themes = await ThemeFormation.find({ formation: { $in: formationIds } }).lean();

    // Regroupe les thèmes par formation
    const themesParFormation = {};
    for (const theme of themes) {
        const id = theme.formation.toString();
        if (!themesParFormation[id]) themesParFormation[id] = [];
        themesParFormation[id].push(theme);
    }

    // Récupère tous les budgets liés aux thèmes
    const budgets = await BudgetFormation.find({ theme: { $in: themes.map(t => t._id) } }).lean();

    const budgetsParTheme = {};
    for (const budget of budgets) {
        const id = budget.theme.toString();
        if (!budgetsParTheme[id]) budgetsParTheme[id] = [];
        budgetsParTheme[id].push(budget);
    }

    // Ajoute les infos à chaque formation
    return formations.map(formation => {
        const fid = formation._id.toString();
        const sesThemes = themesParFormation[fid] || [];

        // Période
        const datesDebut = sesThemes.map(t => new Date(t.dateDebut));
        const datesFin = sesThemes.map(t => new Date(t.dateFin));
        const dateDebutGlobale = datesDebut.length ? new Date(Math.min(...datesDebut)) : null;
        const dateFinGlobale = datesFin.length ? new Date(Math.max(...datesFin)) : null;

        // Public cible
        const publicTotal = sesThemes.reduce((sum, t) => sum + (t.publicCible?.length || 0), 0);

        // Coût estimatif prévu total
        let coutEstimeTotal = 0;
        for (const theme of sesThemes) {
            const bid = theme._id.toString();
            const lignes = budgetsParTheme[bid] || [];
            for (const ligne of lignes) {
                coutEstimeTotal += (ligne.montantUnitairePrevuHT || 0) * (ligne.quantite || 0);
            }
        }

        return {
            ...formation,
            nbThemes: sesThemes.length,
            totalPublicCible: publicTotal,
            dateDebutGlobale: dateDebutGlobale || null,
            dateFinGlobale: dateFinGlobale || null,
            coutEstimeTotal,
        };
    });
};

// Fonction utilitaire pour vérifier si un utilisateur fait partie du public cible d'un thème
export const isUserInPublicCible = async (theme, user) => {
    if (!theme.publicCible || theme.publicCible.length === 0) {
        return false;
    }

    // Récupérer les informations du poste de travail de l'utilisateur
    const userPoste = user.posteDeTravail?._id || user.posteDeTravail;
    const userFamilleMetier = user.posteDeTravail?.familleMetier || user.familleMetier;
    const userStructure = user.structure;
    const userService = user.service;

    for (const familleCible of theme.publicCible) {
        // Vérifier si l'utilisateur appartient à cette famille de métier
        if (userFamilleMetier?.toString() !== familleCible.familleMetier.toString()) {
            continue;
        }

        // Cas 1 : Toute la famille (pas de restrictions sur les postes)
        if (!familleCible.postes || familleCible.postes.length === 0) {
            return true;
        }

        // Cas 2 : Vérifier les restrictions par postes
        for (const posteRestriction of familleCible.postes) {
            if (userPoste?.toString() !== posteRestriction.poste.toString()) {
                continue;
            }

            // Cas 2a : Toutes les structures du poste
            if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                return true;
            }

            // Cas 2b : Vérifier les restrictions par structures
            for (const structureRestriction of posteRestriction.structures) {
                if (userStructure?.toString() !== structureRestriction.structure.toString()) {
                    continue;
                }

                // Cas 2b-i : Tous les services de la structure
                if (!structureRestriction.services || structureRestriction.services.length === 0) {
                    return true;
                }

                // Cas 2b-ii : Vérifier les services spécifiques
                const serviceIds = structureRestriction.services.map(s => s.service.toString());
                if (userService && serviceIds.includes(userService.toString())) {
                    return true;
                }
            }
        }
    }

    return false;
};