// models/BudgetFormation.js
import mongoose from 'mongoose';

const budgetFormationSchema = new mongoose.Schema({
  theme: {type: mongoose.Schema.Types.ObjectId,ref: 'ThemeFormation',required: true},
  nomFr: {type: String, required: true, trim: true},
  nomEn: {type: String, required: true, trim: true},
  statut: {type: String, enum: ['BROUILLON', 'VALIDE', 'EXECUTE', 'CLOTURE'], default: 'BROUILLON'},
}, { timestamps: true });


const BudgetFormation = mongoose.model('BudgetFormation', budgetFormationSchema);
export default BudgetFormation;



// Méthodes utiles pour les calculs
const calculateTotals = (naturesDepenses) => {
  return naturesDepenses.reduce((totaux, nature) => {
    const montantPrevuHT = nature.quantite * nature.montantUnitairePrevu;
    const montantPrevuTTC = montantPrevuHT * (1 + nature.taxe / 100);
    
    const montantReelHT = nature.montantUnitaireReel ? 
      nature.quantite * nature.montantUnitaireReel : 0;
    const montantReelTTC = montantReelHT * (1 + nature.taxe / 100);
    
    return {
      montantTotalPrevuHT: totaux.montantTotalPrevuHT + montantPrevuHT,
      montantTotalPrevuTTC: totaux.montantTotalPrevuTTC + montantPrevuTTC,
      montantTotalReelHT: totaux.montantTotalReelHT + montantReelHT,
      montantTotalReelTTC: totaux.montantTotalReelTTC + montantReelTTC
    };
  }, {
    montantTotalPrevuHT: 0,
    montantTotalPrevuTTC: 0,
    montantTotalReelHT: 0,
    montantTotalReelTTC: 0
  });
};