// models/AxeStrategique.js
import mongoose from 'mongoose';

const axeStrategiqueSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: String
}, { timestamps: true });

const AxeStrategique = mongoose.model('AxeStrategique', axeStrategiqueSchema);
export default AxeStrategique;