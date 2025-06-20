// models/LieuFormation.js
import mongoose from 'mongoose';

const lieuFormationSchema = new mongoose.Schema({
    lieu:{type:String, required:true},
    cohortes: [{type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte',required: true}],
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true},

}, { timestamps: true });

export const LieuFormation = mongoose.model('LieuFormation', lieuFormationSchema);
