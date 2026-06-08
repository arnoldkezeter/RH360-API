// controllers/participantFormationController.js
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import Utilisateur from '../models/Utilisateur.js';
import { ParticipantFormation } from '../models/ParticipantFormation.js';
import { GroupeFormation } from '../models/GroupeFormation.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 1 — Générer les participants depuis le publicCible du thème
// POST /themes/:themeId/participants/generer
// ─────────────────────────────────────────────────────────────────────────────
export const genererParticipants = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!isValidId(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const theme = await ThemeFormation.findById(themeId);
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Résoudre les utilisateurs ciblés via la méthode existante du modèle
        const utilisateursCibles = await theme.resolveTargetedUsers();

        if (utilisateursCibles.length === 0) {
            return res.status(200).json({
                success: true,
                message: t('aucun_utilisateur_cible', lang),
                data: { total: 0, nouveaux: 0, dejaCrees: 0, sansStructure: 0 }
            });
        }

        // Récupérer les utilisateurs avec leur structure peuplée
        const utilisateursAvecStructure = await Utilisateur.find({
            _id: { $in: utilisateursCibles.map(u => u._id) }
        }).populate('structure', '_id nomFr nomEn').lean();

        // Upsert : créer uniquement les nouveaux, ne pas écraser les existants
        const operations = utilisateursAvecStructure.map(user => ({
            updateOne: {
                filter: { theme: themeId, participant: user._id },
                update: {
                    $setOnInsert: {
                        theme: themeId,
                        participant: user._id,
                        structure: user.structure?._id || null,
                        statut: 'EN_ATTENTE',
                        ajoutManuellement: false,
                        ajoutePar: null,
                        groupe: null,
                    }
                },
                upsert: true
            }
        }));

        const result = await ParticipantFormation.bulkWrite(operations);
        const sansStructure = utilisateursAvecStructure.filter(u => !u.structure).length;

        return res.status(200).json({
            success: true,
            message: t('participants_generes', lang),
            data: {
                total: utilisateursCibles.length,
                nouveaux: result.upsertedCount,
                dejaCrees: result.matchedCount,
                sansStructure,
            }
        });
    } catch (error) {
        console.error('Erreur genererParticipants:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 2 — Décomposer automatiquement en groupes par structure
// POST /themes/:themeId/participants/decomposer
// body: { capaciteParGroupe: number }
// ─────────────────────────────────────────────────────────────────────────────
// Dans participantFormationController.js
export const decomposerEnGroupes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { capaciteParGroupe, forcer = false } = req.body;

    if (!isValidId(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }
    if (!capaciteParGroupe || capaciteParGroupe < 1) {
        return res.status(400).json({ success: false, message: t('capacite_invalide', lang) });
    }

    try {
        const theme = await ThemeFormation.findById(themeId);
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Si forcer=true → supprimer tous les groupes existants
        // et remettre tous les participants EN_ATTENTE
        if (forcer) {
            await GroupeFormation.deleteMany({ theme: themeId });
            await ParticipantFormation.updateMany(
                { theme: themeId },
                { $set: { groupe: null, statut: 'EN_ATTENTE' } }
            );
        }

        // Récupérer les participants EN_ATTENTE
        const participants = await ParticipantFormation.find({
            theme: themeId,
            statut: 'EN_ATTENTE'
        }).lean();

        if (participants.length === 0) {
            return res.status(200).json({
                success: true,
                message: t('aucun_participant_en_attente', lang),
                data: { groupesCrees: [], sansStructure: 0 }
            });
        }

        // Regrouper par structure
        const parStructure = participants.reduce((acc, p) => {
            const key = p.structure?.toString() || '__sans_structure__';
            if (!acc[key]) acc[key] = [];
            acc[key].push(p);
            return acc;
        }, {});

        const groupesCrees = [];
        const sansStructureCount = parStructure['__sans_structure__']?.length || 0;

        for (const [structureKey, participantsStructure] of Object.entries(parStructure)) {
            if (structureKey === '__sans_structure__') continue;

            const structureId = new mongoose.Types.ObjectId(structureKey);

            const nbGroupesExistants = await GroupeFormation.countDocuments({
                theme: themeId,
                structure: structureId
            });

            for (let i = 0; i < participantsStructure.length; i += capaciteParGroupe) {
                const tranche = participantsStructure.slice(i, i + capaciteParGroupe);

                const groupe = await GroupeFormation.create({
                    theme: themeId,
                    structure: structureId,
                    numeroGroupe: nbGroupesExistants + Math.floor(i / capaciteParGroupe) + 1,
                    statut: 'BROUILLON',
                });

                const ids = tranche.map(p => p._id);
                await ParticipantFormation.updateMany(
                    { _id: { $in: ids } },
                    { $set: { groupe: groupe._id, statut: 'AFFECTE' } }
                );

                groupesCrees.push({
                    groupeId: groupe._id,
                    structure: structureId,
                    numeroGroupe: groupe.numeroGroupe,
                    nombreParticipants: tranche.length
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: t('groupes_crees', lang),
            data: {
                groupesCrees,
                sansStructure: sansStructureCount,
                forcer,
            }
        });
    } catch (error) {
        console.error('Erreur decomposerEnGroupes:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// Ajouter un participant manuellement
// POST /themes/:themeId/participants
// body: { participantId, groupeId? }
// ─────────────────────────────────────────────────────────────────────────────
export const ajouterParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { participantId, groupeId } = req.body;

    if (!isValidId(themeId) || !isValidId(participantId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }
    if (groupeId && !isValidId(groupeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) + ': groupeId' });
    }

    try {
        const theme = await ThemeFormation.findById(themeId);
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        const user = await Utilisateur.findById(participantId)
            .populate('structure', '_id nomFr nomEn')
            .lean();
        if (!user) {
            return res.status(404).json({ success: false, message: t('utilisateur_non_trouve', lang) });
        }

        // Vérifier qu'il n'est pas déjà inscrit
        const existant = await ParticipantFormation.findOne({ theme: themeId, participant: participantId });
        if (existant) {
            return res.status(400).json({ success: false, message: t('participant_deja_ajoute', lang) });
        }

        // Vérifier que le groupe appartient bien à ce thème si fourni
        if (groupeId) {
            const groupe = await GroupeFormation.findOne({ _id: groupeId, theme: themeId });
            if (!groupe) {
                return res.status(404).json({ success: false, message: t('groupe_non_trouve', lang) });
            }
        }

        const nouveau = await ParticipantFormation.create({
            theme: themeId,
            participant: participantId,
            structure: user.structure?._id || null,
            groupe: groupeId || null,
            statut: groupeId ? 'AFFECTE' : 'EN_ATTENTE',
            ajoutManuellement: true,
            ajoutePar: req.user?._id || null,
        });

        const participantPopule = await ParticipantFormation.findById(nouveau._id)
            .populate('participant', 'nom prenom email matricule')
            .populate('structure', 'nomFr nomEn')
            .populate('groupe')
            .lean();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: participantPopule
        });
    } catch (error) {
        console.error('Erreur ajouterParticipant:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Supprimer un participant
// DELETE /themes/:themeId/participants/:participantFormationId
// ─────────────────────────────────────────────────────────────────────────────
export const supprimerParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, participantFormationId } = req.params;

    if (!isValidId(themeId) || !isValidId(participantFormationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const participant = await ParticipantFormation.findOne({
            _id: participantFormationId,
            theme: themeId
        });
        if (!participant) {
            return res.status(404).json({ success: false, message: t('participant_non_trouve', lang) });
        }

        const ancienGroupeId = participant.groupe;
        await participant.deleteOne();

        // Si le groupe est maintenant vide → le supprimer automatiquement
        if (ancienGroupeId) {
            const nbRestants = await ParticipantFormation.countDocuments({ groupe: ancienGroupeId });
            if (nbRestants === 0) {
                await GroupeFormation.findByIdAndDelete(ancienGroupeId);
            }
        }

        return res.status(200).json({ success: true, message: t('supprimer_succes', lang) });
    } catch (error) {
        console.error('Erreur supprimerParticipant:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Lister les participants d'un thème (avec pagination)
// GET /themes/:themeId/participants?page=1&limit=10&query=&statut=&structureId=
// ─────────────────────────────────────────────────────────────────────────────
export const getParticipants = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { query, statut, structureId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!isValidId(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const filter = { theme: themeId };

        // Filtre par statut
        if (statut) filter.statut = statut;

        // Filtre par structure
        if (structureId && isValidId(structureId)) filter.structure = structureId;

        // Filtre par nom/prénom (recherche sur Utilisateur puis filtre)
        if (query && query.trim() !== '') {
            const utilisateurs = await Utilisateur.find({
                $or: [
                    { nom: { $regex: query.trim(), $options: 'i' } },
                    { prenom: { $regex: query.trim(), $options: 'i' } },
                    { matricule: { $regex: query.trim(), $options: 'i' } },
                ]
            }).select('_id').lean();

            filter.participant = { $in: utilisateurs.map(u => u._id) };
        }

        const total = await ParticipantFormation.countDocuments(filter);

        const participants = await ParticipantFormation.find(filter)
            .populate('participant', 'nom prenom email matricule')
            .populate('structure', 'nomFr nomEn')
            .populate('groupe', 'numeroGroupe lieu statut')
            .populate('ajoutePar', 'nom prenom')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                participantFormations: participants,
                totalItems: total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                pageSize: limit,
            }
        });
    } catch (error) {
        console.error('Erreur getParticipants:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};



// ─────────────────────────────────────────────────────────────────────────────
// Rechercher un utilisateur à ajouter manuellement (pas encore inscrit)
// GET /themes/:themeId/participants/rechercher?query=
// ─────────────────────────────────────────────────────────────────────────────
export const rechercherUtilisateurAjoutable = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { query } = req.query;

    if (!isValidId(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }
    if (!query || query.trim() === '') {
        return res.status(400).json({ success: false, message: t('champs_obligatoires', lang) });
    }

    try {
        // IDs déjà inscrits à ce thème
        const dejInscrits = await ParticipantFormation.find({ theme: themeId })
            .select('participant')
            .lean();
        const dejInscritsIds = dejInscrits.map(p => p.participant);

        // Rechercher parmi ceux qui ne sont PAS encore inscrits
        const utilisateurs = await Utilisateur.find({
            _id: { $nin: dejInscritsIds },
            $or: [
                { nom: { $regex: query.trim(), $options: 'i' } },
                { prenom: { $regex: query.trim(), $options: 'i' } },
                { matricule: { $regex: query.trim(), $options: 'i' } },
            ]
        })
        .populate('structure', 'nomFr nomEn')
        .select('nom prenom email matricule structure')
        .limit(20)
        .lean();

        return res.status(200).json({
            success: true,
            data: { utilisateurs }
        });
    } catch (error) {
        console.error('Erreur rechercherUtilisateurAjoutable:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};