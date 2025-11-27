// models/NoteService.js
import mongoose from 'mongoose';

const noteServiceSchema = new mongoose.Schema({
    reference: {type:String},
    theme: {type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'},
    stage: {type: mongoose.Schema.Types.ObjectId, ref: 'Stage'},
    mandat: {type: mongoose.Schema.Types.ObjectId, ref: 'StageRecherche'},
    typeNote: {type:String, enum:["convocation", "acceptation_stage", "mandat", "fiche_presence"]},
    sousTypeConvocation: {
        type: String,
        enum: ['participants', 'formateurs'],
        required: function() {
            return this.typeNote === 'convocation';
        }
    },
    titreFr:{type:String},
    titreEn:{type:String},
    descriptionFr:{type:String},
    descriptionEn:{type:String},
    copieA: {type:String},
    designationTuteur:{type:String},
    miseEnOeuvre:{type:String},
    dispositions:{type:String},
    personnesResponsables:{type:String},
    fichierJoint :  {type:String},// note signée scannée
    creePar:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
    valideParDG: {type:Boolean},
    filePath:{type:String}
}, { timestamps: true });

const NoteService = mongoose.model('NoteService', noteServiceSchema);
export default NoteService;