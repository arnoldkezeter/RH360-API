// models/Depense.js
import mongoose from 'mongoose';

const depenseSchema = new mongoose.Schema({
  budget: {type: mongoose.Schema.Types.ObjectId,ref: 'BudgetFormation',required: true, index:true},
  nomFr: {type: String,required: true,trim: true},
  nomEn: {type: String,required: true,trim: true},
  quantite: {type: Number, min: 1, default:1},
  montantUnitairePrevu: {type: Number,required: true,min: 0},
  montantUnitaireReel: {type: Number,min: 0,default: null},
  taxes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Taxe' }],
  type: {type: String,enum: ['ACQUISITION_BIENS_SERVICES', 'FRAIS_ADMINISTRATIF'],required: true, index:true}
   
}, { timestamps: true });


const Depense = mongoose.model('Depense', depenseSchema);
export default Depense;
