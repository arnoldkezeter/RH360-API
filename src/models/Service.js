// models/Service.js
import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  chefService:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
  structure:{type: mongoose.Schema.Types.ObjectId, ref: 'Structure'},
  nbPlaceStage:{type:Number, default:0}
}, { timestamps: true });

const Service = mongoose.model('Service', serviceSchema);
export default Service;