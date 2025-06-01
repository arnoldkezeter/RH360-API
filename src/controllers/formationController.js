import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import ThemeFormation from '../models/themeFormation.js';
import { calculerAge } from '../utils/calculerAge.js';
import Formation from '../models/Fomation.js';

// Ajouter
export const createFormation = async (req, res) => {
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
        const { titreFr, titreEn, descriptionFr, descriptionEn, axeStrategique, programmeFormation } = req.body;

        const existsFr = await Formation.exists({ titreFr });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_fr', lang),
            });
        }

        const existsEn = await Formation.exists({ titreEn });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_en', lang),
            });
        }

        const formation = await Formation.create({
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            familleMetier:[],
            axeStrategique,
            programmeFormation
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: formation,
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
export const updateFormation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { titreFr, titreEn, descriptionFr, descriptionEn, axeStrategique, programmeFormation } = req.body;

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
        const formation = await Formation.findById(id);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        const existsFr = await Formation.findOne({ titreFr, _id: { $ne: id } });
        if (existsFr) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_fr', lang),
            });
        }

        const existsEn = await Formation.findOne({ titreEn, _id: { $ne: id } });
        if (existsEn) {
            return res.status(409).json({
                success: false,
                message: t('formation_existante_en', lang),
            });
        }

        if (titreFr) formation.titreFr = titreFr;
        if (titreEn) formation.titreEn = titreEn;
        if (descriptionFr !== undefined) formation.descriptionFr = descriptionFr;
        if (descriptionEn !== undefined) formation.descriptionEn = descriptionEn;
        if (axeStrategique !== undefined) formation.axeStrategique = axeStrategique;
        if (programmeFormation !== undefined) formation.programmeFormation = programmeFormation;

        await formation.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: formation,
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
export const deleteFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(id);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        await Formation.deleteOne({ _id: id });

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

