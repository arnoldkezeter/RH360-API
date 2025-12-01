// models/ThemeFormation.js
import mongoose from 'mongoose';

const serviceRestrictionSchema = new mongoose.Schema({
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }
}, { _id: false });

const structureRestrictionSchema = new mongoose.Schema({
    structure: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
    services: [serviceRestrictionSchema]
}, { _id: false });

const posteRestrictionSchema = new mongoose.Schema({
    poste: { type: mongoose.Schema.Types.ObjectId, ref: 'PosteDeTravail' },
    structures: [structureRestrictionSchema]
}, { _id: false });

const familleMetierRestrictionSchema = new mongoose.Schema({
    familleMetier: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilleMetier', required: true },
    postes: [posteRestrictionSchema]   // Si vide -> toute la famille est concernée
}, { _id: false });

const themeFormationSchema = new mongoose.Schema({
    titreFr: { type: String, required: true },
    titreEn: { type: String, required: true },

    // NOUVELLE STRUCTURE PUBLIC CIBLE
    publicCible: [familleMetierRestrictionSchema],

    dateDebut: { type: Date },
    dateFin: { type: Date },

    formateurs: [{
        formateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
        interne: { type: Boolean }
    }],

    responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' },
    supports: [{ type: String }],
    formation: { type: mongoose.Schema.Types.ObjectId, ref: 'Formation' },

    nbTachesTotal: { type: Number },
    nbTachesExecutees: { type: Number }
}, { timestamps: true });

themeFormationSchema.index({ 'publicCible.familleMetier': 1 });
themeFormationSchema.index({ 'publicCible.postes.poste': 1 });
themeFormationSchema.index({ 'publicCible.postes.structures.structure': 1 });
themeFormationSchema.index({ formation: 1 });
themeFormationSchema.index({ responsable: 1 });

// Validation : dateDebut < dateFin
themeFormationSchema.pre('save', function(next) {
    if (this.dateDebut && this.dateFin && this.dateDebut > this.dateFin) {
        next(new Error('La date de début doit être antérieure à la date de fin'));
    }
    next();
});

// Validation : au moins une famille de métier dans publicCible
// themeFormationSchema.path('publicCible').validate(function(value) {
//     return value && value.length > 0;
// }, 'Le public cible doit contenir au moins une famille de métier');


themeFormationSchema.methods.resolveTargetedUsers = async function() {
    const Utilisateur = mongoose.model('Utilisateur');
    const PosteDeTravail = mongoose.model('PosteDeTravail');
    
    const targetedUsers = [];
    
    for (const familleCible of this.publicCible) {
        // Cas 1 : Toute la famille (pas de restrictions sur les postes)
        if (!familleCible.postes || familleCible.postes.length === 0) {
            // Récupérer tous les postes de cette famille
            const postes = await PosteDeTravail.find({ 
                familleMetier: familleCible.familleMetier 
            }).select('_id');
            
            const posteIds = postes.map(p => p._id);
            
            // Récupérer tous les utilisateurs de ces postes
            const users = await Utilisateur.find({
                posteDeTravail: { $in: posteIds }
            });
            
            targetedUsers.push(...users);
        } 
        // Cas 2 : Restrictions par postes
        else {
            for (const posteRestriction of familleCible.postes) {
                // Cas 2a : Toutes les structures du poste
                if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                    const users = await Utilisateur.find({
                        posteDeTravail: posteRestriction.poste
                    });
                    targetedUsers.push(...users);
                }
                // Cas 2b : Restrictions par structures
                else {
                    for (const structureRestriction of posteRestriction.structures) {
                        // Cas 2b-i : Tous les services de la structure
                        if (!structureRestriction.services || structureRestriction.services.length === 0) {
                            const users = await Utilisateur.find({
                                posteDeTravail: posteRestriction.poste,
                                structure: structureRestriction.structure
                            });
                            targetedUsers.push(...users);
                        }
                        // Cas 2b-ii : Services spécifiques
                        else {
                            const serviceIds = structureRestriction.services.map(s => s.service);
                            const users = await Utilisateur.find({
                                posteDeTravail: posteRestriction.poste,
                                service: { $in: serviceIds }
                            });
                            targetedUsers.push(...users);
                        }
                    }
                }
            }
        }
    }
    
    // Dédupliquer les utilisateurs
    const uniqueUsers = [...new Map(targetedUsers.map(u => [u._id.toString(), u])).values()];
    return uniqueUsers;
};

themeFormationSchema.methods.isUserTargeted = async function(userId) {
    const Utilisateur = mongoose.model('Utilisateur');
    const PosteDeTravail = mongoose.model('PosteDeTravail');
    
    const user = await Utilisateur.findById(userId)
        .populate('posteDeTravail')
        .populate('structure')
        .populate('service');
    
    if (!user) return false;
    
    for (const familleCible of this.publicCible) {
        // Vérifier si le poste de l'utilisateur appartient à cette famille
        if (user.posteDeTravail.familleMetier.toString() !== familleCible.familleMetier.toString()) {
            continue;
        }
        
        // Pas de restriction sur les postes → utilisateur ciblé
        if (!familleCible.postes || familleCible.postes.length === 0) {
            return true;
        }
        
        // Vérifier les restrictions de postes
        for (const posteRestriction of familleCible.postes) {
            if (user.posteDeTravail._id.toString() !== posteRestriction.poste.toString()) {
                continue;
            }
            
            // Pas de restriction sur les structures → utilisateur ciblé
            if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                return true;
            }
            
            // Vérifier les restrictions de structures
            for (const structureRestriction of posteRestriction.structures) {
                if (user.structure._id.toString() !== structureRestriction.structure.toString()) {
                    continue;
                }
                
                // Pas de restriction sur les services → utilisateur ciblé
                if (!structureRestriction.services || structureRestriction.services.length === 0) {
                    return true;
                }
                
                // Vérifier les restrictions de services
                const serviceIds = structureRestriction.services.map(s => s.service.toString());
                if (serviceIds.includes(user.service._id.toString())) {
                    return true;
                }
            }
        }
    }
    
    return false;
};

const ThemeFormation = mongoose.model('ThemeFormation', themeFormationSchema);
export default ThemeFormation;
