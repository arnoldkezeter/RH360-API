import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const TacheGeneriqueSchema = new Schema({
    nomFr: {type: String, required: true, unique: true, trim: true},
    nomEn: {type: String,required: true, unique: true, trim: true},
    descriptionFr: {type: String, trim: true},
    descriptionEn: {type: String, trim: true},
    methodeValidation: {type: String, enum: ['MANUELLE', 'DONNEES', 'FICHIER', 'AUTOMATIQUE'], required: true},
}, {
    timestamps: true
});

const TacheGenerique = mongoose.model('TacheGenerique', TacheGeneriqueSchema);
export default TacheGenerique;

