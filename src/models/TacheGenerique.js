// models/Tache.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const TacheGeneriqueSchema = new Schema({
    ordre:{type:Number, required:true},
    code: { type: String, required: true, unique: true }, // ex: 'budget_elaboration'
    nomFr: { type: String, required: true },
    nomEn: { type: String, required: true },
    descriptionFr: { type: String },
    descriptionEn: { type: String },
    niveau:{type:String,enum:['pre-formation', 'pendant-formation', 'post-formation'], required:true},
    type: {type: String, enum: ['form', 'checkbox', 'upload', 'autoGenerate', 'email', 'evaluation', 'table-form'], required: true,},
    obligatoire: { type: Boolean, default: true },
    actif: { type: Boolean, default: true },
}, {
    timestamps: true
});

const TacheGenerique = mongoose.model('TacheGenerique', TacheGeneriqueSchema);
export default TacheGenerique;