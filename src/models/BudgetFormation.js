// models/BudgetFormation.js
import mongoose from 'mongoose';

const budgetFormationSchema = new mongoose.Schema({
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'},
  budgetRelle:{type:Boolean},
  sections: [
    {
      type:{type:String, enum:['BIENS_SERVICES', 'FRAIS_ADMINISTRATIF']},
      lignes: [{
        natureDepense: { type: String },
        montantUnitaireHT: { type: Number },
        quantite: { type: Number },
        natureTaxe:{type: mongoose.Schema.Types.ObjectId, ref: 'Taxe'},
      }]
    }]

}, { timestamps: true });

const BudgetFormation = mongoose.model('BudgetFormation', budgetFormationSchema);
export default BudgetFormation;