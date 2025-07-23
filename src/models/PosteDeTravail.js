// models/PosteDeTravail.js
import mongoose from 'mongoose';

const posteDeTravailSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  famillesMetier: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier', required:true }],
}, { timestamps: true });

const PosteDeTravail = mongoose.model('PosteDeTravail', posteDeTravailSchema);
export default PosteDeTravail;