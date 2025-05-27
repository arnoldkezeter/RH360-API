// models/AxeStrategique.js
import mongoose from 'mongoose';

const axeStrategiqueSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String}
}, { timestamps: true });

const AxeStrategique = mongoose.model('AxeStrategique', axeStrategiqueSchema);
export default AxeStrategique;