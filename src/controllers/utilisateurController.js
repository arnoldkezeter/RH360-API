// controllers/utilisateurController.js
import Utilisateur from '../models/Utilisateur.js';
import CategorieProfessionnelle from '../models/CategorieProfessionnelle.js';
import Service from '../models/Service.js';
import FamilleMetier from '../models/FamilleMetier.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { generateRandomPassword } from '../utils/generatePassword.js';
import { sendAccountEmail } from '../utils/sendMail.js';

// Créer un utilisateur
export const createUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const {
            matricule, nom, prenom, email, genre, dateNaissance, lieuNaissance, telephone,
            role, dateEntreeEnService, service, categorieProfessionnelle, postesDeTravail, actif
        } = req.body;

        const exists = await Utilisateur.exists({ email });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('email_existant', lang),
            });
        }

        const existsMatricule = await Utilisateur.exists({ matricule });
        if (matricule!==undefined && existsMatricule) {
            return res.status(409).json({
                success: false,
                message: t('matricule_existant', lang),
            });
        }

        const password = generateRandomPassword();
        const utilisateur = new Utilisateur({
            matricule, nom, prenom, email, motDePasse : password, genre, dateNaissance, lieuNaissance, telephone,
            role, dateEntreeEnService, service, categorieProfessionnelle, postesDeTravail, actif
        });

        await utilisateur.save();

        await sendAccountEmail(email, email, password);
        
        

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: utilisateur,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Modifier un utilisateur
export const updateUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const utilisateur = await Utilisateur.findById(id);
        if (!utilisateur) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        const {
            matricule, nom, prenom, email, motDePasse, genre, dateNaissance, lieuNaissance, telephone,
            role, dateEntreeEnService, service, categorieProfessionnelle, postesDeTravail, actif
        } = req.body;

        if (email && email !== utilisateur.email) {
            const exists = await Utilisateur.findOne({ email, _id: { $ne: id } });
            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: t('email_existant', lang),
                });
            }
            utilisateur.email = email;
        }

        if (matricule && matricule !== utilisateur.matricule) {
            const exists = await Utilisateur.findOne({ matricule, _id: { $ne: id } });
            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: t('matricule_existant', lang),
                });
            }
            utilisateur.matricule = matricule;
        }


        utilisateur.nom = nom ?? utilisateur.nom;
        utilisateur.prenom = prenom ?? utilisateur.prenom;
        utilisateur.genre = genre ?? utilisateur.genre;
        utilisateur.dateNaissance = dateNaissance ?? utilisateur.dateNaissance;
        utilisateur.lieuNaissance = lieuNaissance ?? utilisateur.lieuNaissance;
        utilisateur.telephone = telephone ?? utilisateur.telephone;
        utilisateur.role = role ?? utilisateur.role;
        utilisateur.dateEntreeEnService = dateEntreeEnService ?? utilisateur.dateEntreeEnService;
        utilisateur.service = service ?? utilisateur.service;
        utilisateur.categorieProfessionnelle = categorieProfessionnelle ?? utilisateur.categorieProfessionnelle;
        utilisateur.postesDeTravail = postesDeTravail ?? utilisateur.postesDeTravail;
        utilisateur.actif = actif ?? utilisateur.actif;

        await utilisateur.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: utilisateur,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un utilisateur
export const deleteUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const utilisateur = await Utilisateur.findById(id);
        if (!utilisateur) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        await Utilisateur.deleteOne({ _id: id });

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Modification du mot de passe
export const updatePassword = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const utilisateur = await Utilisateur.findById(id);
        if (!utilisateur) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        const match = await bcrypt.compare(ancienMotDePasse, utilisateur.motDePasse);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: t('mot_de_passe_incorrect', lang),
            });
        }

        const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
        utilisateur.motDePasse = hashedPassword;
        await utilisateur.save();

        return res.status(200).json({
            success: true,
            message: t('mot_de_passe_modifie', lang),
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Liste paginée
export const getUtilisateurs = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    try {
        const total = await Utilisateur.countDocuments();

        const utilisateurs = await Utilisateur.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .populate([
                { path: 'service', select: 'nomFr nomEn', options: { strictPopulate: false } },
                { path: 'categorieProfessionnelle', select: 'nomFr nomEn', options: { strictPopulate: false } },
                { path: 'postesDeTravail.posteDeTravail', select: 'nomFr nomEn', options: { strictPopulate: false } }
            ])
            .sort({ nom: 1, prenom : 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: utilisateurs,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Liste des utilisateur avec filtre, paginé
export const getUtilisateursFiltres = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { page = 1, limit = 10, role, service, actif, posteDeTravail, familleMetier } = req.query;

    const query = {};

    if (role) query.role = role;
    if (service && mongoose.Types.ObjectId.isValid(service)) query.service = service;
    if (actif !== undefined) query.actif = actif === 'true';

    if (posteDeTravail || familleMetier) {
        query['postesDeTravail'] = {
            $elemMatch: {}
        };
        if (posteDeTravail && mongoose.Types.ObjectId.isValid(posteDeTravail)) {
            query['postesDeTravail'].$elemMatch.posteDeTravail = posteDeTravail;
        }
        if (familleMetier && mongoose.Types.ObjectId.isValid(familleMetier)) {
            query['postesDeTravail'].$elemMatch.familleMetier = familleMetier;
        }
    }
    
    try {
        const total = await Utilisateur.countDocuments(query);

        const utilisateurs = await Utilisateur.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ nom: 1, prenom : 1 })
            .populate([
                { path: 'service', select: 'nomFr nomEn' },
                { path: 'categorieProfessionnelle', select: 'nomFr nomEn' },
                { path: 'postesDeTravail.posteDeTravail', select: 'nomFr nomEn' },
            ])
            .lean();

        return res.status(200).json({
            success: true,
            data: utilisateurs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
            },
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Recherche par nom ou prénom
export const searchUtilisateurs = async (req, res) => {
    const { nom } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!nom) {
        return res.status(400).json({
            success: false,
            message: t('nom_requis', lang),
        });
    }

    try {
        const utilisateurs = await Utilisateur.find({
            $or: [
                { nom: { $regex: nom, $options: 'i' } },
                { prenom: { $regex: nom, $options: 'i' } }
            ]
        }).sort({nom : 1, prenom : 1})
        .populate([
            { path: 'service', select: 'nomFr nomEn' },
            { path: 'categorieProfessionnelle', select: 'nomFr nomEn' },
            { path: 'postesDeTravail.posteDeTravail', select: 'nomFr nomEn' }
        ]);

        return res.status(200).json({
            success: true,
            data: utilisateurs,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};
