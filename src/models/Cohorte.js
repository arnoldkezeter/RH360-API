// models/Cohorte.js
import mongoose from 'mongoose';

const cohorteSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
}, { timestamps: true });

const Cohorte = mongoose.model('Cohorte', cohorteSchema);
export default Cohorte;