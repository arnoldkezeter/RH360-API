// models/Taxe.js
import mongoose from 'mongoose';

const taxeSchema = new mongoose.Schema({
  nature: { type: String, required: true },
  taux: {type:Number, required:true},
}, { timestamps: true });

const Taxe = mongoose.model('Taxe', taxeSchema);
export default Taxe;