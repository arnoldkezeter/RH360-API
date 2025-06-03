import BesoinFormationExprime from '../models/BesoinFormationExprime.js';
import Utilisateur from '../models/Utilisateur.js';
import BesoinFormationPredefini from '../models/BesoinFormationPredefini.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';

// Ajouter un besoin exprimé
export const createBesoinFormationExprime = async (req, res) => {
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
        const { utilisateur, besoin, commentaire, priorite } = req.body;

        // Vérification des IDs
        if (!mongoose.Types.ObjectId.isValid(utilisateur) || !mongoose.Types.ObjectId.isValid(besoin)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const user = await Utilisateur.findById(utilisateur);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        const besoinPredefini = await BesoinFormationPredefini.findById(besoin);
        if (!besoinPredefini) {
            return res.status(404).json({
                success: false,
                message: t('besoin_non_trouve', lang),
            });
        }

        const besoinExprime = await BesoinFormationExprime.create({
            utilisateur,
            besoin,
            commentaire,
            priorite,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: besoinExprime,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Modifier un besoin exprimé
export const updateBesoinFormationExprime = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { commentaire, priorite } = req.body;

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
        const besoin = await BesoinFormationExprime.findById(id);
        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_exprime_non_trouve', lang),
            });
        }

        if (commentaire !== undefined) besoin.commentaire = commentaire;
        if (priorite !== undefined) besoin.priorite = priorite;
        
        await besoin.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: besoin,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un besoin exprimé
export const deleteBesoinFormationExprime = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const besoin = await BesoinFormationExprime.findById(id);
        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_exprime_non_trouve', lang),
            });
        }

        await BesoinFormationExprime.deleteOne({ _id: id });

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

