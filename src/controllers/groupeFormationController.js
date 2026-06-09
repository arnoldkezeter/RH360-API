// controllers/groupeFormationController.js
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import { GroupeFormation } from '../models/GroupeFormation.js';
import { ParticipantFormation } from '../models/ParticipantFormation.js';
import Utilisateur from '../models/Utilisateur.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { addRoleToUser, removeRoleFromUserIfUnused } from '../utils/utilisateurRole.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─────────────────────────────────────────────────────────────────────────────
// Résumé de tous les groupes d'un thème
// GET /themes/:themeId/groupes/resume
// ─────────────────────────────────────────────────────────────────────────────
export const getResumeGroupes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!isValidId(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const groupes = await GroupeFormation.find({ theme: themeId })
            .populate('structure', 'nomFr nomEn')
            .populate({
                path: 'formateurs',
                populate: { path: 'utilisateur', select: 'nom prenom' }
            })
            .sort({ structure: 1, numeroGroupe: 1 })
            .lean();

        // Compter les participants par groupe en une seule requête aggregate
        const groupeIds = groupes.map(g => g._id);
        const comptages = await ParticipantFormation.aggregate([
            { $match: { groupe: { $in: groupeIds } } },
            { $group: { _id: '$groupe', count: { $sum: 1 } } }
        ]);

        const comptageMap = comptages.reduce((acc, c) => {
            acc[c._id.toString()] = c.count;
            return acc;
        }, {});

        const groupesAvecCompte = groupes.map(g => ({
            groupe: g,
            nombreParticipants: comptageMap[g._id.toString()] || 0,
        }));

        // Regrouper par structure pour l'affichage UI
        const parStructure = groupesAvecCompte.reduce((acc, item) => {
            const key = item.groupe.structure?._id?.toString() || '__sans_structure__';
            const nom = item.groupe.structure
                ? (lang === 'fr' ? item.groupe.structure.nomFr : item.groupe.structure.nomEn)
                : 'Sans structure';
            if (!acc[key]) {
                acc[key] = {
                    structure: item.groupe.structure || null,
                    nom,
                    groupes: [],
                    totalParticipants: 0
                };
            }
            acc[key].groupes.push(item);
            acc[key].totalParticipants += item.nombreParticipants;
            return acc;
        }, {});

        // Participants encore EN_ATTENTE (sans groupe)
        const sansGroupe = await ParticipantFormation.countDocuments({
            theme: themeId,
            groupe: null
        });

        return res.status(200).json({
            success: true,
            data: {
                parStructure: Object.values(parStructure),
                sansGroupe,
                totalGroupes: groupes.length,
                totalParticipants: groupesAvecCompte.reduce((s, g) => s + g.nombreParticipants, 0),
            }
        });
    } catch (error) {
        console.error('Erreur getResumeGroupes:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Lister les participants d'un groupe
// GET /themes/:themeId/groupes/:groupeId/participants
// ─────────────────────────────────────────────────────────────────────────────
export const getParticipantsGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, groupeId } = req.params;

    if (!isValidId(themeId) || !isValidId(groupeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const groupe = await GroupeFormation.findOne({ _id: groupeId, theme: themeId })
            .populate('structure', 'nomFr nomEn')
            .populate({
                path: 'formateurs',
                populate: { path: 'utilisateur', select: 'nom prenom' }
            })
            .lean();

        if (!groupe) {
            return res.status(404).json({ success: false, message: t('groupe_non_trouve', lang) });
        }

        const participants = await ParticipantFormation.find({ groupe: groupeId })
            .populate('participant', 'nom prenom email matricule')
            .populate('structure', 'nomFr nomEn')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                groupe,
                participants,
                nombreParticipants: participants.length,
            }
        });
    } catch (error) {
        console.error('Erreur getParticipantsGroupe:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Configurer un groupe (lieu, formateurs, dates)
// PATCH /themes/:themeId/groupes/:groupeId/configurer
// body: { lieu, formateurs[], dateDebut, dateFin }
// ─────────────────────────────────────────────────────────────────────────────
export const configurerGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, groupeId } = req.params;
    const { lieu, formateurs, dateDebut, dateFin } = req.body;

    if (!isValidId(themeId) || !isValidId(groupeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }
    if (formateurs && !formateurs.every(id => isValidId(id))) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) + ': formateurs' });
    }
    if (dateDebut && dateFin && new Date(dateDebut) > new Date(dateFin)) {
        return res.status(400).json({ success: false, message: t('date_debut_superieure_date_fin', lang) });
    }

    try {
        const groupe = await GroupeFormation.findOne({ _id: groupeId, theme: themeId });
        if (!groupe) {
            return res.status(404).json({ success: false, message: t('groupe_non_trouve', lang) });
        }

        // ── Garder trace des anciens formateurs pour diff des rôles ──────────
        const anciensFormateursIds = (groupe.formateurs || []).map(id => id.toString());

        if (lieu !== undefined)       groupe.lieu       = lieu;
        if (formateurs !== undefined) groupe.formateurs = formateurs;
        if (dateDebut !== undefined)  groupe.dateDebut  = dateDebut;
        if (dateFin !== undefined)    groupe.dateFin    = dateFin;

        groupe.statut = (groupe.lieu && groupe.dateDebut && groupe.dateFin)
            ? 'PLANIFIE'
            : 'BROUILLON';

        await groupe.save();

        // ── Sync des rôles FORMATEUR ─────────────────────────────────────────
        if (formateurs !== undefined) {
            const nouveauxFormateursIds = formateurs.map(id => id.toString());

            // Ajouter le rôle aux nouveaux formateurs
            const aAjouter = nouveauxFormateursIds.filter(
                id => !anciensFormateursIds.includes(id)
            );
            await Promise.all(aAjouter.map(id => addRoleToUser(id, 'FORMATEUR')));

            // Retirer le rôle aux formateurs supprimés s'ils ne sont plus
            // formateurs dans aucun autre groupe
            const aRetirer = anciensFormateursIds.filter(
                id => !nouveauxFormateursIds.includes(id)
            );
            await Promise.all(aRetirer.map(async (id) => {
                const encoreFormateur = await GroupeFormation.findOne({
                    _id: { $ne: groupeId },
                    formateurs: id
                });
                if (!encoreFormateur) {
                    await removeRoleFromUserIfUnused(id, 'FORMATEUR', GroupeFormation);
                }
            }));
        }

        // ── Sync des dates du thème ──────────────────────────────────────────
        // Recalculer min(dateDebut) et max(dateFin) sur tous les groupes du thème
        const tousLesGroupes = await GroupeFormation.find({ theme: themeId })
            .select('dateDebut dateFin')
            .lean();

        const dateDebuts = tousLesGroupes.map(g => g.dateDebut).filter(Boolean);
        const dateFins   = tousLesGroupes.map(g => g.dateFin).filter(Boolean);

        await ThemeFormation.findByIdAndUpdate(themeId, {
            dateDebut: dateDebuts.length > 0
                ? new Date(Math.min(...dateDebuts.map(d => new Date(d))))
                : null,
            dateFin: dateFins.length > 0
                ? new Date(Math.max(...dateFins.map(d => new Date(d))))
                : null,
        });

        // ── Retourner le groupe populé ───────────────────────────────────────
        const groupePopule = await GroupeFormation.findById(groupeId)
            .populate('structure', 'nomFr nomEn')
            .populate('formateurs', 'nom prenom')
            .lean();

        return res.status(200).json({
            success: true,
            message: t('groupe_configure', lang),
            data: groupePopule
        });
    } catch (error) {
        console.error('Erreur configurerGroupe:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};


// Créer un groupe vide manuellement
// POST /themes/:themeId/groupes
export const creerGroupeManuel = async (req, res) => {
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

        // Numéro suivant global pour ce thème
        const nbExistants = await GroupeFormation.countDocuments({ theme: themeId });

        const groupe = await GroupeFormation.create({
            theme: themeId,
            structure: null,
            numeroGroupe: nbExistants + 1,
            statut: 'BROUILLON',
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: groupe,
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fusionner deux groupes
// POST /themes/:themeId/groupes/fusionner
// body: { groupeSourceId, groupeCibleId }
// ─────────────────────────────────────────────────────────────────────────────
export const fusionnerGroupes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { groupeSourceId, groupeCibleId } = req.body;

    if (!isValidId(groupeSourceId) || !isValidId(groupeCibleId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }
    if (groupeSourceId === groupeCibleId) {
        return res.status(400).json({ success: false, message: t('fusion_meme_groupe', lang) });
    }

    try {
        const [source, cible] = await Promise.all([
            GroupeFormation.findOne({ _id: groupeSourceId, theme: themeId }),
            GroupeFormation.findOne({ _id: groupeCibleId, theme: themeId }),
        ]);

        if (!source) {
            return res.status(404).json({ success: false, message: t('groupe_source_non_trouve', lang) });
        }
        if (!cible) {
            return res.status(404).json({ success: false, message: t('groupe_cible_non_trouve', lang) });
        }

        // Déplacer tous les participants du source vers la cible
        await ParticipantFormation.updateMany(
            { groupe: groupeSourceId },
            { $set: { groupe: groupeCibleId } }
        );

        // Supprimer le groupe source
        await GroupeFormation.findByIdAndDelete(groupeSourceId);

        const nombreParticipants = await ParticipantFormation.countDocuments({
            groupe: groupeCibleId
        });

        const groupeCiblePopule = await GroupeFormation.findById(groupeCibleId)
            .populate('structure', 'nomFr nomEn')
            .populate({
                path: 'formateurs',
                populate: { path: 'utilisateur', select: 'nom prenom' }
            })
            .lean();

        return res.status(200).json({
            success: true,
            message: t('groupes_fusionnes', lang),
            data: { groupe: groupeCiblePopule, nombreParticipants }
        });
    } catch (error) {
        console.error('Erreur fusionnerGroupes:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Déplacer un participant vers un autre groupe
// PATCH /themes/:themeId/groupes/deplacer-participant
// body: { participantFormationId, nouveauGroupeId }
// ─────────────────────────────────────────────────────────────────────────────
export const deplacerParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const { participantFormationId, nouveauGroupeId } = req.body;

    if (!isValidId(participantFormationId) || !isValidId(nouveauGroupeId)) {
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

        const nouveauGroupe = await GroupeFormation.findOne({
            _id: nouveauGroupeId,
            theme: themeId
        });
        if (!nouveauGroupe) {
            return res.status(404).json({ success: false, message: t('groupe_non_trouve', lang) });
        }

        const ancienGroupeId = participant.groupe;

        participant.groupe = nouveauGroupeId;
        participant.statut = 'AFFECTE';
        await participant.save();

        // Nettoyer l'ancien groupe s'il est maintenant vide
        if (ancienGroupeId) {
            const nbRestants = await ParticipantFormation.countDocuments({
                groupe: ancienGroupeId
            });
            if (nbRestants === 0) {
                await GroupeFormation.findByIdAndDelete(ancienGroupeId);
            }
        }

        const participantPopule = await ParticipantFormation.findById(participantFormationId)
            .populate('participant', 'nom prenom email matricule')
            .populate('structure', 'nomFr nomEn')
            .populate('groupe', 'numeroGroupe lieu statut structure')
            .lean();

        return res.status(200).json({
            success: true,
            message: t('participant_deplace', lang),
            data: participantPopule
        });
    } catch (error) {
        console.error('Erreur deplacerParticipant:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Supprimer un groupe (et remettre ses participants EN_ATTENTE)
// DELETE /themes/:themeId/groupes/:groupeId
// ─────────────────────────────────────────────────────────────────────────────
export const supprimerGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, groupeId } = req.params;

    if (!isValidId(themeId) || !isValidId(groupeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const groupe = await GroupeFormation.findOne({ _id: groupeId, theme: themeId });
        if (!groupe) {
            return res.status(404).json({ success: false, message: t('groupe_non_trouve', lang) });
        }

        // Remettre les participants EN_ATTENTE plutôt que de les supprimer
        await ParticipantFormation.updateMany(
            { groupe: groupeId },
            { $set: { groupe: null, statut: 'EN_ATTENTE' } }
        );

        await GroupeFormation.findByIdAndDelete(groupeId);

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang)
        });
    } catch (error) {
        console.error('Erreur supprimerGroupe:', error);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};