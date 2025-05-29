// models/ObjectifTheme.js
import mongoose from 'mongoose';

const objectifThemeSchema = new mongoose.Schema({
  nomFr: { type: String, required: true },
  nomEn: { type: String, required: true },
  descriptionFr: {type:String},
  descriptionEn: {type:String},
  theme:{type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation'}
}, { timestamps: true });

const ObjectifTheme = mongoose.model('ObjectifTheme', objectifThemeSchema);
export default ObjectifTheme;