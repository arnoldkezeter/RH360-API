// models/Formation.js
import mongoose from 'mongoose';

const formationSchema = new mongoose.Schema({
  thematique: String,
  objectifs: String,
  publicCible: [String],
  salle: String,
  lieu: String,
  dateDebut: Date,
  dateFin: Date,
  dureeHeures: Number,
  formateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
  interne: Boolean,
  budgetPrevu: Number,
  budgetReel: Number,
  supports: [String],
  evaluations: {
    aChaud: String,
    parFormateur: String,
    retourExperience: String
  },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
  statistiques: {
    parGenre: Object,
    parGrade: Object,
    parService: Object,
    parTrancheAge: Object,
    parCategorieProfessionnelle: Object
  }
}, { timestamps: true });

const Formation = mongoose.model('Formation', formationSchema);
export default Formation;