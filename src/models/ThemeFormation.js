// models/ThemeFormation.js
import mongoose from 'mongoose';

const themeFormationSchema = new mongoose.Schema({
  titre: {type:String, required:true},
  publicCible: [{type: mongoose.Schema.Types.ObjectId, ref: 'PosteDeTravail'}],
  lieux: [{lieu:{type : String}, cohorte:{type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte'}}],
  dateDebut: {type : Date},
  dateFin: {type : Date},
  dureeHeures: Number,
  formateurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
  interne: Boolean,
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

const ThemeFormation = mongoose.model('ThemeFormation', themeFormationSchema);
export default ThemeFormation;