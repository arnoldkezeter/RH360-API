import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { LieuFormation } from '../models/LieuFormation.js';
import FamilleMetier from '../models/FamilleMetier.js';
import PosteDeTravail from '../models/PosteDeTravail.js';
import Structure from '../models/Structure.js';
import Service from '../models/Service.js';

/**
 * Vérifie si un ID est valide
 */
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Valide et formate la structure participants (même logique que publicCible)
 */
const validateAndFormatParticipants = async (participants, lang) => {
    const formatted = [];

    if (!participants) return { ok: true, data: [] };

    if (!Array.isArray(participants)) {
        return { ok: false, message: t('identifiant_invalide', lang) };
    }

    // Validation de l'existence des familles de métier
    for (const fam of participants) {
        const famId = fam?.familleMetier?._id || fam?.familleMetier;
        if (!isValidObjectId(famId)) {
            return { ok: false, message: t('identifiant_invalide', lang) };
        }

        // Vérifier que la famille de métier existe
        const familleExists = await FamilleMetier.findById(famId);
        if (!familleExists) {
            return { ok: false, message: `Famille de métier ${famId} introuvable` };
        }

        const famObj = { familleMetier: famId, postes: [] };

        if (Array.isArray(fam.postes)) {
            for (const pos of fam.postes) {
                const posId = pos?.poste?._id || pos?.poste;
                if (!isValidObjectId(posId)) {
                    return { ok: false, message: t('identifiant_invalide', lang) };
                }

                // Vérifier que le poste existe ET appartient à la famille
                const poste = await PosteDeTravail.findById(posId);
                if (!poste) {
                    return { ok: false, message: `Poste de travail ${posId} introuvable` };
                }
                
                // Vérifier que le poste appartient bien à cette famille
                const appartientALaFamille = poste.famillesMetier.some(
                    fm => fm.toString() === famId.toString()
                );
                if (!appartientALaFamille) {
                    return { 
                        ok: false, 
                        message: `Le poste ${posId} n'appartient pas à la famille de métier ${famId}` 
                    };
                }

                const postObj = { poste: posId, structures: [] };

                if (Array.isArray(pos.structures)) {
                    for (const st of pos.structures) {
                        const structId = st?.structure?._id || st?.structure;
                        if (!isValidObjectId(structId)) {
                            return { ok: false, message: t('identifiant_invalide', lang) };
                        }

                        // Vérifier que la structure existe
                        const structureExists = await Structure.findById(structId);
                        if (!structureExists) {
                            return { ok: false, message: `Structure ${structId} introuvable` };
                        }

                        const structObj = { structure: structId, services: [] };

                        if (Array.isArray(st.services)) {
                            for (const serv of st.services) {
                                const servId = serv?.service?._id || serv?.service;
                                if (!isValidObjectId(servId)) {
                                    return { ok: false, message: t('identifiant_invalide', lang) };
                                }

                                // Vérifier que le service existe ET appartient à la structure
                                const service = await Service.findById(servId);
                                if (!service) {
                                    return { ok: false, message: `Service ${servId} introuvable` };
                                }
                                if (service.structure.toString() !== structId.toString()) {
                                    return { 
                                        ok: false, 
                                        message: `Le service ${servId} n'appartient pas à la structure ${structId}` 
                                    };
                                }

                                structObj.services.push({ service: servId });
                            }
                        }

                        postObj.structures.push(structObj);
                    }
                }

                famObj.postes.push(postObj);
            }
        }

        formatted.push(famObj);
    }

    return { ok: true, data: formatted };
};

/**
 * Valide que les participants sont cohérents avec le public cible du thème
 */
const validateParticipantsAgainstPublicCible = async (participantsFormatted, themeId, lang) => {
    if (!participantsFormatted || participantsFormatted.length === 0) {
        return { valid: true };
    }

    // Récupérer le thème avec son public cible
    const theme = await ThemeFormation.findById(themeId).lean();
    if (!theme) {
        return {
            valid: false,
            message: t('theme_non_trouve', lang)
        };
    }

    // Si le public cible est vide, tous les participants sont acceptés
    if (!theme.publicCible || theme.publicCible.length === 0) {
        return { valid: true };
    }

    // Extraire les IDs des familles ciblées par le thème
    const famillesCiblees = theme.publicCible.map(pc => pc.familleMetier.toString());

    // Extraire les IDs des familles dans participants
    const famillesParticipants = participantsFormatted.map(p => p.familleMetier.toString());

    // Vérifier que tous les participants font partie du public cible
    const participantsHorsCible = famillesParticipants.filter(
        famId => !famillesCiblees.includes(famId)
    );

    if (participantsHorsCible.length > 0) {
        return {
            valid: false,
            message: t('participants_hors_public_cible', lang) + ': ' + participantsHorsCible.join(', ')
        };
    }

    return { valid: true };
};

