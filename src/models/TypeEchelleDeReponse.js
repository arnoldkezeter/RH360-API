// models/TypeEchelleReponse.js
import mongoose from 'mongoose';

const typeEchelleReponse = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: { type: String},
  descriptionEn: { type: String},
}, { timestamps: true });

const TypeEchelleReponse = mongoose.model('TypeEchelleReponse', typeEchelleReponse);
export default TypeEchelleReponse;