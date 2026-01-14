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
    postes: [posteRestrictionSchema]
}, { _id: false });

const themeFormationSchema = new mongoose.Schema({
    titreFr: { type: String, required: true },
    titreEn: { type: String, required: true },

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

// ✅ Indexes existants
themeFormationSchema.index({ 'publicCible.familleMetier': 1 });
themeFormationSchema.index({ 'publicCible.postes.poste': 1 });
themeFormationSchema.index({ 'publicCible.postes.structures.structure': 1 });
themeFormationSchema.index({ formation: 1 });
themeFormationSchema.index({ responsable: 1 });

// ✅ NOUVEAU: Relation virtuelle avec les dépenses
themeFormationSchema.virtual('depenses', {
    ref: 'Depense',
    localField: '_id',
    foreignField: 'themeFormation'
});

// ✅ NOUVEAU: Méthode pour obtenir le budget total prévu
themeFormationSchema.methods.getBudgetTotalPrevu = async function() {
    const Depense = mongoose.model('Depense');
    return await Depense.getTotalDepensesPrevuesTheme(this._id);
};

// ✅ NOUVEAU: Méthode pour obtenir le budget total réel
themeFormationSchema.methods.getBudgetTotalReel = async function() {
    const Depense = mongoose.model('Depense');
    return await Depense.getTotalDepensesReellesTheme(this._id);
};

// ✅ NOUVEAU: Méthode pour obtenir le taux d'exécution budgétaire
themeFormationSchema.methods.getTauxExecutionBudgetaire = async function() {
    const budgetPrevu = await this.getBudgetTotalPrevu();
    const budgetReel = await this.getBudgetTotalReel();
    
    if (!budgetPrevu || budgetPrevu === 0) return 0;
    
    return (budgetReel / budgetPrevu) * 100;
};

// ✅ NOUVEAU: Méthode pour obtenir les dépenses par type
themeFormationSchema.methods.getDepensesParType = async function(type) {
    const Depense = mongoose.model('Depense');
    return await Depense.getDepensesParType(this._id, type);
};

// Validation existante : dateDebut < dateFin
themeFormationSchema.pre('save', function(next) {
    if (this.dateDebut && this.dateFin && this.dateDebut > this.dateFin) {
        next(new Error('La date de début doit être antérieure à la date de fin'));
    }
    next();
});

// Méthodes existantes pour le public cible
themeFormationSchema.methods.resolveTargetedUsers = async function() {
    const Utilisateur = mongoose.model('Utilisateur');
    const PosteDeTravail = mongoose.model('PosteDeTravail');
    
    const targetedUsers = [];
    
    for (const familleCible of this.publicCible) {
        if (!familleCible.postes || familleCible.postes.length === 0) {
            const postes = await PosteDeTravail.find({ 
                familleMetier: familleCible.familleMetier 
            }).select('_id');
            
            const posteIds = postes.map(p => p._id);
            
            const users = await Utilisateur.find({
                posteDeTravail: { $in: posteIds }
            });
            
            targetedUsers.push(...users);
        } 
        else {
            for (const posteRestriction of familleCible.postes) {
                if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                    const users = await Utilisateur.find({
                        posteDeTravail: posteRestriction.poste
                    });
                    targetedUsers.push(...users);
                }
                else {
                    for (const structureRestriction of posteRestriction.structures) {
                        if (!structureRestriction.services || structureRestriction.services.length === 0) {
                            const users = await Utilisateur.find({
                                posteDeTravail: posteRestriction.poste,
                                structure: structureRestriction.structure
                            });
                            targetedUsers.push(...users);
                        }
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
        if (user.posteDeTravail.familleMetier.toString() !== familleCible.familleMetier.toString()) {
            continue;
        }
        
        if (!familleCible.postes || familleCible.postes.length === 0) {
            return true;
        }
        
        for (const posteRestriction of familleCible.postes) {
            if (user.posteDeTravail._id.toString() !== posteRestriction.poste.toString()) {
                continue;
            }
            
            if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                return true;
            }
            
            for (const structureRestriction of posteRestriction.structures) {
                if (user.structure._id.toString() !== structureRestriction.structure.toString()) {
                    continue;
                }
                
                if (!structureRestriction.services || structureRestriction.services.length === 0) {
                    return true;
                }
                
                const serviceIds = structureRestriction.services.map(s => s.service.toString());
                if (serviceIds.includes(user.service._id.toString())) {
                    return true;
                }
            }
        }
    }
    
    return false;
};

// ✅ Activer les virtuals dans la conversion JSON
themeFormationSchema.set('toJSON', { virtuals: true });
themeFormationSchema.set('toObject', { virtuals: true });

const ThemeFormation = mongoose.model('ThemeFormation', themeFormationSchema);
export default ThemeFormation;