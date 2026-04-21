// models/RubriqueStatique.js
import mongoose from 'mongoose';

/**
 * Modèle pour les rubriques statiques stockées en base
 * L'admin peut les modifier via l'interface d'administration
 */
const rubriqueStatiqueSchema = new mongoose.Schema({
    // Identifiant unique pour référence (PROFIL, ORGANISATION, etc.)
    code: { 
        type: String, 
        required: true, 
        unique: true,
        uppercase: true,
        enum: ['PROFIL', 'ORGANISATION', 'CONTENU_PEDAGOGIQUE', 'APPRENTISSAGE']
    },
    
    // Titres bilingues
    titreFr: { type: String, required: true },
    titreEn: { type: String, required: true },
    
    // Description optionnelle
    descriptionFr: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    
    // Ordre d'affichage par défaut
    ordre: { type: Number, required: true },
    
    // Est-ce que cette rubrique peut être masquée par l'utilisateur ?
    masquable: { type: Boolean, default: true },
    
    // Est-ce que l'utilisateur peut ajouter des questions personnalisées ?
    questionsPersonnalisables: { type: Boolean, default: true },
    
    // Est-ce que l'utilisateur peut supprimer des questions par défaut ?
    questionsSupprimables: { type: Boolean, default: true },
    
    // Actif/inactif (soft delete)
    actif: { type: Boolean, default: true },
    
    // Version pour suivi des modifications
    version: { type: Number, default: 1 }
    
}, { timestamps: true });

// Index pour recherche rapide
rubriqueStatiqueSchema.index({ code: 1, actif: 1 });

const RubriqueStatique = mongoose.model('RubriqueStatique', rubriqueStatiqueSchema);
export default RubriqueStatique;