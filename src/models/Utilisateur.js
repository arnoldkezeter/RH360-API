// models/Utilisateur.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const utilisateurSchema = new mongoose.Schema({
    matricule:{type:String},
    nom: {type:String,required:true},
    prenom: {type:String},
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true },
    genre: { type: String, enum: ['H', 'F'], required:true },
    dateNaissance: {type:Date},
    lieuNaissance:{type:String},
    telephone:{type:Number},
    role: {
      type: String,
      enum: ['ADMIN', 'RESPONSABLE_FORMATION', 'UTILISATEUR', 'FORMATEUR'],
      default: 'UTILISATEUR',
      required:true
    },
    dateEntreeEnService:{type:Date},
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service'},
    categorieProfessionnelle: { type: mongoose.Schema.Types.ObjectId, ref: 'CategorieProfessionnelle' },
    postesDeTravail: [{posteDeTravail:{ type: mongoose.Schema.Types.ObjectId, ref: 'posteDeTravail' },annee:{type:Number, }}],
    actif: { type: Boolean, default: true },
}, { timestamps: true });

utilisateurSchema.pre('save', async function (next) {
    if (!this.isModified('motDePasse')) return next();
    this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
    next();
});

utilisateurSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.motDePasse);
};

const Utilisateur = mongoose.model('Utilisateur', utilisateurSchema);
export default Utilisateur;
