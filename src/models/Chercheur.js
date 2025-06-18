// models/Chercheur.js
import mongoose from 'mongoose';
import BaseUtilisateur from './BaseUtilisateur.js';

const ChercheurSchema = new mongoose.Schema({
    domaineRecherche: { type: String, required: true }, // Domaine de recherche spécifique
    etablissement: {type: mongoose.Schema.Types.ObjectId, ref: 'Etablissement'},
    mandat:{type: mongoose.Schema.Types.ObjectId, ref: 'Mandat'}
});

const Chercheur = BaseUtilisateur.discriminator('Chercheur', ChercheurSchema);
export default Chercheur