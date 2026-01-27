// controllers/posteDeTravailController.js
import PosteDeTravail from '../models/PosteDeTravail.js';
import FamilleMetier from '../models/FamilleMetier.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Service from '../models/Service.js';

// Ajouter un poste de travail
export const createPosteDeTravail = async (req, res) => {
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
        const { nomFr, nomEn, descriptionFr, descriptionEn, famillesMetier, services } = req.body;

        // Vérifier l'unicité du nomFr et nomEn
        if (await PosteDeTravail.exists({ nomFr })) {
            return res.status(409).json({
                success: false,
                message: t('poste_de_travail_existante_fr', lang),
            });
        }
        if (await PosteDeTravail.exists({ nomEn })) {
            return res.status(409).json({
                success: false,
                message: t('poste_de_travail_existante_en', lang),
            });
        }

        // Valider familleMetier : tableau d’ObjectId
        let familleIds = [];
        if (Array.isArray(famillesMetier) && famillesMetier.length > 0) {
            for (const famille of famillesMetier) {
                if (!mongoose.Types.ObjectId.isValid(famille._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                const exists = await FamilleMetier.exists({ _id: famille._id });
                if (!exists) {
                    return res.status(404).json({
                        success: false,
                        message: t('famille_metier_non_trouvee', lang),
                    });
                }
                familleIds.push(famille._id);
            }
        } else {
            return res.status(400).json({
                success: false,
                message: t('famille_metier_requis', lang),
            });
        }

        // Valider service : tableau d’ObjectId
        let serviceIds = [];
        if (Array.isArray(services) && services.length > 0) {
            for (const service of services) {
                if (!mongoose.Types.ObjectId.isValid(service._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                const exists = await Service.exists({ _id: service._id });
                if (!exists) {
                    return res.status(404).json({
                        success: false,
                        message: t('service_non_trouve', lang),
                    });
                }
                serviceIds.push(service._id);
            }
        } else {
            return res.status(400).json({
                success: false,
                message: t('service_requis', lang),
            });
        }

        const poste = await PosteDeTravail.create({
            nomFr,
            nomEn,
            descriptionFr,
            descriptionEn,
            famillesMetier: familleIds,
            services:serviceIds
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: poste,
        });

    } catch (err) {
        console.error('Erreur createPosteDeTravail:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Modifier un poste de travail
export const updatePosteDeTravail = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, descriptionFr, descriptionEn, famillesMetier, services } = req.body;

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
        const poste = await PosteDeTravail.findById(id);
        if (!poste) {
            return res.status(404).json({
                success: false,
                message: t('poste_de_travail_non_trouve', lang),
            });
        }

        // Vérifier unicité nomFr et nomEn en excluant le poste actuel
        if (nomFr) {
            const existsFr = await PosteDeTravail.findOne({ nomFr, _id: { $ne: poste._id } });
            if (existsFr) {
                return res.status(409).json({
                    success: false,
                    message: t('poste_de_travail_existante_fr', lang),
                });
            }
            poste.nomFr = nomFr;
        }

        if (nomEn) {
            const existsEn = await PosteDeTravail.findOne({ nomEn, _id: { $ne: poste._id } });
            if (existsEn) {
                return res.status(409).json({
                    success: false,
                    message: t('poste_de_travail_existante_en', lang),
                });
            }
            poste.nomEn = nomEn;
        }

        if (descriptionFr !== undefined) poste.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) poste.descriptionEn = descriptionEn;

        // Mise à jour familleMetier : remplacer entièrement
        if (famillesMetier && Array.isArray(famillesMetier)) {
            let familleIds = [];
            for (const famille of famillesMetier) {
                if (!mongoose.Types.ObjectId.isValid(famille._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                const exists = await FamilleMetier.exists({ _id: famille._id });
                if (!exists) {
                    return res.status(404).json({
                        success: false,
                        message: t('famille_metier_non_trouvee', lang),
                    });
                }
                familleIds.push(famille._id);
            }
            poste.famillesMetier = familleIds;
        }

        // Mise à jour service : remplacer entièrement
        if (services && Array.isArray(services)) {
            let serviceIds = [];
            for (const service of services) {
                if (!mongoose.Types.ObjectId.isValid(service._id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('identifiant_invalide', lang),
                    });
                }
                const exists = await Service.exists({ _id: service._id });
                if (!exists) {
                    return res.status(404).json({
                        success: false,
                        message: t('service_non_trouvee', lang),
                    });
                }
                serviceIds.push(service._id);
            }
            poste.services = serviceIds;
        }

        await poste.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: poste,
        });

    } catch (err) {
        console.error('Erreur updatePosteDeTravail:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Supprimer un poste de travail
export const deletePosteDeTravail = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const poste = await PosteDeTravail.findById(id);
        if (!poste) {
        return res.status(404).json({
            success: false,
            message: t('poste_de_travail_non_trouve', lang),
        });
        }

        await PosteDeTravail.deleteOne({ _id: id });

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

// Liste paginée des postes de travail
export const getPostesDeTravail = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';

    try {
        const total = await PosteDeTravail.countDocuments();

        const postes = await PosteDeTravail.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortField]: 1 })
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
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

// Récupérer un poste par id
export const getPosteDeTravailById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        const poste = await PosteDeTravail.findById(id)
        .populate({
            path: 'familleMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        if (!poste) {
        return res.status(404).json({
            success: false,
            message: t('poste_de_travail_non_trouve', lang),
        });
        }

        return res.status(200).json({
        success: true,
        data: poste,
        });

    } catch (err) {
        return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
        });
    }
};

