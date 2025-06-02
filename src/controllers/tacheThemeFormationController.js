import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import TacheThemeFormation from '../models/TacheThemeFormation.js';
import ThemeFormation from '../models/ThemeFormation.js';
import TacheGenerique from '../models/TacheGenerique.js';
import Formation from '../models/Fomation.js';


//Lier une tache à un thème
export const lierTacheAuTheme = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { theme, tache, dateDebut, dateFin } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(theme) || !mongoose.Types.ObjectId.isValid(tache)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        const existeTheme = await ThemeFormation.findById(theme).session(session);
        const existeTache = await TacheGenerique.findById(tache).session(session);
        if (!existeTheme || !existeTache) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: t('tache_ou_theme_introuvable', lang) });
        }

        const dejaLiee = await TacheThemeFormation.findOne({ theme, tache }).session(session);
        if (dejaLiee) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('tache_deja_liee', lang) });
        }

        const liaison = await TacheThemeFormation.create([{ theme, tache, dateDebut, dateFin }], { session });

        existeTheme.nbTachesTotal = (existeTheme.nbTachesTotal || 0) + 1;

        await existeTheme.save({ session });

        // MAJ du compteur dans la formation
        const formation = await Formation.findById(existeTheme.formation).session(session);
        if (formation) {
            formation.nbTachesTotal = (formation.nbTachesTotal || 0) + 1;
            await formation.save({ session });
        }

        await session.commitTransaction();
        return res.status(201).json({ success: true, message: t('liaison_tache_theme_reussie', lang), data: liaison[0] });
    } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    } finally {
        session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();

    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        const tacheTheme = await TacheThemeFormation.findById(id).session(session);
        if (!tacheTheme) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: t('liaison_introuvable', lang) });
        }

        const theme = await ThemeFormation.findById(tacheTheme.theme).session(session);
        if (theme) {
            theme.nbTachesTotal = Math.max(0, (theme.nbTachesTotal || 0) - 1);
            if (tacheTheme.estExecutee) {
                theme.nbTachesExecutees = Math.max(0, (theme.nbTachesExecutees || 0) - 1);
            }
            await theme.save({ session });

            const formation = await Formation.findById(theme.formation).session(session);
            if (formation) {
                formation.nbTachesTotal = Math.max(0, (formation.nbTachesTotal || 0) - 1);
                if (tacheTheme.estExecutee) {
                    formation.nbTachesExecutees = Math.max(0, (formation.nbTachesExecutees || 0) - 1);
                }
                await formation.save({ session });
            }
        }

        await TacheThemeFormation.findByIdAndDelete(id).session(session);
        await session.commitTransaction();

        return res.status(200).json({ success: true, message: t('suppression_reussie', lang) });
    } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: error.message });
    } finally {
        session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();

    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const { methodeValidation, fichierJoint, donneesEnregistrees, dateExecution } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        if (!methodeValidation || !['manuelle', 'donnees', 'fichier', 'automatique'].includes(methodeValidation)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('methode_validation_invalide', lang) });
        }

        const tache = await TacheThemeFormation.findById(id).session(session);
        if (!tache) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: t('tache_theme_non_trouvee', lang) });
        }

        if (tache.estExecutee) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: t('tache_deja_executee', lang) });
        }

        switch (methodeValidation) {
            case 'donnees':
                if (!donneesEnregistrees || Object.keys(donneesEnregistrees).length === 0) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: t('donnees_validation_requises', lang) });
                }
                tache.donneesEnregistrees = donneesEnregistrees;
                break;
            case 'fichier':
                if (!fichierJoint) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: t('fichier_validation_requis', lang) });
                }
                tache.fichierJoint = fichierJoint;
                break;
        }

        tache.estExecutee = true;
        tache.dateExecution = dateExecution || new Date();
        tache.methodeValidation = methodeValidation;

        await tache.save({ session });

        // Mise à jour des compteurs côté thème et formation
        const theme = await ThemeFormation.findById(tache.theme).session(session);
        if (theme) {
            theme.nbTachesExecutees = (theme.nbTachesExecutees || 0) + 1;
            await theme.save({ session });

            const formation = await Formation.findById(theme.formation).session(session);
            if (formation) {
                formation.nbTachesExecutees = (formation.nbTachesExecutees || 0) + 1;
                await formation.save({ session });
            }
        }

        await session.commitTransaction();
        return res.status(200).json({ success: true, message: t('tache_executee_succes', lang), data: tache });

    } catch (err) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    } finally {
        session.endSession();
    }
};