//Ajouter une famille metier
export const ajouterFamilleMetierAFormation = async (req, res) => {
    const { idFormation, idFamilleMetier } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(idFormation) || !mongoose.Types.ObjectId.isValid(idFamilleMetier)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(idFormation);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        if (!formation.familleMetier.includes(idFamilleMetier)) {
            formation.familleMetier.push(idFamilleMetier);
            await formation.save();
        }

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: formation,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

//Supprimer une famille metier
export const supprimerFamilleMetierDeFormation = async (req, res) => {
    const { idFormation, idFamilleMetier } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(idFormation) || !mongoose.Types.ObjectId.isValid(idFamilleMetier)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(idFormation);
        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        formation.familleMetier = formation.familleMetier.filter(fm => fm.toString() !== idFamilleMetier);
        await formation.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: formation,
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
export const getFormationsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const formations = await Formation.find({}, '_id titreFr titreEn')
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: formations,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Liste avec pagination
export const getFormations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    try {
        const total = await Formation.countDocuments();
        const formations = await Formation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
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


// Formation par ID
export const getFormationById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const formation = await Formation.findById(id)
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        if (!formation) {
            return res.status(404).json({
                success: false,
                message: t('formation_non_trouvee', lang),
            });
        }

        const [enriched] = await enrichirFormations([formation]);

        return res.status(200).json({
            success: true,
            data: enriched,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Recherche par titre
export const searchFormationByTitre = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { titre } = req.query;

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const field = lang === 'en' ? 'titreEn' : 'titreFr';

        const formations = await Formation.find({
            [field]: { $regex: new RegExp(titre, 'i') },
        })
            .populate('familleMetier axeStrategique programmeFormation')
            .sort({ [field]: 1 })
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Filtrer les formations par famille metier
export const getFormationsByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const total = await Formation.countDocuments({ familleMetier: id });
        const formations = await Formation.find({ familleMetier: id })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
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



//Filtrer les formations par axeStrategique
export const getFormationsByAxeStrategique = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const total = await Formation.countDocuments({ axeStrategique: id });
        const formations = await Formation.find({ axeStrategique: id })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
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



//Filtrer les formations par periode
export const getFormationsByPeriode = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { debut, fin } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!debut || !fin) {
        return res.status(400).json({
            success: false,
            message: t('dates_requises', lang),
        });
    }

    try {
        const themes = await ThemeFormation.find({
            dateDebut: { $gte: new Date(debut) },
            dateFin: { $lte: new Date(fin) },
        }).lean();

        const formationIds = [...new Set(themes.map(t => t.formation.toString()))];

        const total = await Formation.countDocuments({ _id: { $in: formationIds } });

        const formations = await Formation.find({ _id: { $in: formationIds } })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: 1 })
            .populate('familleMetier axeStrategique programmeFormation')
            .lean();

        const enriched = await enrichirFormations(formations);

        return res.status(200).json({
            success: true,
            data: enriched,
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



//Statistiques

//Stat par sexe
export const getStatsParSexe = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate({
            path: 'lieux.cohorte',
            populate: { path: 'participants', select: 'sexe' },
        });

        const stats = { homme: 0, femme: 0 };

        themes.forEach(theme => {
            theme.lieux.forEach(lieu => {
                lieu.cohorte?.participants?.forEach(participant => {
                    if (participant.sexe === 'H') stats.homme++;
                    else if (participant.sexe === 'F') stats.femme++;
                });
            });
        });

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


// Stats par service
export const getStatsParService = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate({
            path: 'lieux.cohorte',
            populate: { path: 'participants', select: 'service' },
        });

        const stats = {};

        themes.forEach(theme => {
            theme.lieux.forEach(lieu => {
                lieu.cohorte?.participants?.forEach(p => {
                    const idService = p.service?.toString();
                    if (!stats[idService]) stats[idService] = 0;
                    stats[idService]++;
                });
            });
        });

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Stats par tranche d'âge
export const getStatsParTrancheAge = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate({
            path: 'lieux.cohorte',
            populate: { path: 'participants', select: 'dateNaissance' },
        });

        const tranches = {
            '18-25': 0,
            '26-35': 0,
            '36-45': 0,
            '46-60': 0,
            '60+': 0,
        };

        themes.forEach(theme => {
            theme.lieux.forEach(lieu => {
                lieu.cohorte?.participants?.forEach(p => {
                    const age = calculerAge(p.dateNaissance);
                    if (age >= 18 && age <= 25) tranches['18-25']++;
                    else if (age <= 35) tranches['26-35']++;
                    else if (age <= 45) tranches['36-45']++;
                    else if (age <= 60) tranches['46-60']++;
                    else if (age > 60) tranches['60+']++;
                });
            });
        });

        return res.status(200).json({ success: true, data: tranches });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Stats par catégorie
export const getStatsParCategoriePro = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate({
            path: 'lieux.cohorte',
            populate: { path: 'participants', select: 'categorieProfessionnelle' },
        });

        const stats = {};

        themes.forEach(theme => {
            theme.lieux.forEach(lieu => {
                lieu.cohorte?.participants?.forEach(p => {
                    const idCat = p.categorieProfessionnelle?.toString();
                    if (!stats[idCat]) stats[idCat] = 0;
                    stats[idCat]++;
                });
            });
        });

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Nombre total de personne formé
export const getNombreTotalFormes = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate({
            path: 'lieux.cohorte',
            populate: { path: 'participants', select: '_id' },
        });

        const participants = new Set();

        themes.forEach(theme => {
            theme.lieux.forEach(lieu => {
                lieu.cohorte?.participants?.forEach(p => {
                    participants.add(p._id.toString());
                });
            });
        });

        return res.status(200).json({ success: true, data: participants.size });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Formateur par type
export const getNbFormateursParType = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const themes = await ThemeFormation.find({ formation: id }).populate('formateurs').lean();

        const stats = { interne: 0, externe: 0 };
        const dejaCompte = new Set();

        themes.forEach(theme => {
            theme.formateurs.forEach(f => {
                if (dejaCompte.has(f._id.toString())) return;
                dejaCompte.add(f._id.toString());
                if (f.type === 'interne') stats.interne++;
                else if (f.type === 'externe') stats.externe++;
            });
        });

        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};


//Dépenses par thème de formation
export const getDepensesParThemePourFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        // Récupère tous les thèmes de la formation
        const themes = await ThemeFormation.find({ formation: id }).lean();

        if (themes.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: t('aucun_theme_trouve', lang),
            });
        }

        const themeIds = themes.map(t => t._id);
        const budgets = await BudgetFormation.find({ theme: { $in: themeIds } }).lean();

        const depensesParTheme = {};

        for (const budget of budgets) {
            const themeId = budget.theme.toString();
            if (!depensesParTheme[themeId]) {
                depensesParTheme[themeId] = {
                    themeId,
                    titreFr: themes.find(t => t._id.toString() === themeId)?.titreFr || '',
                    titreEn: themes.find(t => t._id.toString() === themeId)?.titreEn || '',
                    totalPrevu: 0,
                    totalReel: 0,
                };
            }

            for (const ligne of budget.lignes) {
                const prevu = ligne.montantUnitairePrevuHT || 0;
                const reel = ligne.montantUnitaireReelHT || 0;
                const quantite = ligne.quantite || 0;

                depensesParTheme[themeId].totalPrevu += prevu * quantite;
                depensesParTheme[themeId].totalReel += reel * quantite;
            }
        }

        return res.status(200).json({
            success: true,
            data: Object.values(depensesParTheme),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


