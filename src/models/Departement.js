// models/Departement.js
import mongoose from 'mongoose';

const departementSchema = new mongoose.Schema({
  code:{type:String},
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  region:{type: mongoose.Schema.Types.ObjectId, ref: 'Region', required:true}
}, { timestamps: true });

const Departement = mongoose.model('Departement', departementSchema);
export default Departement;