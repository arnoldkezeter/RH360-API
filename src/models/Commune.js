// models/Commune.js
import mongoose from 'mongoose';

const communeSchema = new mongoose.Schema({
  code:{type:String},
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  departement:{type: mongoose.Schema.Types.ObjectId, ref: 'Departement', required:true}
}, { timestamps: true });

const Commune = mongoose.model('Commune', communeSchema);
export default Commune;