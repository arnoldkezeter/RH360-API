// models/BaseUtilisateur.js
import mongoose from 'mongoose';


const BaseUtilisateurSchema = new mongoose.Schema({
    nom: {type:String,required:true},
    prenom: {type:String},
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true },
    genre: { type: String, enum: ['M', 'F'], required:true },
    dateNaissance: {type:Date},
    lieuNaissance:{type:String},
    telephone:{type:String, required:true},
    photoProfil:{type:String},
    commune:{type: mongoose.Schema.Types.ObjectId, ref: 'Commune'},
}, { timestamps: true, discriminatorKey: 'type' }); // DiscriminatorKey distingue les types d'utilisateur
BaseUtilisateurSchema.index({ nom: 1, prenom: 1 });
BaseUtilisateurSchema.index({ email: 1 }, { unique: true });
const BaseUtilisateur = mongoose.model('BaseUtilisateur', BaseUtilisateurSchema);
export default BaseUtilisateur;
