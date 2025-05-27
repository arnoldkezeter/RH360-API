// models/Region.js
import mongoose from 'mongoose';

const regionSchema = new mongoose.Schema({
  code :{type:String, required:true},
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  
}, { timestamps: true });

const Region = mongoose.model('Region', regionSchema);
export default Region;