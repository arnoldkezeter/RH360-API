import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { LieuFormation } from '../models/LieuFormation.js';
import FamilleMetier from '../models/FamilleMetier.js';

/**
 * Valide que tous les IDs de familles de métier existent
 */
const validateFamillesMetier = async (familleIds, lang) => {
    if (!Array.isArray(familleIds) || familleIds.length === 0) {
        return { valid: true }; // Pas de familles à valider
    }

    // Vérifier que tous les IDs sont valides
    const invalidIds = familleIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return {
            valid: false,
            message: t('identifiant_invalide', lang) + ': ' + invalidIds.join(', ')
        };
    }

    // Vérifier que toutes les familles existent
    const existingFamilles = await FamilleMetier.find({
        _id: { $in: familleIds }
    }).select('_id');

    const existingIds = existingFamilles.map(f => f._id.toString());
    const missingIds = familleIds.filter(id => !existingIds.includes(id.toString()));

    if (missingIds.length > 0) {
        return {
            valid: false,
            message: t('famille_metier_non_trouvee', lang) + ': ' + missingIds.join(', ')
        };
    }

    return { valid: true };
};

/**
 * Valide que les participants sont cohérents avec le public cible du thème
 * @param {Array} participantFamilleIds - IDs des familles de métier des participants
 * @param {String} themeId - ID du thème de formation
 * @param {String} lang - Langue
 * @returns {Object} { valid: boolean, message?: string }
 */
const validateParticipantsAgainstPublicCible = async (participantFamilleIds, themeId, lang) => {
    if (!participantFamilleIds || participantFamilleIds.length === 0) {
        return { valid: true }; // Pas de participants à valider
    }

    // Récupérer le thème avec son public cible
    const theme = await ThemeFormation.findById(themeId)
        .populate('publicCible.familleMetier')
        .lean();

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
    const famillesCiblees = theme.publicCible.map(pc => pc.familleMetier._id.toString());

    // Vérifier que tous les participants font partie du public cible
    const participantsHorsCible = participantFamilleIds.filter(
        famId => !famillesCiblees.includes(famId.toString())
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
    if (
        !lieu ||
        (
            (!Array.isArray(cohortes) || cohortes.length === 0) &&
            (!Array.isArray(participants) || participants.length === 0)
        )
    ) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang) + ' (participants ou cohortes requis)',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
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

        // ✅ VALIDATION 1: Vérifier que les familles de métier existent
        if (participants && participants.length > 0) {
            const participantsIds = participants.map(participant => participant._id);
            const validationFamilles = await validateFamillesMetier(participantsIds, lang);
            if (!validationFamilles.valid) {
                return res.status(400).json({
                    success: false,
                    message: validationFamilles.message,
                });
            }

            // ✅ VALIDATION 2: Vérifier que les participants sont dans le public cible
            const validationPublicCible = await validateParticipantsAgainstPublicCible(
                participantsIds,
                themeId,
                lang
            );
            if (!validationPublicCible.valid) {
                return res.status(400).json({
                    success: false,
                    message: validationPublicCible.message,
                });
            }
        }

        const nouveauLieu = new LieuFormation({
            lieu,
            cohortes: cohortes || [],
            participants: participants || [],
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
            .populate({
                path: 'participants',
                select: 'nomFr nomEn descriptionFr descriptionEn',
            })
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
    if (
        !lieu ||
        (
            (!Array.isArray(cohortes) || cohortes.length === 0) &&
            (!Array.isArray(participants) || participants.length === 0)
        )
    ) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang) + ' (participants ou cohortes requis)',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(lieuId)) {
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

        // ✅ VALIDATION 1: Vérifier que les familles de métier existent
        if (participants && participants.length > 0) {
            const validationFamilles = await validateFamillesMetier(participants, lang);
            if (!validationFamilles.valid) {
                return res.status(400).json({
                    success: false,
                    message: validationFamilles.message,
                });
            }

            // ✅ VALIDATION 2: Vérifier que les participants sont dans le public cible
            const validationPublicCible = await validateParticipantsAgainstPublicCible(
                participants,
                lieuFormation.theme._id,
                lang
            );
            if (!validationPublicCible.valid) {
                return res.status(400).json({
                    success: false,
                    message: validationPublicCible.message,
                });
            }
        }

        lieuFormation.lieu = lieu;
        lieuFormation.cohortes = cohortes || [];
        lieuFormation.participants = participants || [];
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
            .populate({
                path: 'participants',
                select: 'nomFr nomEn descriptionFr descriptionEn',
            })
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

    if (!mongoose.Types.ObjectId.isValid(lieuId)) {
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

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
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
            .populate({
                path: 'participants',
                select: 'nomFr nomEn',
            })
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
                .populate({
                    path: 'participants',
                    select: 'nomFr nomEn',

                })
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

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
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
                lieuFormations:lieux
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};