// export const validerExecutionTacheTheme = async (req, res) => {
//     const { id } = req.params;
//     const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
//     const { methodeValidation, fichierJoint, donneesEnregistrees, dateExecution } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//             success: false,
//             message: t('identifiant_invalide', lang)
//         });
//     }

//     if (!methodeValidation || !['manuelle', 'donnees', 'fichier', 'automatique'].includes(methodeValidation)) {
//         return res.status(400).json({
//             success: false,
//             message: t('methode_validation_invalide', lang)
//         });
//     }

//     try {
//         const tache = await TacheThemeFormation.findById(id);
//         if (!tache) {
//             return res.status(404).json({
//                 success: false,
//                 message: t('tache_theme_non_trouvee', lang)
//             });
//         }

//         if (tache.estExecutee) {
//             return res.status(400).json({
//                 success: false,
//                 message: t('tache_deja_executee', lang)
//             });
//         }

//         // Appliquer les validations selon la méthode
//         switch (methodeValidation) {
//             case 'manuelle':
//                 // rien à vérifier, autorisé si responsable
//                 break;
//             case 'donnees':
//                 if (!donneesEnregistrees || Object.keys(donneesEnregistrees).length === 0) {
//                     return res.status(400).json({
//                         success: false,
//                         message: t('donnees_validation_requises', lang)
//                     });
//                 }
//                 tache.donneesEnregistrees = donneesEnregistrees;
//                 break;
//             case 'fichier':
//                 if (!fichierJoint) {
//                     return res.status(400).json({
//                         success: false,
//                         message: t('fichier_validation_requis', lang)
//                     });
//                 }
//                 tache.fichierJoint = fichierJoint;
//                 break;
//             case 'automatique':
//                 // rien à faire ici, logique automatisée côté app ou backend
//                 break;
//         }

//         // Mise à jour de l'état
//         tache.estExecutee = true;
//         tache.dateExecution = dateExecution || new Date();
//         tache.methodeValidation = methodeValidation;

//         await tache.save();

//         return res.status(200).json({
//             success: true,
//             message: t('tache_executee_succes', lang),
//             data: tache
//         });

//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: t('erreur_serveur', lang),
//             error: err.message
//         });
//     }
// };


// export const lierTacheAuTheme = async (req, res) => {

//     const { theme, tache, dateDebut, dateFin } = req.body;
//     const lag = req.headers['accept-language']?.toLowerCase() || 'fr';

//     if (!mongoose.Types.ObjectId.isValid(theme) || !mongoose.Types.ObjectId.isValid(tache)) {
//         return res.status(400).json({ 
//             success: false, 
//             message: t('identifiant_invalide', lang)
//         });
//     }

//     try {
//         const existeTheme = await ThemeFormation.findById(theme);
//         const existeTache = await TacheGenerique.findById(tache);

//         if (!existeTheme || !existeTache) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: t('tache_ou_theme_introuvable', lang) 
//             });
//         }

//         const dejaLiee = await TacheThemeFormation.findOne({ theme, tache });
//         if (dejaLiee) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: t('tache_deja_liee', lang) 
//             });
//         }

//         const liaison = new TacheThemeFormation({ theme, tache, dateDebut, dateFin });
//         await liaison.save();

//         return res.status(201).json({ success: true, 
//             message: t('liaison_tache_theme_reussie', lang), 
//             data: liaison 
//         });
//     } catch (error) {
//         return res.status(500).json({ 
//             success: false, 
//             message: t('erreur_serveur', lang), 
//             error: error.message 
//         });
//     }
// };

// export const supprimerTacheTheme = async (req, res) => {
//     const { id } = req.params;
//     const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ 
//             success: false, 
//             message: t('identifiant_invalide', lang) 
//         });
//     }

//     try {
//         const tacheTheme = await TacheThemeFormation.findByIdAndDelete(id);
//         if (!tacheTheme) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: t('liaison_introuvable', lang) 
//             });
//         }

//         return res.status(200).json({ 
//             success: true, 
//             message: t('suppression_reussie', lang) 
//         });
//     } catch (error) {
//         return res.status(500).json({ 
//             success: false, 
//             message: t('erreur_serveur', lang), 
//             error: error.message 
//         });
//     }
// };