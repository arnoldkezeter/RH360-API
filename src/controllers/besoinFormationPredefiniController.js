import BesoinFormationPredefini from '../models/BesoinFormationPredefini.js';
import PosteDeTravail from '../models/PosteDeTravail.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';

// Ajouter
export const createBesoinFormationPredefini = async (req, res) => {
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
        const { titreFr, titreEn, descriptionFr, descriptionEn, posteDeTravail } = req.body;

        // if (!mongoose.Types.ObjectId.isValid(posteDeTravail)) {
        //     return res.status(400).json({
        //         success: false,
        //         message: t('identifiant_invalide', lang),
        //     });
        // }

        // const poste = await PosteDeTravail.findById(posteDeTravail);
        // if (!poste) {
        //     return res.status(404).json({
        //         success: false,
        //         message: t('poste_de_travail_non_trouve', lang),
        //     });
        // }

        // const existsFr = await BesoinFormationPredefini.findOne({ titreFr, posteDeTravail });
        // if (existsFr) {
        //     return res.status(409).json({
        //         success: false,
        //         message: t('besoin_existant_fr', lang),
        //     });
        // }

        // const existsEn = await BesoinFormationPredefini.findOne({ titreEn, posteDeTravail });
        // if (existsEn) {
        //     return res.status(409).json({
        //         success: false,
        //         message: t('besoin_existant_en', lang),
        //     });
        // }

        const existsFr = await BesoinFormationPredefini.findOne({ titreFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('besoin_existant_fr', lang),
            });
        }

        const existsEn = await BesoinFormationPredefini.findOne({ titreEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('besoin_existant_en', lang),
            });
        }

        const besoin = await BesoinFormationPredefini.create({
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
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

// Modifier
export const updateBesoinFormationPredefini = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { titreFr, titreEn, descriptionFr, descriptionEn, posteDeTravail } = req.body;

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
        const besoin = await BesoinFormationPredefini.findById(id);
        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_non_trouve', lang),
            });
        }

        // if (posteDeTravail && !mongoose.Types.ObjectId.isValid(posteDeTravail)) {
        //     return res.status(400).json({
        //         success: false,
        //         message: t('identifiant_invalide', lang),
        //     });
        // }

        // const poste = await PosteDeTravail.findById(posteDeTravail);
        // if (!poste) {
        //     return res.status(404).json({
        //         success: false,
        //         message: t('poste_de_travail_non_trouve', lang),
        //     });
        // }

        // if (titreFr && posteDeTravail) {
        //     const duplicate = await BesoinFormationPredefini.findOne({
        //         _id: { $ne: id },
        //         titreFr,
        //         posteDeTravail,
        //     });
        //     if (duplicate) {
        //         return res.status(409).json({
        //             success: false,
        //             message: t('besoin_existant_fr', lang),
        //         });
        //     }
        // }

        // if (titreEn && posteDeTravail) {
        //     const duplicate = await BesoinFormationPredefini.findOne({
        //         _id: { $ne: id },
        //         titreEn,
        //         posteDeTravail,
        //     });
        //     if (duplicate) {
        //         return res.status(409).json({
        //             success: false,
        //             message: t('besoin_existant_en', lang),
        //         });
        //     }
        // }

         if (titreFr) {
            const duplicate = await BesoinFormationPredefini.findOne({
                _id: { $ne: id },
                titreFr,
            });
            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: t('besoin_existant_fr', lang),
                });
            }
        }

        if (titreEn) {
            const duplicate = await BesoinFormationPredefini.findOne({
                _id: { $ne: id },
                titreEn,
            });
            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: t('besoin_existant_en', lang),
                });
            }
        }

        if (titreFr) besoin.titreFr = titreFr;
        if (titreEn) besoin.titreEn = titreEn;
        if (descriptionFr !== undefined) besoin.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) besoin.descriptionEn = descriptionEn;
        // if (posteDeTravail) besoin.posteDeTravail = posteDeTravail;

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

// Supprimer
export const deleteBesoinFormationPredefini = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const besoin = await BesoinFormationPredefini.findById(id);
        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_non_trouve', lang),
            });
        }

        await BesoinFormationPredefini.deleteOne({ _id: id });

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
export const getBesoinsFormationPredefinis = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const total = await BesoinFormationPredefini.countDocuments();

        const besoins = await BesoinFormationPredefini.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate({
                path: 'posteDeTravail',
                select: 'intituleFr intituleEn',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                besoinFormationPredefinis:besoins,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Obtenir par ID
export const getBesoinFormationPredefiniById = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const besoin = await BesoinFormationPredefini.findById(id)
            .populate({
                path: 'posteDeTravail',
                select: 'nomFr nomEn familleMetier',
                options: { strictPopulate: false },
            })
            .lean();

        if (!besoin) {
            return res.status(404).json({
                success: false,
                message: t('besoin_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: besoin,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: err.message,
        });
    }
};

// Rechercher par titre
export const searchBesoinFormationPredefiniByTitre = async (req, res) => {
    const { titre } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const champ = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const besoins = await BesoinFormationPredefini.find({
            [champ]: { $regex: new RegExp(titre, 'i') },
        })
            .populate({
                path: 'posteDeTravail',
                select: 'nomFr nomEn',
                options: { strictPopulate: false },
            })
            .sort({ [champ]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                besoinFormationPredefinis:besoins,
                totalItems:besoins.length,
                currentPage:1,
                totalPages: 1,
                pageSize:besoins.length
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

// Pour les menus déroulants
export const getBesoinsFormationPredefinisForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const champ = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const besoins = await BesoinFormationPredefini.find({}, `_id titreFr titreEn`)
            .sort({ [champ]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                besoinFormationPredefinis:besoins,
                totalItems:besoins.length,
                currentPage:1,
                totalPages:1,
                pageSize:besoins.length
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


//Besoin par poste de travail
export const getBesoinsParPosteDeTravail = async (req, res) => {
    const { posteId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const champTri = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!mongoose.Types.ObjectId.isValid(posteId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const total = await BesoinFormationPredefini.countDocuments({ posteDeTravail: posteId });

        const besoins = await BesoinFormationPredefini.find({ posteDeTravail: posteId })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [champTri]: 1 })
            .populate({
                path: 'posteDeTravail',
                select: 'nomFr nomEn',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                getBesoinsFormationPredefinis:besoins,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
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


//Besoin par famille de metier
export const getBesoinsParFamilleMetier = async (req, res) => {
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const champTri = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        // On filtre par famille métier à travers la relation avec `PosteDeTravail`
        const postes = await PosteDeTravail.find({ familleMetier: familleMetierId }, '_id').lean();
        const posteIds = postes.map(p => p._id);

        const total = await BesoinFormationPredefini.countDocuments({
            posteDeTravail: { $in: posteIds },
        });

        const besoins = await BesoinFormationPredefini.find({
            posteDeTravail: { $in: posteIds },
        })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [champTri]: 1 })
            .populate({
                path: 'posteDeTravail',
                select: 'nomFr nomEn familleMetier',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                besoinFormationPredefinis:besoins,
                totalItems:total,
                currentPage:page,
                totalPages: Math.ceil(total / limit),
                pageSize:limit
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

