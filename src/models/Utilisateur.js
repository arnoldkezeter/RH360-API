// models/Utilisateur.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const utilisateurSchema = new mongoose.Schema({
  nom: String,
  prenom: String,
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  genre: { type: String, enum: ['Homme', 'Femme', 'Autre'] },
  dateNaissance: Date,
  grade: String,
  categorieProfessionnelle: String,
  role: {
    type: String,
    enum: ['ADMIN', 'RESPONSABLE_RH', 'MANAGER', 'EMPLOYE', 'FORMATEUR'],
    default: 'EMPLOYE'
  },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  familleMetier: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier' },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

utilisateurSchema.pre('save', async function (next) {
  if (!this.isModified('motDePasse')) return next();
  this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
  next();
});

utilisateurSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.motDePasse);
};

const Utilisateur = mongoose.model('Utilisateur', utilisateurSchema);
export default Utilisateur;
