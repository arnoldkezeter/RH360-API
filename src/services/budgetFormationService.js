import mongoose from 'mongoose';
import BudgetFormation from '../models/BudgetFormation.js';
import Depense from '../models/Depense.js';

/**
 * Calcule le coût total prévu TTC d'un thème.
 * @param {mongoose.Types.ObjectId} themeId
 * @returns {number}
 */
export const calculerCoutTotalPrevu = async (themeId) => {
  if (!mongoose.Types.ObjectId.isValid(themeId)) return 0;

  const budgets = await BudgetFormation.find({ theme: themeId }).lean();
  const budgetIds = budgets.map(b => b._id);

  const depenses = await Depense.find({ budget: { $in: budgetIds } })
    .populate('taxes', 'taux')
    .lean();

  let total = 0;

  for (const dep of depenses) {
    const quantite = dep.quantite ?? 1;
    const tauxTotal = (dep.taxes || []).reduce((sum, t) => sum + (t.taux || 0), 0);
    const montantHT = dep.montantUnitairePrevu ?? 0;
    total += montantHT * quantite * (1 + tauxTotal / 100);
  }

  return parseFloat(total.toFixed(2));
};


/**
 * Calcule le coût total réel TTC d'un thème.
 * @param {mongoose.Types.ObjectId} themeId
 * @returns {number}
 */
export const calculerCoutTotalReel = async (themeId) => {
  if (!mongoose.Types.ObjectId.isValid(themeId)) return 0;

  const budgets = await BudgetFormation.find({
    theme: themeId,
    statut: { $in: ['EXECUTE', 'CLOTURE'] },
  }).lean();

  const budgetIds = budgets.map(b => b._id);

  const depenses = await Depense.find({ budget: { $in: budgetIds } })
    .populate('taxes', 'taux')
    .lean();

  let total = 0;

  for (const dep of depenses) {
    const quantite = dep.quantite ?? 1;
    const tauxTotal = (dep.taxes || []).reduce((sum, t) => sum + (t.taux || 0), 0);
    const montantHT = dep.montantUnitaireReel ?? dep.montantUnitairePrevu ?? 0;
    total += montantHT * quantite * (1 + tauxTotal / 100);
  }

  return parseFloat(total.toFixed(2));
};


/**
 * Calcule les coûts TTC (prévu, réel, écart) d’un thème.
 * @param {mongoose.Types.ObjectId} themeId
 * @returns {{ coutTotalPrevu: number, coutTotalReel: number, ecart: number }}
 */
export const calculerCoutsThemeFormation = async (themeId) => {
  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return { coutTotalPrevu: 0, coutTotalReel: 0, ecart: 0 };
  }

  const budgets = await BudgetFormation.find({ theme: themeId }).lean();
  const budgetIds = budgets.map(b => b._id);

  const depenses = await Depense.find({ budget: { $in: budgetIds } })
    .populate('taxes', 'taux')
    .lean();

  let coutTotalPrevu = 0;
  let coutTotalReel = 0;

  for (const dep of depenses) {
    const quantite = dep.quantite ?? 1;
    const tauxTotal = (dep.taxes || []).reduce((sum, t) => sum + (t.taux || 0), 0);

    const prevuHT = dep.montantUnitairePrevu ?? 0;
    const reelHT = dep.montantUnitaireReel ?? dep.montantUnitairePrevu ?? 0;

    coutTotalPrevu += prevuHT * quantite * (1 + tauxTotal / 100);
    coutTotalReel += reelHT * quantite * (1 + tauxTotal / 100);
  }

  const ecart = Math.abs(coutTotalPrevu - coutTotalReel);

  return {
    coutTotalPrevu: parseFloat(coutTotalPrevu.toFixed(2)),
    coutTotalReel: parseFloat(coutTotalReel.toFixed(2)),
    ecart: parseFloat(ecart.toFixed(2))
  };
};


/**
 * Calcule les coûts prévus et réels TTC d'un budget (reçu en paramètre).
 * @param {Object} budget - Document BudgetFormation
 * @returns {{ coutPrevu: number, coutReel: number }}
 */
export const calculerCoutsBudget = async (budget) => {
  const depenses = await Depense.find({ budget: budget._id })
    .populate('taxes', 'taux')
    .lean();

  let coutPrevu = 0;
  let coutReel = 0;

  for (const dep of depenses) {
    const quantite = dep.quantite ?? 1;
    const tauxTotal = (dep.taxes || []).reduce((sum, t) => sum + (t.taux || 0), 0);

    const prevuHT = dep.montantUnitairePrevu ?? 0;
    const reelHT = dep.montantUnitaireReel ?? prevuHT;

    coutPrevu += prevuHT * quantite * (1 + tauxTotal / 100);
    coutReel += reelHT * quantite * (1 + tauxTotal / 100);
  }

  return {
    coutPrevu: parseFloat(coutPrevu.toFixed(2)),
    coutReel: parseFloat(coutReel.toFixed(2)),
  };
};
