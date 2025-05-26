import jwt from 'jsonwebtoken';
import Utilisateur from '../models/Utilisateur.js';
import { t } from '../utils/i18n.js';
import dotenv from 'dotenv';
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
  const lang = req.headers['accept-language'] || 'fr';
  const { email, motDePasse } = req.body;
console.log(JWT_SECRET)
  const utilisateur = await Utilisateur.findOne({ email });
  if (!utilisateur) return res.status(404).json({ error: t('utilisateur_non_trouve', lang) });

  const isMatch = await utilisateur.comparePassword(motDePasse);
  if (!isMatch) return res.status(401).json({ error: t('mp_incorrect', lang) });

  const token = jwt.sign(
    { id: utilisateur._id, role: utilisateur.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.status(200).json({ token, utilisateur, message: t('connexion_reussie', lang) });
};
