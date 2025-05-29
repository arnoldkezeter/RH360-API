import mongoose from 'mongoose';
import BudgetFormation from '../models/BudgetFormation';

/**
 * Calcule le coût total prévu d'un thème de formation donné.
 * @param {mongoose.Types.ObjectId} themeId - ID du thème de formation
 * @returns {number} - Coût total prévu
 */
export const calculerCoutTotalPrevu = async (themeId) => {
    if (!mongoose.Types.ObjectId.isValid(themeId)) return 0;

    const budgets = await BudgetFormation.find({ theme: themeId });

    let total = 0;

    for (const budget of budgets) {
        for (const ligne of budget.lignes) {
            const montant = ligne.montantUnitairePrevuHT || 0;
            const quantite = ligne.quantite || 0;
            total += montant * quantite;
        }
    }

    return total;
};

/**
 * Calcule le coût total réel d'un thème de formation donné.
 * @param {mongoose.Types.ObjectId} themeId - ID du thème de formation
 * @returns {number} - Coût total réel
 */
export const calculerCoutTotalReel = async (themeId) => {
    if (!mongoose.Types.ObjectId.isValid(themeId)) return 0;

    const budgets = await BudgetFormation.find({ theme: themeId });

    let total = 0;

    for (const budget of budgets) {
        for (const ligne of budget.lignes) {
            const montant = ligne.montantUnitaireReelHT || 0; // On suppose qu’il y a un champ `coutReel` dans chaque ligne
            const quantite = ligne.quantite || 0;
            total += montant * quantite;
        }
    }

    return total;
};



/**
 * Calcule les coûts (prévu, réel, écart) d’un thème de formation donné.
 * @param {mongoose.Types.ObjectId} themeId - ID du thème de formation
 * @returns {{ coutTotalPrevu: number, coutTotalReel: number, ecart: number }}
 */
export const calculerCoutsThemeFormation = async (themeId) => {
    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return { coutTotalPrevu: 0, coutTotalReel: 0, ecart: 0 };
    }

    const budgets = await BudgetFormation.find({ theme: themeId });

    let coutTotalPrevu = 0;
    let coutTotalReel = 0;

    for (const budget of budgets) {
        for (const ligne of budget.lignes) {
            const quantite = ligne.quantite || 0;
            const montantPrevu = ligne.montantUnitaireHT || 0;
            const montantReel = ligne.montantUnitaireReelHT || 0;

            coutTotalPrevu += montantPrevu * quantite;
            coutTotalReel += montantReel * quantite;
        }
    }

    const ecart = coutTotalPrevu - coutTotalReel;

    return { coutTotalPrevu, coutTotalReel, ecart };
};

