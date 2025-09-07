// models/Rotation.js
import mongoose from 'mongoose';

const rotationSchema = new mongoose.Schema({
  stage: { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  stagiaire: { type: mongoose.Schema.Types.ObjectId, ref: "Stagiaire" }, // si stage individuel
  groupe: { type: mongoose.Schema.Types.ObjectId, ref: 'Groupe' },       // si stage groupe
  superviseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true }
}, { timestamps: true });

// Empêche un stagiaire d'avoir deux rotations qui se chevauchent dans des services différents
// rotationSchema.index(
//   { stagiaire: 1, dateDebut: 1, dateFin: 1 },
//   { unique: true, partialFilterExpression: { stagiaire: { $exists: true } } }
// );

// Empêche un groupe d'avoir deux rotations qui se chevauchent dans des services différents
rotationSchema.index(
  { groupe: 1, dateDebut: 1, dateFin: 1 },
  { unique: true, partialFilterExpression: { groupe: { $exists: true } } }
);

// Empêche qu'un service accueille deux groupes/stagiaires différents en même temps
rotationSchema.index(
  { service: 1, dateDebut: 1, dateFin: 1 },
  { unique: false }
);


export const Rotation = mongoose.model('Rotation', rotationSchema);
