// models/Formateur.js
import mongoose from 'mongoose';

const formateurSchema = new mongoose.Schema({
    utilisateur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur',required: true},
    interne:{type:Boolean, required:true},
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true},

}, { timestamps: true });

export const Formateur = mongoose.model('Formateur', formateurSchema);
