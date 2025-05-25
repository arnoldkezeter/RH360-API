// models/Service.js
import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  chefService:{type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur'},
  structure:{type: mongoose.Schema.Types.ObjectId, ref: 'Structure'},
  nbPlaceStage:{type:Number}
}, { timestamps: true });

const Service = mongoose.model('Service', serviceSchema);
export default Service;