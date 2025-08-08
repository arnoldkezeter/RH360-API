// models/Stagiaire.js
import mongoose from 'mongoose';
import BaseUtilisateur from './BaseUtilisateur.js';

const parcoursSchema = new mongoose.Schema({
  annee: { type: Number, required: true },
  etablissement: {type: mongoose.Schema.Types.ObjectId, ref: 'Etablissement'},
  filiere: { type: String },
  option: { type: String },
  niveau: { type: String }
}, { _id: false });

const StagiaireSchema = new mongoose.Schema({
    parcours:[parcoursSchema],
    actif: { type: Boolean, default: true },
    stages:[{type: mongoose.Schema.Types.ObjectId, ref: 'Stage'}]
});
StagiaireSchema.index({ "parcours.etablissement": 1 });
const Stagiaire = BaseUtilisateur.discriminator('Stagiaire', StagiaireSchema);
export default Stagiaire;
