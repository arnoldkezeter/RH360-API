// models/BesoinFormationPredefini.js
import mongoose from 'mongoose';

const besoinFormationPredefiniSchema = new mongoose.Schema({
  titreFr: { type: String, required: true },
  titreEn: { type: String, required: true },
  descriptionFr: { type: String },
  descriptionEn: { type: String },
  posteDeTravail: { type: mongoose.Schema.Types.ObjectId, ref: 'PosteDeTravail', required: true }, // au lieu de familleMetier
  actif: { type: Boolean, default: true }
}, { timestamps: true });

const BesoinFormationPredefini = mongoose.model('BesoinFormationPredefini', besoinFormationPredefiniSchema);
export default BesoinFormationPredefini;
