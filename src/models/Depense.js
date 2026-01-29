// models/Depense.js
import mongoose from 'mongoose';

const depenseSchema = new mongoose.Schema({
  // ✅ MODIFIÉ: Lié au thème au lieu du budget
  themeFormation: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true, index: true},
  nomFr: {type: String, required: true, trim: true},
  nomEn: {type: String, required: true, trim: true},
  quantite: {type: Number, min: 1, default: 1},
  montantUnitairePrevu: {type: Number, required: true, min: 0},
  montantUnitaireReel: {type: Number, min: 0, default: null},
  taxes: [{type: mongoose.Schema.Types.ObjectId, ref: 'Taxe'}],
  type: {type: String, enum: ['ACQUISITION_BIENS_SERVICES', 'FRAIS_ADMINISTRATIF'], required: true, index: true}
   
}, { timestamps: true });

// ✅ Index composé pour recherche rapide par thème et type
depenseSchema.index({ themeFormation: 1, type: 1 });

// ✅ Méthode virtuelle pour calculer le montant total prévu (avec taxes)
depenseSchema.virtual('montantTotalPrevu').get(function() {
  let total = this.montantUnitairePrevu * this.quantite;
  
  if (this.taxes && this.taxes.length > 0) {
    this.taxes.forEach(taxe => {
      if (taxe.taux) {
        total += total * (taxe.taux / 100);
      }
    });
  }
  
  return total;
});

// ✅ Méthode virtuelle pour calculer le montant total réel (avec taxes)
depenseSchema.virtual('montantTotalReel').get(function() {
  if (!this.montantUnitaireReel) return null;
  
  let total = this.montantUnitaireReel * this.quantite;
  
  if (this.taxes && this.taxes.length > 0) {
    this.taxes.forEach(taxe => {
      if (taxe.taux) {
        total += total * (taxe.taux / 100);
      }
    });
  }
  
  return total;
});

// ✅ Méthode statique pour obtenir le total des dépenses prévues d'un thème
depenseSchema.statics.getTotalDepensesPrevuesTheme = async function(themeFormationId) {
  const depenses = await this.find({ themeFormation: themeFormationId }).populate('taxes');
  
  return depenses.reduce((total, depense) => {
    let montant = depense.montantUnitairePrevu * depense.quantite;
    
    if (depense.taxes && depense.taxes.length > 0) {
      depense.taxes.forEach(taxe => {
        if (taxe.taux) {
          montant += montant * (taxe.taux / 100);
        }
      });
    }
    
    return total + montant;
  }, 0);
};

// ✅ Méthode statique pour obtenir le total des dépenses réelles d'un thème
depenseSchema.statics.getTotalDepensesReellesTheme = async function(themeFormationId) {
  const depenses = await this.find({ 
    themeFormation: themeFormationId,
    montantUnitaireReel: { $ne: null }
  }).populate('taxes');
  
  return depenses.reduce((total, depense) => {
    let montant = depense.montantUnitaireReel * depense.quantite;
    
    if (depense.taxes && depense.taxes.length > 0) {
      depense.taxes.forEach(taxe => {
        if (taxe.taux) {
          montant += montant * (taxe.taux / 100);
        }
      });
    }
    
    return total + montant;
  }, 0);
};

// ✅ Méthode statique pour obtenir les dépenses par type
depenseSchema.statics.getDepensesParType = async function(themeFormationId, type) {
  return await this.find({ 
    themeFormation: themeFormationId,
    type: type
  }).populate('taxes');
};

// ✅ Validation : montant unitaire réel ne peut pas être négatif
depenseSchema.pre('save', function(next) {
  if (this.montantUnitaireReel !== null && this.montantUnitaireReel < 0) {
    next(new Error('Le montant unitaire réel ne peut pas être négatif'));
  }
  next();
});

// ✅ Activer les virtuals dans la conversion JSON
depenseSchema.set('toJSON', { virtuals: true });
depenseSchema.set('toObject', { virtuals: true });

const Depense = mongoose.model('Depense', depenseSchema);
export default Depense;