// models/PlanFormation.js
import mongoose from 'mongoose';

const planFormationSchema = new mongoose.Schema({
  titre: String,
  annee: Number,
  formations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Formation' }]
}, { timestamps: true });

const PlanFormation = mongoose.model('PlanFormation', planFormationSchema);
export default PlanFormation;