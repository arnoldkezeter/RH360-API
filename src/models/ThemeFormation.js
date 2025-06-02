// models/ThemeFormation.js
import mongoose from 'mongoose';

const themeFormationSchema = new mongoose.Schema({
    titreFr: {type:String, required:true},
    titreEn: {type:String, required:true},
    publicCible: [{type: mongoose.Schema.Types.ObjectId, ref: 'PosteDeTravail'}],
    lieux: [{lieu:{type : String}, cohorte:{type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte'}}],
    dateDebut: {type : Date},
    dateFin: {type : Date},
    formateurs: [{formateur:{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }, interne:{type:Boolean}}],
    responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
    supports: [{type:String}],
    formation:{type: mongoose.Schema.Types.ObjectId, ref: 'Formation'},
    nbTachesTotal:{type:Number}, //Enregistrer le nombre total de tache du thème
    nbTachesExecutees:{type:Number} //Enregistrer le nombre total de tache executée du thème
}, { timestamps: true });

const ThemeFormation = mongoose.model('ThemeFormation', themeFormationSchema);
export default ThemeFormation;