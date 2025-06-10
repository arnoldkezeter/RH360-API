
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import ThemeFormation from '../models/ThemeFormation.js';
import Formation from '../models/Formation.js';
import BudgetFormation from '../models/BudgetFormation.js';


//Récupéré les 10 prochains thème du programme
export const get10ProchainsThemesDuProgramme = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const today = new Date();

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({
            dateDebut: { $gte: today }
        })
        .populate({
            path: 'formation',
            match: { programme: programmeId },
            select: 'titreFr titreEn'
        })
        .sort({ dateDebut: 1 })
        .limit(10)
        .lean();

        const filteredThemes = themes.filter(theme => theme.formation);

        return res.status(200).json({ success: true, data: filteredThemes });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Répartition des différents thème d'un programme par axe stratégique
export const getRepartitionFormationsParAxe = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const repartition = await Formation.aggregate([
            { $match: { programme: new mongoose.Types.ObjectId(programmeId) } },
            {
                $group: {
                    _id: "$axeStrategique",
                    totalFormations: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "axestrategiques",
                    localField: "_id",
                    foreignField: "_id",
                    as: "axe"
                }
            },
            { $unwind: "$axe" },
            {
                $project: {
                    _id: 0,
                    axeId: "$axe._id",
                    nomFr: "$axe.nomFr",
                    nomEn: "$axe.nomEn",
                    totalFormations: 1
                }
            }
        ]);

        return res.status(200).json({ success: true, data: repartition });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Nombre de formateur pour un programme
export const getStatsFormateursParProgramme = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const formations = await Formation.find({ programme: programmeId }).select('_id').lean();
        const formationIds = formations.map(f => f._id);

        const formateurs = await ThemeFormation.aggregate([
            { $match: { formation: { $in: formationIds } } },
            { $unwind: "$formateurs" },
            {
                $lookup: {
                    from: "formateurs",
                    localField: "formateurs",
                    foreignField: "_id",
                    as: "formateur"
                }
            },
            { $unwind: "$formateur" },
            {
                $group: {
                    _id: "$formateur._id",
                    type: { $first: "$formateur.type" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    internes: {
                        $sum: { $cond: [{ $eq: ["$type", "interne"] }, 1, 0] }
                    },
                    externes: {
                        $sum: { $cond: [{ $eq: ["$type", "externe"] }, 1, 0] }
                    }
                }
            }
        ]);

        return res.status(200).json({ success: true, data: formateurs[0] || { total: 0, internes: 0, externes: 0 } });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//taux d'execution mensuel par formation d'un programme
export const getTauxExecutionMensuelParFormation = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const formations = await Formation.find({ programme: programmeId })
            .select('_id titreFr titreEn')
            .lean();

        const results = [];

        for (const formation of formations) {
            const themes = await ThemeFormation.find({ formation: formation._id }).select('dateDebut nbTaches nbTachesExecutees').lean();

            const grouped = {};

            themes.forEach(theme => {
                const mois = new Date(theme.dateDebut).toISOString().slice(0, 7); // ex: "2025-06"
                if (!grouped[mois]) grouped[mois] = { total: 0, executees: 0 };

                grouped[mois].total += theme.nbTaches || 0;
                grouped[mois].executees += theme.nbTachesExecutees || 0;
            });

            const parMois = Object.entries(grouped).map(([mois, val]) => ({
                mois,
                tauxExecution: val.total > 0 ? Math.round((val.executees / val.total) * 100) : 0
            }));

            results.push({
                formationId: formation._id,
                formationTitreFr: formation.titreFr,
                formationTitreEn: formation.titreEn,
                executionMensuelle: parMois
            });
        }

        return res.status(200).json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Budget total des formations d'un programme
export const getBudgetTotalParProgramme = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const formations = await Formation.find({ programme: programmeId }).select('_id').lean();
        const formationIds = formations.map(f => f._id);

        const themes = await ThemeFormation.find({ formation: { $in: formationIds } }).select('_id').lean();
        const themeIds = themes.map(t => t._id);

        const budgets = await BudgetFormation.aggregate([
            { $match: { theme: { $in: themeIds } } },
            { $unwind: "$lignes" },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $multiply: ["$lignes.montantUnitaireReelHT", "$lignes.quantite"]
                        }
                    }
                }
            }
        ]);

        return res.status(200).json({ success: true, data: budgets[0]?.total || 0 });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};
