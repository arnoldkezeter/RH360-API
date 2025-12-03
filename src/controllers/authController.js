import jwt from 'jsonwebtoken';
import Utilisateur from '../models/Utilisateur.js';
import { t } from '../utils/i18n.js';
import dotenv from 'dotenv';
import { comparePassword } from '../utils/password.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const register = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const utilisateur = new Utilisateur(req.body);
    await utilisateur.save();
    res.status(201).json(t('inscription_reussie', lang));
  } catch (err) {
    res.status(400).json({ error: t('erreur_inscription', lang), details: err.message });
  }
};


export const login = async (req, res) => {
  try {
    console.log("login")
    const lang = req.headers['accept-language'] || 'fr'; // Langue par défaut: 'fr'
    const { email, motDePasse } = req.body;

    // Vérification des champs requis
    if (!email || !motDePasse) {
        return res.status(400).json({ 
          success:false,
          error: t('champs_obligatoires', lang) 
        });
    }

    // Recherche de l'utilisateur
    const utilisateur = await Utilisateur.findOne({ email });
    if (!utilisateur) {
      return res.status(404).json({
          success:false,
          message: t('utilisateur_non_trouve', lang) 
        });
    }
    // Vérification du mot de passe
    const isMatch = await utilisateur.comparePassword(motDePasse); // Supposons que la méthode comparePassword est définie dans le modèle
    if (!isMatch) {
      return res.status(401).json({ error: t('mp_incorrect', lang) });
    }
    // Génération du token JWT
    const token = jwt.sign(
      { _id: utilisateur._id, role: utilisateur.role, roles:utilisateur?.roles||[utilisateur.role], nom:utilisateur.nom, prenom:utilisateur.prenom, email:utilisateur.email, genre:utilisateur.genre, actif:utilisateur.actif, photoDeProfil:utilisateur.photoDeProfil }, // Payload
      process.env.JWT_SECRET, // Secret key
      { expiresIn: '8h' } // Durée de validité
    );

    // Réponse de succès
    return res.status(200).json({
      success : true,
      token,
      utilisateur: {
        _id: utilisateur._id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
      message: t('connexion_reussie', lang),
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return res.status(500).json({
      success:false,
      error: t('erreur_serveur', lang) 
    });
  }
};

export const verifyPasswordController = async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;
  const lang = req.headers['accept-language'] || 'fr';
  if (!password){
    return res.status(400).json({ 
      success: false, 
      message: t('mot_de_passe_requis', lang)
    });
  } 

  try {
    const user = await Utilisateur.findById(userId).select('+motDePasse');
    if (!user) return res.status(404).json({ success: false, message: t('utilisateur_non_trouve') });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: t('mot_de_passe_incorrect', lang) 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: t('mot_de_passe_modifie', lang) 
    });
  } catch (error) {
    console.error('verifyPasswordController error:', error);
    return res.status(500).json({ success: false, message: t('erreur_serveur', lang) });
  }
};