// Recherche par nomFr ou nomEn selon lang
export const searchPostesDeTravailByName = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { nom } = req.query;

    if (!nom) {
        return res.status(400).json({
        success: false,
        message: t('nom_requis', lang),
        });
    }

    try {
        const queryField = lang === 'en' ? 'nomEn' : 'nomFr';

        const postes = await PosteDeTravail.find({
        [queryField]: { $regex: nom, $options: 'i' },
        })
        .populate({
            path: 'famillesMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .populate({
            path: 'services',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
                totalItems:postes.length,
                currentPage:1,
                totalPages: 1,
                pageSize:postes.length 
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

// Liste des postes par familleMetier
export const getPostesByFamilleMetier = async (req, res) => {
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        
        const total = await PosteDeTravail.countDocuments({ famillesMetier: familleMetierId });

        const postes = await PosteDeTravail.find({ famillesMetier: familleMetierId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({[lang==='fr'?'nomFr':'nomEn']:1})
        .populate({
            path: 'famillesMetier',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .populate({
            path: 'services',
            select: 'nomFr nomEn',
            options: { strictPopulate: false },
        })
        .lean();

        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails : postes,
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


//Liste des poste de travail par famille pour dropdown
export const getPosteDeTravailsForDropdownByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const {familleMetierId} = req.params;
    const sortField = lang === 'en' ? 'nomEn' : 'nomFr';
  
    try {
        if (!mongoose.Types.ObjectId.isValid(familleMetierId)) {
            return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
            });
        }
        const posteDeTravails = await PosteDeTravail.find({famillesMetier:familleMetierId}, "_id nomFr nomEn")
            .populate([
                { path: 'famillesMetier', select: 'nomFr nomEn',  options:{strictPopulate:false}}
            ])
            .sort({ [sortField]: 1 })
            .lean();
    
        return res.status(200).json({
            success: true,
            data: {
                posteDeTravails,
                totalItems:posteDeTravails.lenght,
                currentPage:1,
                totalPages: 1,
                pageSize:posteDeTravails.lenght
            },
        });
    } catch (err) {
      console.error('Erreur getPosteDeTravailsForDropdown:', err);
      return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
      });
    }
};


export const supprimerDoublonsPosteDeTravail = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        // 🔥 Étape 1 : récupérer tous les postes triés par nom et date de création
        const postes = await PosteDeTravail.find({})
            .sort({ nomFr: 1, nomEn: 1, createdAt: 1 }) // garde le plus ancien en premier
            .lean();

        const seen = new Map(); // pour stocker les uniques
        const doublonsIds = []; // pour stocker les _id des doublons à supprimer

        // 🔥 Étape 2 : parcourir chaque poste pour détecter les doublons
        for (const poste of postes) {
            const keyFr = poste.nomFr.trim().toLowerCase();
            const keyEn = poste.nomEn.trim().toLowerCase();

            const key = `${keyFr}|${keyEn}`; // clé unique basée sur nomFr + nomEn

            if (seen.has(key)) {
                // doublon détecté → ajouter à la liste des suppressions
                doublonsIds.push(poste._id);
            } else {
                // premier rencontré → garder
                seen.set(key, poste._id);
            }
        }

        // 🔥 Étape 3 : supprimer tous les doublons sauf le premier
        let deletedCount = 0;
        if (doublonsIds.length > 0) {
            const result = await PosteDeTravail.deleteMany({ _id: { $in: doublonsIds } });
            deletedCount = result.deletedCount || 0;
        }

        return res.status(200).json({
            success: true,
            message: t('doublons_supprimes', lang),
            totalDoublonsSupprimes: deletedCount,
            doublonsSupprimesIds: doublonsIds, // pour audit si besoin
        });
    } catch (err) {
        console.error('Erreur dans supprimerDoublonsPosteDeTravail:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


/**
 * Récupère tous les postes appartenant à une famille métier
 * GET /api/familles-metier/:familleId/postes
 */
export const getPostesByFamille = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
    const { familleId } = req.params;
    const { search } = req.query;

    // Vérifier si la famille métier existe
    const famille = await FamilleMetier.findById(familleId);
    if (!famille) {
      return res.status(404).json({ 
        success: false, 
        message: t('famille_non_trouvee', lang) 
      });
    }

    // Construire la requête de recherche
    const query = { famillesMetier: familleId };
    
    if (search) {
      query.$or = [
        { nomFr: { $regex: search, $options: 'i' } },
        { nomEn: { $regex: search, $options: 'i' } }
      ];
    }

    // Récupérer tous les postes qui contiennent cette famille dans leur tableau
    const postes = await PosteDeTravail.find(query)
    .populate('famillesMetier', 'nomFr nomEn')
    .populate('services', 'nomFr nomEn')
    .sort({ nomFr: 1 });

    res.status(200).json({
      success: true,
    //   count: postes.length,
    //   famille: {
    //     _id: famille._id,
    //     nomFr: famille.nomFr,
    //     nomEn: famille.nomEn
    //   },
      data: {
            posteDeTravails : postes,
            totalItems:postes.length,
            currentPage:1,
            totalPages: 1,
            pageSize:postes.length 
        },
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: t('erreur_serveur', lang),
      error: error.message 
    });
  }
};


/**
 * Récupère tous les services liés à un poste de travail
 * GET /api/postes/:posteId/services
 */
export const getServicesByPoste = async (req, res) => {
  try {
    const { posteId } = req.params;

    // Vérifier si le poste existe
    const poste = await PosteDeTravail.findById(posteId);
    if (!poste) {
      return res.status(404).json({ 
        success: false, 
        message: 'Poste de travail non trouvé' 
      });
    }

    // Récupérer tous les services liés à ce poste
    const services = await Service.find({ 
      _id: { $in: poste.services } 
    })
    .populate('chefService', 'nom prenom email')
    .populate('structure', 'nomFr nomEn')
    .sort({ nomFr: 1 });

    res.status(200).json({
      success: true,
      count: services.length,
      poste: {
        _id: poste._id,
        nomFr: poste.nomFr,
        nomEn: poste.nomEn
      },
      data: services
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des services',
      error: error.message 
    });
  }
};

