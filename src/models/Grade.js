// models/Grade.js
import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type : String}
}, { timestamps: true });

const Grade = mongoose.model('Grade', gradeSchema);
export default Grade;