// Liste paginée
export const getBesoinsExprimes = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const total = await BesoinFormationExprime.countDocuments();
        const besoins = await BesoinFormationExprime.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('utilisateur', 'nom prenom email')
        .populate({
            path: 'besoin',
            populate: {
            path: 'posteDeTravail',
            populate: {
                path: 'familleMetier',
            },
            },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: besoins,
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

// Détail par ID
export const getBesoinExprimeById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const besoin = await BesoinFormationExprime.findById(id)
        .populate('utilisateur', 'nom prenom email')
        .populate({
            path: 'besoin',
            populate: {
            path: 'posteDeTravail',
            populate: {
                path: 'familleMetier',
            },
            },
        })
        .lean();

        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_exprime_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: besoin,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Valider et prioriser un besoin
export const validerEtPrioriserBesoinExprime = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { valide, priorite } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        // On récupère le besoin exprimé cible
        const besoinExprime = await BesoinFormationExprime.findById(id);
        if (!besoinExprime) {
            return res.status(404).json({ 
                success: false, 
                message: t('besoin_exprime_non_trouve', lang) 
            });
        }

        // On récupère tous les besoins exprimés avec le même besoin prédéfini
        const query = { besoinFormationPredefini: besoinExprime.besoin };
        const update = {};

        if (valide !== undefined) update.statut = !!valide;
        if (priorite) update.priorite = priorite;

        // On met à jour tous les besoins similaires
        const result = await BesoinFormationExprime.updateMany(query, { $set: update });

        // Optionnel : recharger un besoin mis à jour pour le retourner
        const updated = await BesoinFormationExprime.findById(id);

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: updated,
            totalModifies: result.modifiedCount
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


//Statistique
//Total besoin exprimé
export const getTotalBesoinsExprimes = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const total = await BesoinFormationExprime.countDocuments();
        return res.status(200).json({ success: true, total });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

//Total des besoins avec priorité hautes
export const getTotalBesoinsPrioriteHaute = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const total = await BesoinFormationExprime.countDocuments({ priorite: 'Haute' });
        return res.status(200).json({ success: true, total });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

//Famille metier effectuant le plus de demande
export const getTopFamillesMetier = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const result = await BesoinFormationExprime.aggregate([
        {
            $lookup: {
            from: 'postesdetravail',
            localField: 'posteDeTravail',
            foreignField: '_id',
            as: 'poste'
            }
        },
        { $unwind: '$poste' },
        {
            $group: {
            _id: '$poste.familleMetier',
            count: { $sum: 1 }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 5
        }
        ]);
        return res.status(200).json({ 
            success: true, 
            data: result 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

//Sujet les plus récurrents
export const getBesoinsLesPlusDemandes = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const result = await BesoinFormationExprime.aggregate([
        {
            $group: {
            _id: '$besoin',
            count: { $sum: 1 }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 5
        },
        {
            $lookup: {
            from: 'besoinformationpredefinis',
            localField: '_id',
            foreignField: '_id',
            as: 'besoin'
            }
        },
        { $unwind: '$besoin' },
        {
            $project: {
            _id: 1,
            count: 1,
            titreFr: '$besoin.titreFr',
            titreEn: '$besoin.titreEn'
            }
        }
        ]);
        return res.status(200).json({ 
            success: true, 
            data: result 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


//Besoins par famille metier
export const getHistogrammeBesoinsParFamille = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const result = await BesoinFormationExprime.aggregate([
        {
            $lookup: {
            from: 'postesdetravail',
            localField: 'posteDeTravail',
            foreignField: '_id',
            as: 'poste'
            }
        },
        { $unwind: '$poste' },
        {
            $group: {
            _id: '$poste.familleMetier',
            total: { $sum: 1 }
            }
        }
        ]);
        return res.status(200).json({ 
            success: true, 
            data: result 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


//Demande par besoin exprimé
export const getHistogrammeDemandesParBesoin = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    try {
        const result = await BesoinFormationExprime.aggregate([
        {
            $group: {
            _id: '$besoin',
            total: { $sum: 1 }
            }
        },
        {
            $lookup: {
            from: 'besoinformationpredefinis',
            localField: '_id',
            foreignField: '_id',
            as: 'besoin'
            }
        },
        { $unwind: '$besoin' },
        {
            $project: {
            _id: 1,
            total: 1,
            titreFr: '$besoin.titreFr',
            titreEn: '$besoin.titreEn'
            }
        }
        ]);
        return res.status(200).json({ 
            success: true, 
            data: result 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


//Filtrer les dernières demande
export const getDernieresDemandesFiltrees = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { familleMetier, priorite, dateDebut, dateFin, limit = 20 } = req.query;

    const filters = {};
    if (priorite) filters.priorite = priorite;
    if (dateDebut || dateFin) filters.createdAt = {};
    if (dateDebut) filters.createdAt.$gte = new Date(dateDebut);
    if (dateFin) filters.createdAt.$lte = new Date(dateFin);

    try {
        let demandes = await BesoinFormationExprime.find(filters)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('besoin posteDeTravail utilisateur', 'titreFr titreEn nom prenom email nomFr nomEn')
        .lean();

        // Filtrage post-fetch si familleMetier est spécifiée
        if (familleMetier) {
            demandes = demandes.filter(d => d.posteDeTravail?.familleMetier?.toString() === familleMetier);
        }

        return res.status(200).json({ 
            success: true, 
            data: demandes 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


//Recherche de besoin par utilisateur
export const searchBesoinsParUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { search } = req.query;

    if (!search) {
        return res.status(400).json({
            success: false,
            message: t('recherche_invalide', lang)
        });
    }

    try {
        const utilisateurs = await Utilisateur.find({
        $or: [
            { nom: new RegExp(search, 'i') },
            { prenom: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') }
        ]
        }).select('_id');

        const demandes = await BesoinFormationExprime.find({ utilisateur: { $in: utilisateurs.map(u => u._id) } })
        .populate('utilisateur besoin posteDeTravail')
        .lean();

        return res.status(200).json({ 
            success: true, 
            data: demandes 
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};






