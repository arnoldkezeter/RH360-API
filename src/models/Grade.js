// models/Grade.js
import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type : String},
  descriptionEn: {type : String}
}, { timestamps: true });

const Grade = mongoose.model('Grade', gradeSchema);
export default Grade;