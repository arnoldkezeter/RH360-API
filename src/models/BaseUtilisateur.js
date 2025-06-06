// models/BaseUtilisateur.js
import mongoose from 'mongoose';


const BaseUtilisateurSchema = new mongoose.Schema({
    nom: {type:String,required:true},
    prenom: {type:String},
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true },
    genre: { type: String, enum: ['H', 'F'], required:true },
    dateNaissance: {type:Date},
    lieuNaissance:{type:String},
    telephone:{type:Number, required:true},
}, { timestamps: true, discriminatorKey: 'type' }); // DiscriminatorKey distingue les types d'utilisateur
BaseUtilisateurSchema.index({ nom: 1, prenom: 1 });
const BaseUtilisateur = mongoose.model('BaseUtilisateur', BaseUtilisateurSchema);
export default BaseUtilisateur;
