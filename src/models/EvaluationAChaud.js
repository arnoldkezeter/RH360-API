//../models/EvaluationAChaud
import mongoose from 'mongoose';


const SousQuestionSchema = new mongoose.Schema({
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, required: true },
    commentaireObligatoire: { type: Boolean, default: false },
    ordre: { type: Number, required: true }
}, { _id: true });

const QuestionSchema = new mongoose.Schema({
    libelleFr: { type: String, required: true },
    libelleEn: { type: String, required: true },
    echelles: [{type: mongoose.Schema.Types.ObjectId, ref: 'EchelleReponse', required: true}],
    sousQuestions: [SousQuestionSchema], // vide si question simple
    commentaireGlobal: { type: Boolean, default: false }, // si true, champ commentaire à l’échelle de la question
    ordre: { type: Number, required: true }
}, { _id: true });

const RubriqueSchema = new mongoose.Schema({
    titreFr: { type: String, required: true },
    titreEn: { type: String, required: true },
    ordre: { type: Number, required: true },
    questions: [QuestionSchema]
}, { _id: true });

const EvaluationChaudSchema = new mongoose.Schema({
    titreFr: { type: String, required: true },
    titreEn: { type: String, required: true },
    theme: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeFormation', required: true },
    descriptionFr: {type:String},
    descriptionEn: {type:String},
    rubriques: [RubriqueSchema],
    actif: { type: Boolean, default: true },
}, { timestamps: true });



const EvaluationChaud = mongoose.model('EvaluationChaud', EvaluationChaudSchema);
export default EvaluationChaud;
