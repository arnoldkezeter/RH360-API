import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const TacheGeneriqueSchema = new Schema({
    titreFr: {type: String, required: true, unique: true, trim: true},
    titreEn: {type: String,required: true, unique: true, trim: true},
    descriptionFr: {type: String, trim: true},
    descriptionEn: {type: String, trim: true},
    methodeValidation: {type: String, enum: ['manuelle', 'donnees', 'fichier', 'automatique'], required: true},
}, {
    timestamps: true
});

const TacheGenerique = mongoose.model('TacheGenerique', TacheGeneriqueSchema);
export default TacheGenerique;

