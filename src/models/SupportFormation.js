// models/SupportFormation.js
import mongoose from 'mongoose';

const supportFormationSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'}
}, { timestamps: true });

const SupportFormation = mongoose.model('SupportFormation', supportFormationSchema);
export default SupportFormation;