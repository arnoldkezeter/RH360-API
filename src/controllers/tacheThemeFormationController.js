import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import TacheThemeFormation from '../models/TacheThemeFormation.js';
import ThemeFormation from '../models/themeFormation.js';
import TacheGenerique from '../models/TacheGenerique.js';


//Lier une tache à un thème
export const lierTacheAuTheme = async (req, res) => {
    const { theme, tache, dateDebut, dateFin } = req.body;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(theme) || !mongoose.Types.ObjectId.isValid(tache)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang)
        });
    }

    try {
        const existeTheme = await ThemeFormation.findById(theme);
        const existeTache = await TacheGenerique.findById(tache);

        if (!existeTheme || !existeTache) {
            return res.status(404).json({ 
                success: false, 
                message: t('tache_ou_theme_introuvable', lang) 
            });
        }

        const dejaLiee = await TacheThemeFormation.findOne({ theme, tache });
        if (dejaLiee) {
            return res.status(400).json({ 
                success: false, 
                message: t('tache_deja_liee', lang) 
            });
        }

        const liaison = new TacheThemeFormation({ theme, tache, dateDebut, dateFin });
        await liaison.save();

        return res.status(201).json({ success: true, 
            message: t('liaison_tache_theme_reussie', lang), 
            data: liaison 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};


//Modifier la tache lier au thème
export const modifierTacheTheme = async (req, res) => {
    const { id } = req.params;
    const { dateDebut, dateFin, fichierJoint, donneesEnregistrees } = req.body;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, message: 
            t('identifiant_invalide', lang) 
        });
    }

    try {
        const tacheTheme = await TacheThemeFormation.findById(id);
        if (!tacheTheme) {
            return res.status(404).json({ 
                success: false, 
                message: t('liaison_introuvable', lang) 
            });
        }

        if (dateDebut) tacheTheme.dateDebut = dateDebut;
        if (dateFin) tacheTheme.dateFin = dateFin;
        if (fichierJoint) tacheTheme.fichierJoint = fichierJoint;
        if (donneesEnregistrees) tacheTheme.donneesEnregistrees = donneesEnregistrees;

        await tacheTheme.save();
        return res.status(200).json({ 
            success: true, 
            message: t('modifier_succes', lang), 
            data: tacheTheme 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

//Supprimer une liaison
export const supprimerTacheTheme = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const tacheTheme = await TacheThemeFormation.findByIdAndDelete(id);
        if (!tacheTheme) {
            return res.status(404).json({ 
                success: false, 
                message: t('liaison_introuvable', lang) 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: t('suppression_reussie', lang) 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: error.message 
        });
    }
};

//Lister les taches par thème
export const listerTachesParTheme = async (req, res) => {
    const { themeId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const themeExiste = await ThemeFormation.findById(themeId);
        if (!themeExiste) {
            return res.status(404).json({ 
                success: false, 
                message: t('theme_introuvable', lang) 
            });
        }

        const taches = await TacheThemeFormation.find({ theme: themeId })
        .populate('tache')
        .populate('theme')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        const total = await TacheThemeFormation.countDocuments({ theme: themeId });

        return res.status(200).json({
            success: true,
            data: taches,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    }
};

//Valider l'exécution d'une tache
export const validerExecutionTacheTheme = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { methodeValidation, fichierJoint, donneesEnregistrees, dateExecution } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang)
        });
    }

    if (!methodeValidation || !['manuelle', 'donnees', 'fichier', 'automatique'].includes(methodeValidation)) {
        return res.status(400).json({
            success: false,
            message: t('methode_validation_invalide', lang)
        });
    }

    try {
        const tache = await TacheThemeFormation.findById(id);
        if (!tache) {
            return res.status(404).json({
                success: false,
                message: t('tache_theme_non_trouvee', lang)
            });
        }

        if (tache.estExecutee) {
            return res.status(400).json({
                success: false,
                message: t('tache_deja_executee', lang)
            });
        }

        // Appliquer les validations selon la méthode
        switch (methodeValidation) {
            case 'manuelle':
                // rien à vérifier, autorisé si responsable
                break;
            case 'donnees':
                if (!donneesEnregistrees || Object.keys(donneesEnregistrees).length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: t('donnees_validation_requises', lang)
                    });
                }
                tache.donneesEnregistrees = donneesEnregistrees;
                break;
            case 'fichier':
                if (!fichierJoint) {
                    return res.status(400).json({
                        success: false,
                        message: t('fichier_validation_requis', lang)
                    });
                }
                tache.fichierJoint = fichierJoint;
                break;
            case 'automatique':
                // rien à faire ici, logique automatisée côté app ou backend
                break;
        }

        // Mise à jour de l'état
        tache.estExecutee = true;
        tache.dateExecution = dateExecution || new Date();
        tache.methodeValidation = methodeValidation;

        await tache.save();

        return res.status(200).json({
            success: true,
            message: t('tache_executee_succes', lang),
            data: tache
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};
