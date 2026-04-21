// models/QuestionStatique.js
import mongoose from 'mongoose';

const sousQuestionSchema = new mongoose.Schema({
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    ordre: { type: Number, required: true },
    commentaireObligatoire: { type: Boolean, default: false }
}, { _id: false });

const questionStatiqueSchema = new mongoose.Schema({
    rubriqueCode: { 
        type: String, 
        required: true,
        ref: 'RubriqueStatique'
    },
    
    code: { 
        type: String, 
        required: true,
        unique: true
    },
    
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, default: '' },
    
    type: { 
        type: String, 
        enum: ['simple', 'avec_sous_questions', 'texte_libre', 'grille'],
        default: 'simple'
    },
    
    // ✅ Utilisation d'un ObjectId réel vers TypeEchelleReponse
    typeEchelle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'TypeEchelleReponse',
        default: null
    },
    
    commentaireGlobal: { type: Boolean, default: false },
    
    sousQuestions: [sousQuestionSchema],
    
    ordre: { type: Number, required: true },
    
    supprimable: { type: Boolean, default: true },
    duplicable: { type: Boolean, default: true },
    actif: { type: Boolean, default: true }
    
}, { timestamps: true });

questionStatiqueSchema.index({ rubriqueCode: 1, ordre: 1 });
questionStatiqueSchema.index({ code: 1 });

const QuestionStatique = mongoose.model('QuestionStatique', questionStatiqueSchema);
export default QuestionStatique;