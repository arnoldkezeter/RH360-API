// models/Service.js
import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: String
}, { timestamps: true });

const Service = mongoose.model('Service', serviceSchema);
export default Service;