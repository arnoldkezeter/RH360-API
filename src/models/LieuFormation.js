// models/LieuFormation.js
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
    postes: [posteRestrictionSchema]    // Si vide -> toute la famille est concernée
}, { _id: false });

const lieuFormationSchema = new mongoose.Schema({
    lieu: { type: String, required: true },
    cohortes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true }],
    
    // NOUVELLE STRUCTURE PARTICIPANTS (même logique que publicCible)
    participants: [familleMetierRestrictionSchema],
    formateurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Formateur' }],
    dateDebut: { type: Date },
    dateFin: { type: Date },
    dateDebutEffective: { type: Date },
    dateFinEffective: { type: Date },
    theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true },
}, { timestamps: true });

// Index pour améliorer les performances
lieuFormationSchema.index({ 'participants.familleMetier': 1 });
lieuFormationSchema.index({ 'participants.postes.poste': 1 });
lieuFormationSchema.index({ 'participants.postes.structures.structure': 1 });
lieuFormationSchema.index({ theme: 1 });
lieuFormationSchema.index({ dateDebut: 1, dateFin: 1 });

// Validation : dateDebut < dateFin
lieuFormationSchema.pre('save', function(next) {
    if (this.dateDebut && this.dateFin && this.dateDebut > this.dateFin) {
        return next(new Error('La date de début doit être antérieure à la date de fin'));
    }
    if (this.dateDebutEffective && this.dateFinEffective && this.dateDebutEffective > this.dateFinEffective) {
        return next(new Error('La date de début effective doit être antérieure à la date de fin effective'));
    }
    next();
});

// Validation : au moins une famille de métier dans participants
lieuFormationSchema.path('participants').validate(function(value) {
    return value && value.length > 0;
}, 'Les participants doivent contenir au moins une famille de métier');

/**
 * Méthode pour résoudre tous les utilisateurs ciblés par ce lieu de formation
 * Retourne un tableau d'utilisateurs uniques
 */
