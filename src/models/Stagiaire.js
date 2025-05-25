// models/Stagiaire.js
import mongoose from 'mongoose';

const parcoursSchema = new mongoose.Schema({
  annee: { type: Number, required: true },
  etablissement: {type: mongoose.Schema.Types.ObjectId, ref: 'Etablissement'},
  filiere: { type: String },
  option: { type: String },
  niveau: { type: String }
}, { _id: false });

const stagiaireSchema = new mongoose.Schema({
  nom: {type:String,required:true},
  prenom: {type:String},
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  genre: { type: String, enum: ['H', 'F'], required:true },
  dateNaissance: {type:Date},
  lieuNaissance:{type:String},
  telephone:{type:Number, required:true},
  parcours:[parcoursSchema],
  actif: { type: Boolean, default: true },
}, { timestamps: true });

const Stagiaire = mongoose.model('Stagiaire', stagiaireSchema);
export default Stagiaire;
