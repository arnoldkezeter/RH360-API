// models/AutoEvaluationBesoin.js
import mongoose from 'mongoose';

const autoEvaluationBesoinSchema = new mongoose.Schema({
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  besoin: { type: mongoose.Schema.Types.ObjectId, ref: 'BesoinFormationPredefini', required: true },
  niveau: { type: Number, min: 0, max: 4, required: true, default:0 }, // niveau d'auto-évaluation
  insuffisancesFr: { type: String },
  insuffisancesEn: { type: String },
  formulationBesoinsFr: { type: String },
  formulationBesoinsEn: { type: String },
  statut: {type: String,enum: ['EN_ATTENTE', 'VALIDE', 'REJETE'],default: 'EN_ATTENTE'  },
  commentaireAdminFr: { type: String },
  commentaireAdminEn: { type: String },

}, { timestamps: true });

const AutoEvaluationBesoin = mongoose.model('AutoEvaluationBesoin', autoEvaluationBesoinSchema);
export default AutoEvaluationBesoin;

