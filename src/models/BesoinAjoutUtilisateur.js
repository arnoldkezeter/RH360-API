// models/BesoinAjouteUtilisateur.js
import mongoose from 'mongoose';

const besoinAjouteUtilisateurSchema = new mongoose.Schema({
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  titreFr: { type: String, required: true },
  titreEn: { type: String, required: true },
  descriptionFr: { type: String },
  descriptionEn: { type: String },
  pointsAAmeliorerFr: { type: String },
  pointsAAmeliorerEn: { type: String },
  statut: {type: String, enum: ['EN_ATTENTE', 'VALIDE', 'REJETE'], default: 'EN_ATTENTE'},
  commentaireAdminFr: { type: String },
  commentaireAdminEn: { type: String },

}, { timestamps: true });

const BesoinAjouteUtilisateur = mongoose.model('BesoinAjouteUtilisateur', besoinAjouteUtilisateurSchema);
export default BesoinAjouteUtilisateur;
