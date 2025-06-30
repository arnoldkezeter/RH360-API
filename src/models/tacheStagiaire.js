import mongoose from 'mongoose';

const TacheStagiaireSchema = new mongoose.Schema({
  nomFr: {type: String, required: true},
  nomEn: {type: String, required: true},
  descriptionFr: {type: String,required: false},
  descriptionEn: {type: String,required: false},
  date: {type: Date, required: true,},
  status: {type: String, enum: ['COMPLETE', 'EN_COURS', 'ABSENT'], default: 'EN_COURS'},
  stagiaire: {type: mongoose.Schema.Types.ObjectId, ref: 'Stagiaire', required: true},
  bloque: {type: Boolean,default: false}
}, { timestamps: true });

// Middleware pour verrouiller automatiquement les tâches après 7 jours
TacheStagiaireSchema.pre('save', function (next) {
  if (!this.isNew) {
    const septJourPasse = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (this.createdAt <= septJourPasse && !this.isModified('bloque')) {
      this.bloque = true;
    }
  }
  next();
});

// Ajout d'un index pour améliorer les performances de recherche
TacheStagiaireSchema.index({ stagiaire: 1, date: 1 });

const TacheStagiaire = mongoose.model('TacheStagiaire', TacheStagiaireSchema);
export default TacheStagiaire