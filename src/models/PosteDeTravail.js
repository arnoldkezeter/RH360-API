// models/PosteDeTravail.js
import mongoose from 'mongoose';

const posteDeTravailSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  familleMetier: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier' },
}, { timestamps: true });

const PosteDeTravail = mongoose.model('PosteDeTravail', posteDeTravailSchema);
export default PosteDeTravail;