// models/Cohorte.js
import mongoose from 'mongoose';

const cohorteSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  utilisateur: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
}, { timestamps: true });

const Cohorte = mongoose.model('Cohorte', cohorteSchema);
export default Cohorte;