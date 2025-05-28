// models/BudgetFormation.js
import mongoose from 'mongoose';

const budgetFormationSchema = new mongoose.Schema({
  theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', index: true, required: true },
  budgetReel: { type: Boolean, required: true },
  sections: [
    {
      type: { type: String, enum: ['BIENS_SERVICES', 'FRAIS_ADMINISTRATIF'], required: true },
      lignes: [{
        natureDepenseFr: { type: String, required: true },
        natureDepenseEn: { type: String, required: false },
        montantUnitaireHT: { type: Number, required: true, min: 0 },
        quantite: { type: Number, required: true, min: 0 },
        natureTaxe: { type: mongoose.Schema.Types.ObjectId, ref: 'Taxe' },
      }],
    }
  ]
}, { timestamps: true });


const BudgetFormation = mongoose.model('BudgetFormation', budgetFormationSchema);
export default BudgetFormation;