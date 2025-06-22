// models/Objectif.js
import mongoose from 'mongoose';

const objectifSchema = new mongoose.Schema({
    nomFr:{type:String, required:true},
    nomEn:{type:String, required:true},
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true},

}, { timestamps: true });

export const Objectif = mongoose.model('Objectif', objectifSchema);
