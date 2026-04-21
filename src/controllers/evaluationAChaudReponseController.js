// controllers/evaluationAChaudReponseController.js
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import Utilisateur from '../models/Utilisateur.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import { calculerProgression, formatRubriques } from '../services/evaluationAChaudService.js';


// ═══════════════════════════════════════════════════════════════════════════════
// SAUVEGARDE BROUILLON
// ═══════════════════════════════════════════════════════════════════════════════

export const saveDraftEvaluationAChaudReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const { utilisateur, modele, rubriques = [], commentaireGeneral } = req.body;

        if (!utilisateur || !modele) {
            return res.status(400).json({ success: false, message: t('champs_obligatoires', lang) });
        }

        const [userExists, evaluationModel] = await Promise.all([
            Utilisateur.findById(utilisateur).select('_id').lean(),
            EvaluationAChaud.findById(modele).lean(),
        ]);

        if (!userExists)      return res.status(404).json({ success: false, message: t('utilisateur_non_trouve', lang) });
        if (!evaluationModel) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });

        const rubriquesFormattees = formatRubriques(rubriques);
        const progression         = calculerProgression(rubriquesFormattees, evaluationModel);

        // CORRECTION : déclaration de let reponse avant le if/else (variable non déclarée dans l'original)
        let reponse;
        const reponseExistante = await EvaluationAChaudReponse.findOne({
            utilisateur: new mongoose.Types.ObjectId(utilisateur),
            modele:      new mongoose.Types.ObjectId(modele),
            statut:      'brouillon',
        });

        const reponseData = {
            utilisateur:      new mongoose.Types.ObjectId(utilisateur),
            modele:           new mongoose.Types.ObjectId(modele),
            rubriques:        rubriquesFormattees,
            commentaireGeneral: commentaireGeneral || '',
            statut:           'brouillon',
            progression,
            dateSoumission:   null,
        };

        if (reponseExistante) {
            Object.assign(reponseExistante, reponseData);
            await reponseExistante.save();
            reponse = reponseExistante;
        } else {
            reponse = await EvaluationAChaudReponse.create(reponseData);
        }

        return res.status(200).json({
            success: true,
            message: t('brouillon_sauvegarde', lang),
            data: { id: reponse._id, statut: reponse.statut, progression, dateSauvegarde: reponse.updatedAt },
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOUMISSION DÉFINITIVE
// ═══════════════════════════════════════════════════════════════════════════════

export const submitEvaluationAChaudReponse = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: t('champs_obligatoires', lang), errors: errors.array().map(e => e.msg) });
    }

    try {
        const { utilisateur, modele, rubriques = [], commentaireGeneral } = req.body;

        if (!rubriques.length) {
            return res.status(400).json({ success: false, message: t('rubriques_obligatoires', lang) });
        }

        // Validation structurelle avant DB
        const validationErrors = [];
        let totalQuestions     = 0;

        for (const rubrique of rubriques) {
            if (!rubrique.rubriqueId || !Array.isArray(rubrique.questions)) {
                validationErrors.push(`Rubrique ${rubrique.rubriqueId || 'inconnue'} : structure invalide`);
                continue;
            }
            for (const question of rubrique.questions) {
                if (!question.questionId) {
                    validationErrors.push(`Question manquante dans rubrique ${rubrique.rubriqueId}`);
                    continue;
                }
                const hasDirecte      = !!question.reponseEchelleId;
                const hasSousQuestions = question.sousQuestions?.length > 0;
                const hasCommentaire  = !!question.commentaireGlobal;

                // Une question doit avoir au moins une réponse (directe, sous-question ou commentaire)
                if (!hasDirecte && !hasSousQuestions && !hasCommentaire) {
                    // On l'accepte silencieusement (brouillon partiel possible)
                }
                if (hasDirecte && hasSousQuestions) {
                    validationErrors.push(`Question ${question.questionId} : réponse directe ET sous-questions en conflit`);
                }
                if (hasSousQuestions) {
                    for (const sq of question.sousQuestions) {
                        if (!sq.sousQuestionId || !sq.reponseEchelleId) {
                            validationErrors.push(`Sous-question ${sq.sousQuestionId || 'inconnue'} : réponse incomplète`);
                        }
                    }
                    totalQuestions += question.sousQuestions.length;
                } else {
                    totalQuestions += 1;
                }
            }
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: t('donnees_invalides', lang), errors: validationErrors });
        }

        const [userExists, evaluationModel] = await Promise.all([
            Utilisateur.findById(utilisateur).select('_id').lean(),
            EvaluationAChaud.findById(modele).select('_id titreFr titreEn rubriques').lean(),
        ]);

        if (!userExists)      return res.status(404).json({ success: false, message: t('utilisateur_non_trouve', lang) });
        if (!evaluationModel) return res.status(404).json({ success: false, message: t('evaluation_non_trouvee', lang) });

        // CORRECTION : vérification manuelle du doublon soumis (index partiel supprimé)
        const dejaSoumis = await EvaluationAChaudReponse.findOne({
            utilisateur: new mongoose.Types.ObjectId(utilisateur),
            modele:      new mongoose.Types.ObjectId(modele),
            statut:      'soumis',
        });
        if (dejaSoumis) {
            return res.status(409).json({ success: false, message: t('evaluation_deja_repondu', lang) });
        }

        const rubriquesFormattees = formatRubriques(rubriques);
        const progression         = calculerProgression(rubriquesFormattees, evaluationModel);

        // Convertir le brouillon existant en soumis, ou créer directement
        const brouillon = await EvaluationAChaudReponse.findOne({
            utilisateur: new mongoose.Types.ObjectId(utilisateur),
            modele:      new mongoose.Types.ObjectId(modele),
            statut:      'brouillon',
        });

        let reponse;
        if (brouillon) {
            brouillon.rubriques         = rubriquesFormattees;
            brouillon.commentaireGeneral = commentaireGeneral || '';
            brouillon.statut            = 'soumis';
            brouillon.progression       = progression;
            brouillon.dateSoumission    = new Date();
            await brouillon.save();
            reponse = brouillon;
        } else {
            reponse = await EvaluationAChaudReponse.create({
                utilisateur:      new mongoose.Types.ObjectId(utilisateur),
                modele:           new mongoose.Types.ObjectId(modele),
                rubriques:        rubriquesFormattees,
                commentaireGeneral: commentaireGeneral || '',
                statut:           'soumis',
                progression,
                dateSoumission:   new Date(),
            });
        }

        return res.status(201).json({
            success: true,
            message: t('soumis_succes', lang),
            data: {
                id:             reponse._id,
                statut:         reponse.statut,
                progression,
                dateSoumission: reponse.dateSoumission,
                totalRubriques: rubriques.length,
                totalQuestions,
            },
        });

    } catch (err) {
        switch (err.name) {
            case 'ValidationError':
                return res.status(400).json({ success: false, message: t('donnees_invalides', lang), errors: Object.values(err.errors).map(e => e.message) });
            case 'CastError':
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LECTURE
// ═══════════════════════════════════════════════════════════════════════════════

/** Réponse d'un utilisateur pour une évaluation donnée */
export const getReponseUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { utilisateurId, modeleId } = req.params;

    try {
        const reponse = await EvaluationAChaudReponse.findOne({
            utilisateur: utilisateurId,
            modele:      modeleId,
        })
        .populate('modele', 'titreFr titreEn rubriques objectifs dateFormation')
        .lean();

        if (!reponse) {
            return res.status(404).json({ success: false, message: t('reponse_non_trouvee', lang) });
        }

        return res.status(200).json({ success: true, data: reponse });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/** Toutes les réponses d'un utilisateur (liste paginée) */
export const getReponsesParUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { utilisateurId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const total   = await EvaluationAChaudReponse.countDocuments({ utilisateur: utilisateurId });
        const reponses = await EvaluationAChaudReponse.find({ utilisateur: utilisateurId })
            .populate('modele', 'titreFr titreEn dateFormation rubriques')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            data: { reponses, totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit), pageSize: limit },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/** Réponses pour une évaluation (vue admin) */
export const getReponsesParEvaluation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const filter = { modele: evaluationId, statut: 'soumis' }; // ← Filtrer uniquement les soumis
        const total  = await EvaluationAChaudReponse.countDocuments(filter);
        const reponses = await EvaluationAChaudReponse.find(filter)
            .populate('utilisateur', 'nom prenom matricule email structure service posteDeTravail')
            .sort({ dateSoumission: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            data: { reponses, totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit), pageSize: limit },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

/**
 * Export des réponses en CSV
 * GET /api/evaluations-chaud/reponses/evaluation/:evaluationId/export-csv
 */
export const exportReponsesCSV = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { evaluationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const reponses = await EvaluationAChaudReponse.find({ modele: evaluationId, statut: 'soumis' })
            .populate('utilisateur', 'nom prenom matricule email')
            .populate('modele', 'titreFr titreEn')
            .lean();

        if (reponses.length === 0) {
            return res.status(404).json({ success: false, message: t('aucune_reponse', lang) });
        }

        // Construction du CSV
        const rows = [];
        const headers = ['Utilisateur', 'Email', 'Date soumission', 'Progression', 'Commentaire général'];

        for (const reponse of reponses) {
            const user = reponse.utilisateur || {};
            rows.push({
                utilisateur: `${user.nom || ''} ${user.prenom || ''}`.trim(),
                email: user.email || '',
                dateSoumission: reponse.dateSoumission ? new Date(reponse.dateSoumission).toLocaleDateString('fr-FR') : '',
                progression: `${reponse.progression || 0}%`,
                commentaireGeneral: reponse.commentaireGeneral || ''
            });
        }

        // Générer CSV
        const csvHeaders = headers.join(',');
        const csvRows = rows.map(row => 
            headers.map(h => `"${String(row[h.toLowerCase().replace(' ', '')] || '').replace(/"/g, '""')}"`).join(',')
        );
        const csv = [csvHeaders, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=reponses_evaluation_${evaluationId}.csv`);
        return res.status(200).send(csv);

    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};