import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import Chercheur from '../models/Chercheur.js';
import { t } from '../utils/i18n.js';
import { generateRandomPassword } from '../utils/generatePassword.js';
import { sendAccountEmail } from '../utils/sendMail.js';
import Etablissement from '../models/Etablissement.js';
import BaseUtilisateur from '../models/BaseUtilisateur.js';

// Créer un chercheur
export const createChercheur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    // Validation des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { nom, prenom, email, genre, dateNaissance, lieuNaissance, telephone, etablissement, domaineRecherche, commune } = req.body;

        // Vérifier si l'email existe déjà
        const exists = await BaseUtilisateur.exists({ email });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('chercheur_email_existe', lang),
            });
        }

        // Vérifier si l'établissement existe
        let etablissementRecord = await Etablissement.findOne({
            $or: [
                { nomFr: etablissement.nomFr },
                { nomEn: etablissement.nomEn },
            ],
        });

        // Si l'établissement n'existe pas, le créer
        if (!etablissementRecord) {
            etablissementRecord = await Etablissement.create({
                nomFr: etablissement.nomFr,
                nomEn: etablissement.nomEn,
            });
        }

        const password = generateRandomPassword();

        // Créer un chercheur
        const chercheur = await Chercheur.create({
            nom,
            prenom,
            email,
            motDePasse: password,
            genre,
            dateNaissance,
            lieuNaissance,
            telephone,
            etablissement : etablissementRecord._id,
            domaineRecherche,
            commune
        });

        await sendAccountEmail(email, email, password);
        const chercheurPopulate = await chercheur.populate('etablissement');
        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: chercheurPopulate,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Mettre à jour un chercheur
export const updateChercheur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { id } = req.params;
        const {
            nom,
            prenom,
            email,
            genre,
            dateNaissance,
            lieuNaissance,
            telephone,
            etablissement,
            domaineRecherche,
            commune,
        } = req.body;

        if (email) {
            const emailExists = await BaseUtilisateur.findOne({
                email,
                _id: { $ne: id }, // Exclure le chercheur actuel
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: t('email_deja_utilise', lang),
                });
            }
        }

        // Vérifier ou créer l'établissement
        let etablissementRecord = await Etablissement.findOne({
            $or: [
                { nomFr: etablissement.nomFr },
                { nomEn: etablissement.nomEn },
            ],
        });

        if (!etablissementRecord) {
            etablissementRecord = await Etablissement.create({
                nomFr: etablissement.nomFr,
                nomEn: etablissement.nomEn,
            });
        }

        // Récupérer le chercheur existant
        const chercheur = await Chercheur.findById(id);

        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

        // Mise à jour des champs
        if (nom) chercheur.nom = nom;
        if (prenom) chercheur.prenom = prenom;
        if (email) chercheur.email = email;
        if (genre) chercheur.genre = genre;
        if (dateNaissance) chercheur.dateNaissance = dateNaissance;
        if (lieuNaissance) chercheur.lieuNaissance = lieuNaissance;
        if (telephone) chercheur.telephone = telephone;
        if (etablissementRecord._id) chercheur.etablissement = etablissementRecord._id;
        if (domaineRecherche) chercheur.domaineRecherche = domaineRecherche;
        if (commune) chercheur.commune = commune;

        // Enregistrer les modifications
        await chercheur.save();
        const chercheurPopulate = await chercheur.populate('etablissement');
        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data:chercheurPopulate,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Supprimer un chercheur
export const deleteChercheur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const { id } = req.params;

        const chercheur = await Chercheur.findByIdAndDelete(id);

        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

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

// Mettre à jour le mot de passe d'un chercheur
export const updatePassword = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
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
        const chercheur = await Chercheur.findById(id);
        if (!chercheur) {
            return res.status(404).json({
                success: false,
                message: t('chercheur_non_trouve', lang),
            });
        }

        const match = await bcrypt.compare(ancienMotDePasse, chercheur.motDePasse);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: t('mot_de_passe_incorrect', lang),
            });
        }

        const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
        chercheur.motDePasse = hashedPassword;
        await chercheur.save();

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

// Récupérer tous les chercheurs
export const getChercheurs = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { etablissement, statut, page = 1, limit = 10, search } = req.query;

    try {
        const skip = (page - 1) * limit;

        // Base filters for Chercheur
        const chercheurFilters = {};
        const mandatFilters = {};

        // Ajouter un filtre de recherche
        if (search) {
            chercheurFilters.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { prenom: { $regex: search, $options: 'i' } },
            ];
        }

        // Filtrer par établissement
        if (etablissement) {
            chercheurFilters.etablissement = etablissement;
        }

        // Filtrer par statut de mandat
        if (statut) {
            mandatFilters.statut = statut;
        }

        // Rechercher les chercheurs en fonction des filtres
        const chercheurs = await Chercheur.find(chercheurFilters)
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'etablissement',
                select: 'nomFr nomEn',
            })
            .populate({
                path: 'mandat',
                match: mandatFilters,
                select: 'statut dateDebut dateFin',
            })
            .populate({
                path: 'commune',
                select: 'nomFr nomEn departement',
                options: { strictPopulate: false },
                populate: {
                    path: 'departement',
                    select: 'nomFr nomEn region',
                    options: { strictPopulate: false },
                    populate: {
                        path: 'region',
                        select: 'nomFr nomEn',
                        options: { strictPopulate: false },
                    },
                },
            })
            .lean();

        // Ajouter un mandat par défaut pour les chercheurs sans mandat
        const chercheursAvecStatut = chercheurs.map((chercheur) => {
            if (!chercheur.mandat) {
                chercheur.mandat = {
                    statut: 'EN_ATTENTE',
                };
            }
            return chercheur;
        });

        // Exclure les chercheurs si le statut ne correspond pas
        const chercheursFiltres = chercheursAvecStatut.filter((chercheur) =>
            statut ? chercheur.mandat.statut === statut : true
        );

        const total = await Chercheur.countDocuments(chercheurFilters);

        return res.status(200).json({
            success: true,
            data: {
                chercheurs: chercheursFiltres,
                total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                pageSize: parseInt(limit),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Une erreur est survenue lors de la récupération des chercheurs (${lang})`,
            error: error.message,
        });
    }
};


