// models/HistoriqueAction.js
import mongoose from 'mongoose';

const historiqueActionSchema = new mongoose.Schema({
    utilisateur: {type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: false },// null pour opérations automatisées
    typeAction: {type: String, required: true, enum: ['CREATION', 'MODIFICATION', 'SUPPRESSION', 'CONSULTATION', 'AUTOMATIQUE'],},
    description: {type: String, required: true},
    moduleConcerne: {type: String, required: true},
    donneesSupplementaires: {type: mongoose.Schema.Types.Mixed, default: {}},
    date: {type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('HistoriqueAction', historiqueActionSchema);
