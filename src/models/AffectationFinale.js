// models/AffectationFinale.js
import mongoose from 'mongoose';

const affectationFinaleSchema = new mongoose.Schema({
  stage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage", required: true },

  stagiaire: { type: mongoose.Schema.Types.ObjectId, ref: "Stagiaire" }, // si individuel
  groupe: { type: mongoose.Schema.Types.ObjectId, ref: "Groupe" },       // si groupe

  structure: { type: mongoose.Schema.Types.ObjectId, ref: "Structure", required: true },
  superviseur: { type: mongoose.Schema.Types.ObjectId, ref: "Utilisateur" },
  dateDebut:{type:Date, required:true},
  dateFin:{type:Date, required:true}
}, { timestamps: true });

// affectationFinaleSchema.index({ stagiaire: 1, stage: 1 });
// affectationFinaleSchema.index(
//   { groupe: 1, stage: 1 },
//   { unique: true, partialFilterExpression: { groupe: { $ne: null } } }
// );
affectationFinaleSchema.index({ structure: 1 });

export const AffectationFinale = mongoose.model('AffectationFinale', affectationFinaleSchema);