lieuFormationSchema.methods.resolveTargetedUsers = async function() {
    const Utilisateur = mongoose.model('Utilisateur');
    const PosteDeTravail = mongoose.model('PosteDeTravail');
    
    const targetedUsers = [];
    
    for (const familleCible of this.participants) {
        
        // 🚨 MODIFICATION ICI : Rechercher les postes qui contiennent cette famille dans leur tableau 'famillesMetier'
        const postes = await PosteDeTravail.find({ 
            famillesMetier: familleCible.familleMetier 
        }).select('_id');
        
        const posteIdsParFamille = postes.map(p => p._id);
        
        // Cas 1 : Toute la famille est ciblée (pas de restrictions sur les postes)
        if (!familleCible.postes || familleCible.postes.length === 0) {
            
            // Récupérer tous les utilisateurs de ces postes
            const users = await Utilisateur.find({
                posteDeTravail: { $in: posteIdsParFamille }
            });
            
            targetedUsers.push(...users);
        } 
        // Cas 2 : Restrictions par postes
        else {
            for (const posteRestriction of familleCible.postes) {
                
                // Vérifier si le poste ciblé est bien inclus dans les postes de cette famille
                if (!posteIdsParFamille.some(id => id.equals(posteRestriction.poste))) {
                    // Si ce poste n'appartient pas à la famille ciblée, on l'ignore (sécurité)
                    continue; 
                }

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

/**
 * Vérifie si un utilisateur spécifique est ciblé par ce lieu de formation
 * @param {string|ObjectId} userId - ID de l'utilisateur
 * @returns {Promise<boolean>}
 */
lieuFormationSchema.methods.isUserTargeted = async function(userId) {
    const Utilisateur = mongoose.model('Utilisateur');
    const PosteDeTravail = mongoose.model('PosteDeTravail');
    
    const user = await Utilisateur.findById(userId)
        .populate({ path: 'posteDeTravail', select: 'famillesMetier' }) // 🚨 POPULATION MISE À JOUR
        .populate('structure')
        .populate('service');
    
    if (!user || !user.posteDeTravail) return false;
    
    for (const familleCible of this.participants) {
        
        // 🚨 MODIFICATION ICI : Vérifier si l'ID de la famille ciblée est dans le tableau 'famillesMetier' du poste
        const targetedFamilleId = familleCible.familleMetier.toString();
        const userFamilleIds = user.posteDeTravail.famillesMetier.map(id => id.toString());
        
        if (!userFamilleIds.includes(targetedFamilleId)) {
            continue;
        }
        
        // Si l'utilisateur appartient à la famille ciblée, on continue la vérification des restrictions...
        
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
                if (!user.structure || user.structure._id.toString() !== structureRestriction.structure.toString()) {
                    continue;
                }
                
                // Pas de restriction sur les services → utilisateur ciblé
                if (!structureRestriction.services || structureRestriction.services.length === 0) {
                    return true;
                }
                
                // Vérifier les restrictions de services
                const serviceIds = structureRestriction.services.map(s => s.service.toString());
                if (user.service && serviceIds.includes(user.service._id.toString())) {
                    return true;
                }
            }
        }
    }
    
    return false;
};

/**
 * Compte le nombre d'utilisateurs ciblés
 * @returns {Promise<number>}
 */
lieuFormationSchema.methods.countTargetedUsers = async function() {
    const users = await this.resolveTargetedUsers();
    return users.length;
};

/**
 * Récupère les statistiques des participants par famille de métier
 * @returns {Promise<Array>}
 */
lieuFormationSchema.methods.getParticipantsStats = async function() {
    const stats = [];
    
    for (const familleCible of this.participants) {
        const FamilleMetier = mongoose.model('FamilleMetier');
        const famille = await FamilleMetier.findById(familleCible.familleMetier);
        
        // Compter les utilisateurs pour cette famille spécifique
        const Utilisateur = mongoose.model('Utilisateur');
        const PosteDeTravail = mongoose.model('PosteDeTravail');
        
        let count = 0;
        
        // 🚨 MODIFICATION ICI : Rechercher les postes qui contiennent cette famille
        const postesCibles = await PosteDeTravail.find({ 
            famillesMetier: familleCible.familleMetier 
        }).select('_id');
        const posteIdsParFamille = postesCibles.map(p => p._id);

        if (!familleCible.postes || familleCible.postes.length === 0) {
            
            // On compte tous les utilisateurs dont le poste est lié à cette famille
            count = await Utilisateur.countDocuments({
                posteDeTravail: { $in: posteIdsParFamille }
            });
            
        } else {
            // Compter avec restrictions
            for (const posteRestriction of familleCible.postes) {
                
                // Vérifier si le poste restreint appartient bien à la famille ciblée (sécurité)
                 if (!posteIdsParFamille.some(id => id.equals(posteRestriction.poste))) {
                    continue; 
                }

                if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                    count += await Utilisateur.countDocuments({
                        posteDeTravail: posteRestriction.poste
                    });
                } else {
                    for (const structureRestriction of posteRestriction.structures) {
                        if (!structureRestriction.services || structureRestriction.services.length === 0) {
                            count += await Utilisateur.countDocuments({
                                posteDeTravail: posteRestriction.poste,
                                structure: structureRestriction.structure
                            });
                        } else {
                            const serviceIds = structureRestriction.services.map(s => s.service);
                            count += await Utilisateur.countDocuments({
                                posteDeTravail: posteRestriction.poste,
                                service: { $in: serviceIds }
                            });
                        }
                    }
                }
            }
        }
        
        stats.push({
            familleMetier: famille,
            nombreParticipants: count,
            restrictions: familleCible.postes?.length || 0
        });
    }
    
    return stats;
};

export const LieuFormation = mongoose.model('LieuFormation', lieuFormationSchema);