// models/EchelleReponse.js
import mongoose from 'mongoose';

const echelleReponse = new mongoose.Schema({
  typeEchelle:{type: mongoose.Schema.Types.ObjectId, ref: 'TypeEchelleReponse', required: true},
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  ordre: {type:Number, required: true},
}, { timestamps: true });

const EchelleReponse = mongoose.model('EchelleReponse', echelleReponse);
export default EchelleReponse;