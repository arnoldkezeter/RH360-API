// models/ObjectifTheme.js
import mongoose from 'mongoose';

const objectifThemeSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: {type:String},
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'}
}, { timestamps: true });

const ObjectifTheme = mongoose.model('ObjectifTheme', objectifThemeSchema);
export default ObjectifTheme;