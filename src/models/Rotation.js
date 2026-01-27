// models/Rotation.js
import mongoose from 'mongoose';

const rotationSchema = new mongoose.Schema({
  stage: { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
  structure: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure', required: true },
  stagiaire: { type: mongoose.Schema.Types.ObjectId, ref: "Stagiaire" }, // si stage individuel
  groupe: { type: mongoose.Schema.Types.ObjectId, ref: 'Groupe' },       // si stage groupe
  superviseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true }
}, { timestamps: true });



// Empêche un groupe d'avoir deux rotations qui se chevauchent dans des structures différents
rotationSchema.index(
  { groupe: 1, dateDebut: 1, dateFin: 1 },
  { unique: true, partialFilterExpression: { groupe: { $exists: true } } }
);

// Empêche qu'un structure accueille deux groupes/stagiaires différents en même temps
rotationSchema.index(
  { structure: 1, dateDebut: 1, dateFin: 1 },
  { unique: false }
);


export const Rotation = mongoose.model('Rotation', rotationSchema);