// Ajouter un lieu de formation
export const ajouterLieuFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { lieu, cohortes, participants, dateDebut, dateFin } = req.body;

    // Vérif des champs obligatoires
    if (!lieu || !participants || participants.length === 0) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
        });
    }

    if (!isValidObjectId(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(themeId);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        // Validation ASYNCHRONE des participants
        const validationParticipants = await validateAndFormatParticipants(participants, lang);
        if (!validationParticipants.ok) {
            return res.status(400).json({
                success: false,
                message: validationParticipants.message,
            });
        }
        const participantsFormatted = validationParticipants.data;

        // Vérifier que les participants sont dans le public cible
        const validationPublicCible = await validateParticipantsAgainstPublicCible(
            participantsFormatted,
            themeId,
            lang
        );
        if (!validationPublicCible.valid) {
            return res.status(400).json({
                success: false,
                message: validationPublicCible.message,
            });
        }

        // Valider les cohortes si fournies
        if (cohortes && Array.isArray(cohortes)) {
            const invalidCohortes = cohortes.filter(id => !isValidObjectId(id));
            if (invalidCohortes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang) + ': cohortes',
                });
            }
        }

        const nouveauLieu = new LieuFormation({
            lieu,
            cohortes: cohortes || [],
            participants: participantsFormatted,
            dateDebut: dateDebut || null,
            dateFin: dateFin || null,
            theme: themeId,
        });

        await nouveauLieu.save();

        const lieuFormationPopule = await LieuFormation.findById(nouveauLieu._id)
            .populate({
                path: 'cohortes',
                select: 'nomFr nomEn participants',
            })
            .populate({ path: 'participants.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.services.service', options: { strictPopulate: false } })
            .lean();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: lieuFormationPopule,
        });
    } catch (error) {
        console.error('Erreur ajouterLieuFormation:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Modifier un lieu de formation
export const modifierLieuFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { lieuId } = req.params;
    const { lieu, cohortes, participants, dateDebut, dateFin, dateDebutEffective, dateFinEffective } = req.body;

    // Vérif des champs obligatoires
    if (!lieu || !participants || participants.length === 0) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
        });
    }

    if (!isValidObjectId(lieuId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieuFormation = await LieuFormation.findById(lieuId).populate('theme');
        if (!lieuFormation) {
            return res.status(404).json({
                success: false,
                message: t('lieu_non_trouve', lang),
            });
        }

        // Validation ASYNCHRONE des participants
        const validationParticipants = await validateAndFormatParticipants(participants, lang);
        if (!validationParticipants.ok) {
            return res.status(400).json({
                success: false,
                message: validationParticipants.message,
            });
        }
        const participantsFormatted = validationParticipants.data;

        // Vérifier que les participants sont dans le public cible
        const validationPublicCible = await validateParticipantsAgainstPublicCible(
            participantsFormatted,
            lieuFormation.theme._id,
            lang
        );
        if (!validationPublicCible.valid) {
            return res.status(400).json({
                success: false,
                message: validationPublicCible.message,
            });
        }

        // Valider les cohortes si fournies
        if (cohortes && Array.isArray(cohortes)) {
            const invalidCohortes = cohortes.filter(id => !isValidObjectId(id));
            if (invalidCohortes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang) + ': cohortes',
                });
            }
        }

        lieuFormation.lieu = lieu;
        lieuFormation.cohortes = cohortes || [];
        lieuFormation.participants = participantsFormatted;
        lieuFormation.dateDebut = dateDebut || null;
        lieuFormation.dateFin = dateFin || null;
        lieuFormation.dateDebutEffective = dateDebutEffective || null;
        lieuFormation.dateFinEffective = dateFinEffective || null;

        await lieuFormation.save();

        const lieuFormationPopule = await LieuFormation.findById(lieuFormation._id)
            .populate({
                path: 'cohortes',
                select: 'nomFr nomEn participants',
            })
            .populate({ path: 'participants.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.services.service', options: { strictPopulate: false } })
            .lean();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: lieuFormationPopule,
        });
    } catch (error) {
        console.error('Erreur modifierLieuFormation:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Supprimer un lieu de formation
export const supprimerLieuFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { lieuId } = req.params;

    if (!isValidObjectId(lieuId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieuFormation = await LieuFormation.findByIdAndDelete(lieuId);
        if (!lieuFormation) {
            return res.status(404).json({
                success: false,
                message: t('lieu_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (error) {
        console.error('Erreur supprimerLieuFormation:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Lister les lieux de formation (avec pagination) pour un thème
export const getLieuxFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!isValidObjectId(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        if (query && query.trim() !== '') {
            // Recherche par nom de lieu (insensible à la casse)
            const lieuxTrouves = await LieuFormation.find({
                theme: themeId,
                lieu: { $regex: new RegExp(query, 'i') }
            })
            .populate({
                path: 'cohortes',
                select: 'nomFr nomEn participants',
            })
            .populate({ path: 'participants.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'participants.postes.structures.services.service', options: { strictPopulate: false } })
            .lean();

            // Retourner le tableau, vide si pas de résultat
            return res.status(200).json({
                success: true,
                data: {
                    lieuFormations: lieuxTrouves,
                    totalItems: lieuxTrouves.length,
                    currentPage: 1,
                    totalPages: 1,
                    pageSize: lieuxTrouves.length,
                },
            });
        } else {
            // Pas de recherche, retour paginé
            const total = await LieuFormation.countDocuments({ theme: themeId });

            const lieux = await LieuFormation.find({ theme: themeId })
                .populate({
                    path: 'cohortes',
                    select: 'nomFr nomEn participants',
                })
                .populate({ path: 'participants.familleMetier', options: { strictPopulate: false } })
                .populate({ path: 'participants.postes.poste', options: { strictPopulate: false } })
                .populate({ path: 'participants.postes.structures.structure', options: { strictPopulate: false } })
                .populate({ path: 'participants.postes.structures.services.service', options: { strictPopulate: false } })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            return res.status(200).json({
                success: true,
                data: {
                    lieuFormations: lieux,
                    totalItems: total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    pageSize: limit,
                },
            });
        }
    } catch (error) {
        console.error('Erreur getLieuxFormation:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

// Lister les lieux de formation pour un dropdown (sans pagination, juste _id et lieu)
export const getLieuxDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!isValidObjectId(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieux = await LieuFormation.find({ theme: themeId })
            .select('_id lieu')
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                lieuFormations: lieux
            },
        });
    } catch (error) {
        console.error('Erreur getLieuxDropdown:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

/**
 * Obtenir les utilisateurs ciblés par un lieu de formation
 */
export const getParticipantsCibles = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { lieuId } = req.params;

    if (!isValidObjectId(lieuId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieu = await LieuFormation.findById(lieuId);
        if (!lieu) {
            return res.status(404).json({
                success: false,
                message: t('lieu_non_trouve', lang),
            });
        }

        // Utiliser la méthode du modèle pour résoudre les utilisateurs
        const utilisateursCibles = await lieu.resolveTargetedUsers();

        return res.status(200).json({
            success: true,
            data: {
                utilisateurs: utilisateursCibles,
                nombre: utilisateursCibles.length
            },
        });
    } catch (error) {
        console.error('Erreur getParticipantsCibles:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

/**
 * Obtenir les statistiques des participants par famille de métier
 */
export const getParticipantsStats = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { lieuId } = req.params;

    if (!isValidObjectId(lieuId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const lieu = await LieuFormation.findById(lieuId);
        if (!lieu) {
            return res.status(404).json({
                success: false,
                message: t('lieu_non_trouve', lang),
            });
        }

        // Utiliser la méthode du modèle pour obtenir les stats
        const stats = await lieu.getParticipantsStats();

        return res.status(200).json({
            success: true,
            data: {
                statistiques: stats,
                total: stats.reduce((sum, s) => sum + s.nombreParticipants, 0)
            },
        });
    } catch (error) {
        console.error('Erreur getParticipantsStats:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};