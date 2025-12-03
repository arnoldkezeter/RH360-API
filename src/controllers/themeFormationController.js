// controllers/themeFormationController.js
import PosteDeTravail from '../models/PosteDeTravail.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import ThemeFormation from '../models/ThemeFormation.js';
import { calculerCoutTotalPrevu } from '../services/budgetFormationService.js';
import BudgetFormation from '../models/BudgetFormation.js';
import Depense from '../models/Depense.js';
import Utilisateur from '../models/Utilisateur.js';
import { addRoleToUser, removeRoleFromUserIfUnused } from '../utils/utilisateurRole.js';
import { LieuFormation } from '../models/LieuFormation.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import { Formateur } from '../models/Formateur.js';
import { sendMailFormation } from '../utils/sendMailFormation.js';
import FamilleMetier from '../models/FamilleMetier.js';
import Structure from '../models/Structure.js';
import Service from '../models/Service.js';
import { isUserInPublicCible } from '../services/formationService.js';
import { checkUserTargeting } from './noteServiceController.js';
import TacheGenerique from '../models/TacheGenerique.js';
import TacheThemeFormation from '../models/TacheThemeFormation.js';


const isValidObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id);
};


/**
 * Normalise et valide la structure du publicCible côté serveur
 * Attend un tableau d'objets au format :
 * [
 *   {
 *     familleMetier: { _id: '...' } ou 'idString',
 *     postes: [
 *       {
 *         poste: { _id: '...' } ou 'idString',
 *         structures: [
 *           {
 *             structure: { _id: '...' } ou 'idString',
 *             services: [{ service: { _id: '...' } || 'idString' }]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * ]
 *
 * Retourne { ok: true, data: formattedArray } ou { ok: false, message: '...' }
 */
const validateAndFormatPublicCible = async (publicCible, lang) => {
    const formatted = [];

    if (!publicCible) return { ok: true, data: [] };

    if (!Array.isArray(publicCible)) {
        return { ok: false, message: t('identifiant_invalide', lang) };
    }

    // ✅ CORRECTION 1: Validation de l'existence des familles de métier
    for (const fam of publicCible) {
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

                // ✅ CORRECTION 2: Vérifier que le poste existe ET appartient à la famille
                const poste = await PosteDeTravail.findById(posId);
                if (!poste) {
                    return { ok: false, message: `Poste de travail ${posId} introuvable` };
                }
                // Vérifier que le poste appartient bien à cette famille (un poste peut avoir plusieurs familles)
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

                        // ✅ CORRECTION 3: Vérifier que la structure existe
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

                                // ✅ CORRECTION 4: Vérifier que le service existe ET appartient à la structure
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

// Ajouter
export const createThemeFormation = async (req, res) => {
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
        const { titreFr, titreEn, dateDebut, dateFin, responsable, formation, publicCible } = req.body;

        // Validate formation & responsable (accepte soit objet {_id} soit string id)
        if (formation) {
            const formationId = formation._id || formation;
            if (!isValidObjectId(formationId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
        }

        if (responsable) {
            const respId = responsable._id || responsable;
            if (!isValidObjectId(respId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
        }

        // ✅ CORRECTION 5: Validation ASYNCHRONE du publicCible
        const vc = await validateAndFormatPublicCible(publicCible, lang);
        if (!vc.ok) {
            return res.status(400).json({ success: false, message: vc.message });
        }
        const publicCibleFormatted = vc.data;

        // Vérification unicité titres
        if (await ThemeFormation.exists({ titreFr })) {
            return res.status(409).json({ success: false, message: t('theme_existante_fr', lang) });
        }
        if (await ThemeFormation.exists({ titreEn })) {
            return res.status(409).json({ success: false, message: t('theme_existante_en', lang) });
        }

        // Création
        const theme = await ThemeFormation.create({
            titreFr,
            titreEn,
            dateDebut,
            dateFin,
            responsable: responsable?._id || responsable || undefined,
            formation: formation?._id || formation || undefined,
            publicCible: publicCibleFormatted
        });

        // Gestion rôle responsable
        const newRespId = responsable?._id || responsable;
        if (newRespId) {
            await addRoleToUser(newRespId, 'RESPONSABLE-FORMATION');
        }

        // Peupler pour retour
        const themePopule = await ThemeFormation.findById(theme._id)
            .populate('responsable')
            .populate('formation')
            .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } });

        // Calcul durée en jours (si fournie)
        let duree = null;
        if (dateDebut && dateFin) {
            const debut = new Date(dateDebut);
            const fin = new Date(dateFin);
            const diffTime = Math.abs(fin - debut);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            duree = diffDays;
        }

        const themeAvecDuree = {
            ...themePopule.toObject(),
            duree
        };

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: themeAvecDuree
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// Modifier
export const updateThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
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
        const {
            titreFr,
            titreEn,
            dateDebut,
            dateFin,
            responsable,
            formation,
            publicCible
        } = req.body;

        // Validate formation & responsable si fournis
        if (formation) {
            const formationId = formation._id || formation;
            if (!isValidObjectId(formationId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
        }
        if (responsable) {
            const respId = responsable._id || responsable;
            if (!isValidObjectId(respId)) {
                return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
            }
        }

        // ✅ CORRECTION 6: Validation ASYNCHRONE du publicCible si fourni
        let publicCibleFormatted = undefined;
        if (publicCible !== undefined) {
            const vc = await validateAndFormatPublicCible(publicCible, lang);
            if (!vc.ok) {
                return res.status(400).json({ success: false, message: vc.message });
            }
            publicCibleFormatted = vc.data;
        }

        // Recherche du thème existant
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        const oldResponsableId = theme.responsable ? theme.responsable.toString() : null;

        // Unicité titres (exclure l'ID courant)
        if (titreFr !== undefined) {
            const existsFr = await ThemeFormation.findOne({ titreFr, _id: { $ne: id } });
            if (existsFr) {
                return res.status(409).json({ success: false, message: t('theme_existante_fr', lang) });
            }
        }
        if (titreEn !== undefined) {
            const existsEn = await ThemeFormation.findOne({ titreEn, _id: { $ne: id } });
            if (existsEn) {
                return res.status(409).json({ success: false, message: t('theme_existante_en', lang) });
            }
        }

        // Mise à jour des champs si fournis
        if (titreFr !== undefined) theme.titreFr = titreFr;
        if (titreEn !== undefined) theme.titreEn = titreEn;
        if (dateDebut !== undefined) theme.dateDebut = dateDebut;
        if (dateFin !== undefined) theme.dateFin = dateFin;
        if (responsable !== undefined) theme.responsable = responsable?._id || responsable || undefined;
        if (formation !== undefined) theme.formation = formation?._id || formation || undefined;
        if (publicCibleFormatted !== undefined) theme.publicCible = publicCibleFormatted;

        // Sauvegarde
        await theme.save();

        // Gestion des rôles responsable (ajout + retrait si nécessaire)
        const newResponsableId = responsable?._id || responsable;
        if (newResponsableId) {
            await addRoleToUser(newResponsableId, 'RESPONSABLE-FORMATION');
        }
        if (oldResponsableId && oldResponsableId !== (newResponsableId ? newResponsableId.toString() : null)) {
            await removeRoleFromUserIfUnused(oldResponsableId, 'RESPONSABLE-FORMATION', ThemeFormation, 'responsable');
        }

        // Re-peupler pour réponse
        const themePopule = await ThemeFormation.findById(theme._id)
            .populate('responsable')
            .populate('formation')
            .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } });

        // Calcul durée
        let duree = null;
        if (themePopule.dateDebut && themePopule.dateFin) {
            const debut = new Date(themePopule.dateDebut);
            const fin = new Date(themePopule.dateFin);
            const diffTime = Math.abs(fin - debut);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            duree = diffDays;
        }

        const themeAvecDuree = {
            ...themePopule.toObject(),
            duree
        };

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: themeAvecDuree
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// Supprimer
export const deleteThemeFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
        return res.status(404).json({
            success: false,
            message: t('theme_non_trouve', lang),
        });
        }
        const oldResponsableId = theme.responsable?.toString();
        await ThemeFormation.findByIdAndDelete(id);
        if (oldResponsableId) {
            await removeRoleFromUserIfUnused(oldResponsableId, 'RESPONSABLE-FORMATION', ThemeFormation, "responsable");
        }
       
        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Ajouter un formateur
export const ajouterFormateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { formateurId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        if (!theme.formateurs.includes(formateurId)) {
            theme.formateurs.push(formateurId);
            await theme.save();
        }

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// Supprimer un formateur
export const supprimerFormateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id, formateurId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(formateurId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        theme.formateurs = theme.formateurs.filter(f => f.toString() !== formateurId);
        await theme.save();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
            data: theme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const invitation = async (req, res) => {
    const { themeId } = req.params;
    const { content, subject, participant } = req.body;
    const lang = req.headers['accept-language'] || 'fr';
    console.log(participant)
    const toParticipants = participant;
    
    if (!themeId || !content || !subject) {
        return res.status(400).json({ success: false, message: t('parametre_requis', lang) });
    }

    try {
        if (!mongoose.Types.ObjectId.isValid(themeId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        let userEmails = [];

        if (toParticipants) {
            // Récupérer tous les lieux de formation pour ce thème
            const lieuxFormation = await LieuFormation.find({ theme: themeId })
                .populate({
                    path: 'cohortes',
                    select: '_id nomFr nomEn'
                })
                .lean();

            if (!lieuxFormation || lieuxFormation.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: t('aucun_lieu_formation_trouve', lang)
                });
            }

            // --- LOGIQUE DE CONSOLIDATION DES PARTICIPANTS ---
            const participantsMap = new Map();
            
            // 1. RESOLUTION DES UTILISATEURS CIBLÉS PAR LES RESTRICTIONS DGI (LieuxFormation)
            const allUsers = await Utilisateur.find({ actif: true })
                .select('_id nom prenom email posteDeTravail structure service')
                .populate({
                    path: 'posteDeTravail',
                    select: 'famillesMetier nomFr nomEn'
                })
                .populate({
                    path: 'service',
                    select: 'nomFr nomEn'
                })
                .lean();

            // Filtrer les utilisateurs selon les restrictions de tous les Lieux du Thème
            const checkPromises = allUsers.map(user => checkUserTargeting(user, lieuxFormation));
            const targetedParticipantsResults = await Promise.all(checkPromises);

            // Ajouter les participants ciblés à la Map
            targetedParticipantsResults.filter(p => p !== null).forEach(participant => {
                const userId = participant.utilisateur._id.toString();
                const email = participant.utilisateur.email;
                
                if (email && email.trim() !== '') {
                    participantsMap.set(userId, {
                        ...participant,
                        email: email.trim()
                    });
                }
            });

            // 2. AJOUT DES UTILISATEURS DES COHORTES
            const toutesLesCohortes = lieuxFormation.flatMap(lieu =>
                lieu.cohortes.map(c => c._id)
            );

            if (toutesLesCohortes.length > 0) {
                const cohortesUtilisateurs = await CohorteUtilisateur.find({
                    cohorte: { $in: toutesLesCohortes }
                })
                .populate({
                    path: 'utilisateur',
                    select: '_id nom prenom email posteDeTravail service',
                    populate: [
                        {
                            path: 'posteDeTravail',
                            select: 'nomFr nomEn'
                        },
                        {
                            path: 'service',
                            select: 'nomFr nomEn'
                        }
                    ]
                })
                .lean();

                for (const cu of cohortesUtilisateurs) {
                    if (!cu.utilisateur) continue;
                    
                    const userId = cu.utilisateur._id.toString();
                    const email = cu.utilisateur.email;

                    // Ne pas écraser si l'utilisateur existe déjà
                    if (participantsMap.has(userId)) continue;

                    // Vérifier que l'email existe et est valide
                    if (!email || email.trim() === '') continue;

                    const lieuAssocie = lieuxFormation.find(lieu =>
                        lieu.cohortes.some(c => c._id.equals(cu.cohorte))
                    );

                    if (!lieuAssocie) continue;

                    participantsMap.set(userId, {
                        utilisateur: cu.utilisateur,
                        lieu: lieuAssocie.lieu,
                        dateDebut: lieuAssocie.dateDebut,
                        dateFin: lieuAssocie.dateFin,
                        email: email.trim(),
                        source: "cohorte"
                    });
                }
            }

            // Extraire tous les emails uniques
            userEmails = Array.from(participantsMap.values())
                .map(p => p.email)
                .filter(email => email && email.trim() !== '');

        } else {
            // Récupérer les formateurs
            const formateurs = await Formateur.find({ theme: themeId })
                .populate({ 
                    path: 'utilisateur', 
                    select: 'email',
                    match: { email: { $exists: true, $ne: null, $ne: '' } }
                })
                .lean();
           
            userEmails = formateurs
                .map(f => f.utilisateur?.email)
                .filter(email => email && email.trim() !== '');
        }

        // Validation des emails avec regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        userEmails = [...new Set(userEmails)].filter(email => emailRegex.test(email));

        if (userEmails.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: t('aucun_destinataire_trouve', lang) 
            });
        }

        // Envoyer les emails avec gestion des erreurs individuelles
        const emailPromises = userEmails.map(email => 
            sendMailFormation(email, subject, content)
                .catch(error => {
                    console.error(`Erreur envoi email à ${email}:`, error);
                    return { email, error: error.message };
                })
        );

        const results = await Promise.allSettled(emailPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
        const failureCount = results.length - successCount;

        res.status(200).json({
            success: true,
            message: t('emails_envoyes_succes', lang),
            count: successCount,
            total: userEmails.length,
            echecs: failureCount,
            destinataires: toParticipants ? 'participants' : 'formateurs'
        });

    } catch (err) {
        console.error('Erreur lors de l\'envoi des invitations:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};


export const getThemeFormationsForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
    const { formationId } = req.params;
    
    const { userId } = req.query;

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        
        let query = { formation: formationId };

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }

            const user = await Utilisateur.findById(userId).select('roles').lean();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: t('utilisateur_non_trouve', lang),
                });
            }

            const userRoles = (user.roles || []).map(r => r.toUpperCase());
            const isAdministrator = userRoles.includes('SUPER-ADMIN') || userRoles.includes('ADMIN');

            if (!isAdministrator) {
                query.responsable = userId;
            }
        }

        const themes = await ThemeFormation.find(query, `titreFr titreEn _id`)
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                themeFormations: themes,
                totalItems: themes.length,
                currentPage: 1,
                totalPages: 1,
                pageSize: themes.length
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

// Pour les menus déroulants - Thèmes (Public Cible)
export const getThemeFormationsForDropdownByPublicCible = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
    const { formationId } = req.params;
    const { userId } = req.query;

    try {
        if (!mongoose.Types.ObjectId.isValid(formationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }
        
        let query = { formation: formationId };

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }

            const user = await Utilisateur.findById(userId)
                .select('roles role posteDeTravail structure service familleMetier')
                .populate('posteDeTravail')
                .lean();
                
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: t('utilisateur_non_trouve', lang),
                });
            }

            // Vérifier si l'utilisateur est admin
            const allRoles = [user.role, ...(user.roles || [])].map(r => r?.toUpperCase()).filter(Boolean);
            const isAdministrator = allRoles.includes('SUPER-ADMIN') || allRoles.includes('ADMIN');

            // Si l'utilisateur n'est pas admin, filtrer par public cible
            if (!isAdministrator) {
                // Récupérer tous les thèmes de cette formation
                const allThemes = await ThemeFormation.find(query).lean();

                // Filtrer les thèmes où l'utilisateur fait partie du public cible
                const targetedThemeIds = [];
                
                for (const theme of allThemes) {
                    const isTargeted = await isUserInPublicCible(theme, user);
                    if (isTargeted) {
                        targetedThemeIds.push(theme._id);
                    }
                }

                if (targetedThemeIds.length === 0) {
                    return res.status(200).json({
                        success: true,
                        data: {
                            themeFormations: [],
                            totalItems: 0,
                            currentPage: 1,
                            totalPages: 0,
                            pageSize: 0
                        },
                    });
                }

                query._id = { $in: targetedThemeIds };
            }
        }

        const themes = await ThemeFormation.find(query, 'titreFr titreEn _id')
            .sort({ [sortField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                themeFormations: themes,
                totalItems: themes.length,
                currentPage: 1,
                totalPages: 1,
                pageSize: themes.length
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

// ✅ CORRECTION 7: Refonte complète de getFilteredThemes pour supporter la nouvelle structure
export const getFilteredThemes = async (req, res) => {
  const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
  const {
    formation,
    familleMetier,
    titre,
    debut,
    fin,
    userId,
    filterType = 'all', // 'all', 'responsable', 'publicCible'
    page = 1,
    limit = 10,
  } = req.query;

  const sortField = lang === 'en' ? 'titreEn' : 'titreFr';
  const filters = {};

  try {
    if (formation) {
      if (!mongoose.Types.ObjectId.isValid(formation)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }
      filters.formation = formation;
    }

    // Filtrer par familleMetier dans la structure publicCible
    if (familleMetier) {
      if (!mongoose.Types.ObjectId.isValid(familleMetier)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }
      filters['publicCible.familleMetier'] = familleMetier;
    }

    if (titre) {
      const field = lang === 'en' ? 'titreEn' : 'titreFr';
      filters[field] = { $regex: new RegExp(titre, 'i') };
    }

    if (debut && fin) {
      filters.dateDebut = { $gte: new Date(debut) };
      filters.dateFin = { $lte: new Date(fin) };
    }

    // Gestion du filtrage par utilisateur
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }

      const user = await Utilisateur.findById(userId)
        .select('roles role posteDeTravail structure service familleMetier')
        .populate('posteDeTravail')
        .lean();

      if (!user) {
        return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang),
        });
      }

      // Vérifier si l'utilisateur est admin
      const allRoles = [user.role, ...(user.roles || [])].map(r => r?.toUpperCase()).filter(Boolean);
      const isAdministrator = allRoles.includes('SUPER-ADMIN') || allRoles.includes('ADMIN');

      // Si l'utilisateur n'est pas admin, appliquer les filtres
      if (!isAdministrator || filterType) {
        if (filterType === 'responsable') {
        // Filtrer par responsabilité
            filters.responsable = userId;

        } else if (filterType === 'publicCible') {
            // Filtrer par public cible
            const allThemes = await ThemeFormation.find(filters).lean();
            const targetedThemeIds = [];

            for (const theme of allThemes) {
                const isTargeted = await isUserInPublicCible(theme, user);
                if (isTargeted) {
                    targetedThemeIds.push(theme._id);
                }
            }

            if (targetedThemeIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: {
                        themeFormations: [],
                        totalItems: 0,
                        currentPage: parseInt(page),
                        totalPages: 0,
                        pageSize: parseInt(limit),
                    },
                });
            }

            filters._id = { $in: targetedThemeIds };
        }
      }
    }

    const total = await ThemeFormation.countDocuments(filters);

    const themes = await ThemeFormation.find(filters)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ [sortField]: 1 })
        .populate({
            path: 'formation',
            populate: { path: 'programmeFormation' }
        })
        .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
        .populate({ path: 'responsable', options: { strictPopulate: false } })
        .lean();

    const themeIds = themes.map(t => t._id);

    const budgets = await BudgetFormation.find({ theme: { $in: themeIds } }).lean();
    const budgetIds = budgets.map(b => b._id);

    const depenses = await Depense.find({ budget: { $in: budgetIds } })
       .populate({
          path: 'taxes',
          select: 'taux',
          options:{strictPopulate:false}
      })
      .lean();

    const depensesByBudget = depenses.reduce((acc, dep) => {
      const bid = dep.budget.toString();
      if (!acc[bid]) acc[bid] = [];
      acc[bid].push(dep);
      return acc;
    }, {});

    const budgetsByTheme = budgets.reduce((acc, budget) => {
      const tid = budget.theme.toString();
      if (!acc[tid]) acc[tid] = [];
      acc[tid].push(budget);
      return acc;
    }, {});

    const enrichedThemes = themes.map(theme => {
      const themeId = theme._id.toString();
      const themeBudgets = budgetsByTheme[themeId] || [];

      let estimatif = 0;
      let reel = 0;

      themeBudgets.forEach(budget => {
        const depList = depensesByBudget[budget._id.toString()] || [];
        depList.forEach(dep => {
          const quantite = dep.quantite ?? 1;
          const tauxTotal = (dep.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

          const montantPrevuHT = dep.montantUnitairePrevu || 0;
          const montantReelHT = dep.montantUnitaireReel ?? (dep.montantUnitairePrevu || 0);

          const montantPrevuTTC = montantPrevuHT * quantite * (1 + tauxTotal / 100);
          const montantReelTTC = montantReelHT * quantite * (1 + tauxTotal / 100);

          estimatif += montantPrevuTTC;
          reel += montantReelTTC;
        });
      });

      const duree = (theme.dateDebut && theme.dateFin)
        ? Math.ceil((new Date(theme.dateFin) - new Date(theme.dateDebut)) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...theme,
        budgetEstimatif: Math.round(estimatif * 100) / 100,
        budgetReel: Math.round(reel * 100) / 100,
        duree,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        themeFormations: enrichedThemes,
        totalItems: total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        pageSize: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Erreur dans getFilteredThemes:', err);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};


// ✅ CORRECTION 8: Refonte de getThemesByFamilleMetier
export const getThemesByFamilleMetier = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { familleMetierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!familleMetierId || !mongoose.Types.ObjectId.isValid(familleMetierId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        // ✅ NOUVELLE LOGIQUE: Chercher dans publicCible.familleMetier au lieu de publicCible
        const query = { 'publicCible.familleMetier': familleMetierId };
        const total = await ThemeFormation.countDocuments(query);

        let themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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

// Liste paginée des thèmes par formation
export const getThemesByFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { formationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!formationId || !mongoose.Types.ObjectId.isValid(formationId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const query = { formation: formationId };
        const total = await ThemeFormation.countDocuments(query);

        const themes = await ThemeFormation.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('formation')
        .populate('responsable')
        .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
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


export const getThemeFormations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const total = await ThemeFormation.countDocuments();
        const themes = await ThemeFormation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate('responsable')
            .populate('formation')
            .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
            .populate({ path: 'formateurs', options: { strictPopulate: false } })
            .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
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


// Recherche par titre
export const searchThemeFormationByTitre = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { titre } = req.query;
    const field = lang === 'en' ? 'titreEn' : 'titreFr';

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    try {
        const themes = await ThemeFormation.find({
        [field]: { $regex: new RegExp(titre, 'i') },
        })
        .populate('responsable')
        .populate('formation')
        .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
        .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
        .populate({ path: 'formateurs', options: { strictPopulate: false } })
        .lean();

        const themesAvecCouts = await Promise.all(
            themes.map(async (theme) => {
                const coutTotalPrevu = await calculerCoutTotalPrevu(theme._id);
                return { ...theme, coutTotalPrevu };
            })
        );

        return res.status(200).json({
            success: true,
            data: themesAvecCouts,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

// ✅ NOUVELLE FONCTION: Obtenir tous les utilisateurs ciblés par un thème
export const getTargetedUsers = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;
    const {
        familleMetier,
        poste,
        structure,
        service,
        nom,
        prenom,
        search, // Recherche combinée nom + prénom
        page = 1,
        limit = 50
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    // Validation des filtres ObjectId
    if (familleMetier && !mongoose.Types.ObjectId.isValid(familleMetier)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }
    if (poste && !mongoose.Types.ObjectId.isValid(poste)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }
    if (structure && !mongoose.Types.ObjectId.isValid(structure)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }
    if (service && !mongoose.Types.ObjectId.isValid(service)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const theme = await ThemeFormation.findById(themeId)
            .populate('publicCible.familleMetier')
            .populate('publicCible.postes.poste')
            .populate('publicCible.postes.structures.structure')
            .populate('publicCible.postes.structures.services.service')
            .lean();

        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        let userIds = new Set();

        // Parcourir le public cible pour récupérer tous les utilisateurs ciblés
        for (const familleCible of theme.publicCible) {
            // Cas 1: Toute la famille (pas de restrictions)
            if (!familleCible.postes || familleCible.postes.length === 0) {
                const postes = await PosteDeTravail.find({ 
                    familleMetier: familleCible.familleMetier._id 
                }).select('_id');
                
                const posteIds = postes.map(p => p._id);
                
                const users = await Utilisateur.find({
                    posteDeTravail: { $in: posteIds }
                }).select('_id');
                
                users.forEach(u => userIds.add(u._id.toString()));
            } 
            // Cas 2: Restrictions par postes
            else {
                for (const posteRestriction of familleCible.postes) {
                    // Cas 2a: Toutes les structures du poste
                    if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                        const users = await Utilisateur.find({
                            posteDeTravail: posteRestriction.poste._id
                        }).select('_id');
                        
                        users.forEach(u => userIds.add(u._id.toString()));
                    }
                    // Cas 2b: Restrictions par structures
                    else {
                        for (const structureRestriction of posteRestriction.structures) {
                            // Cas 2b-i: Tous les services de la structure
                            if (!structureRestriction.services || structureRestriction.services.length === 0) {
                                const users = await Utilisateur.find({
                                    posteDeTravail: posteRestriction.poste._id,
                                    structure: structureRestriction.structure._id
                                }).select('_id');
                                
                                users.forEach(u => userIds.add(u._id.toString()));
                            }
                            // Cas 2b-ii: Services spécifiques
                            else {
                                const serviceIds = structureRestriction.services.map(s => s.service._id);
                                const users = await Utilisateur.find({
                                    posteDeTravail: posteRestriction.poste._id,
                                    service: { $in: serviceIds }
                                }).select('_id');
                                
                                users.forEach(u => userIds.add(u._id.toString()));
                            }
                        }
                    }
                }
            }
        }

        // Conversion en tableau
        const userIdsArray = Array.from(userIds);

        // Construction de la requête avec filtres
        let filterQuery = { _id: { $in: userIdsArray } };

        // Filtrer par famille de métier
        if (familleMetier) {
            const postesInFamille = await PosteDeTravail.find({
                familleMetier: familleMetier
            }).select('_id').lean();
            
            const posteIdsInFamille = postesInFamille.map(p => p._id.toString());
            
            filterQuery.posteDeTravail = { $in: posteIdsInFamille };
        }

        // Filtrer par poste
        if (poste) {
            filterQuery.posteDeTravail = poste;
        }

        // Filtrer par structure
        if (structure) {
            filterQuery.structure = structure;
        }

        // Filtrer par service
        if (service) {
            filterQuery.service = service;
        }

        // Filtrer par nom et/ou prénom
        if (search) {
            // Recherche combinée sur nom et prénom
            filterQuery.$or = [
                { nom: { $regex: new RegExp(search, 'i') } },
                { prenom: { $regex: new RegExp(search, 'i') } }
            ];
        } else {
            // Recherche séparée
            if (nom) {
                filterQuery.nom = { $regex: new RegExp(nom, 'i') };
            }
            if (prenom) {
                filterQuery.prenom = { $regex: new RegExp(prenom, 'i') };
            }
        }

        // Compter le total après filtrage
        const total = await Utilisateur.countDocuments(filterQuery);

        // Récupération des utilisateurs avec pagination et population
        const users = await Utilisateur.find(filterQuery)
            .populate('posteDeTravail')
            .populate('structure')
            .populate('service')
            .populate('familleMetier')
            .populate('grade')
            .populate('categorieProfessionnelle')
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({ nom: 1, prenom: 1 }) // Tri alphabétique
            .lean();

        // Enrichir les données des utilisateurs
        const enrichedUsers = users.map(user => ({
            _id: user._id,
            matricule: user.matricule,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            genre: user.genre,
            telephone: user.telephone,
            photoDeProfil: user.photoDeProfil,
            posteDeTravail: user.posteDeTravail ? {
                _id: user.posteDeTravail._id,
                nomFr: user.posteDeTravail.nomFr,
                nomEn: user.posteDeTravail.nomEn,
            } : null,
            structure: user.structure ? {
                _id: user.structure._id,
                nomFr: user.structure.nomFr,
                nomEn: user.structure.nomEn,
            } : null,
            service: user.service ? {
                _id: user.service._id,
                nomFr: user.service.nomFr,
                nomEn: user.service.nomEn,
            } : null,
            familleMetier: user.familleMetier ? {
                _id: user.familleMetier._id,
                nomFr: user.familleMetier.nomFr,
                nomEn: user.familleMetier.nomEn,
            } : null,
            grade: user.grade ? {
                _id: user.grade._id,
                nomFr: user.grade.nomFr,
                nomEn: user.grade.nomEn,
            } : null,
            categorieProfessionnelle: user.categorieProfessionnelle ? {
                _id: user.categorieProfessionnelle._id,
                nomFr: user.categorieProfessionnelle.nomFr,
                nomEn: user.categorieProfessionnelle.nomEn,
            } : null,
        }));

        return res.status(200).json({
            success: true,
            data: {
                utilisateurs: enrichedUsers,
                totalItems: total,
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                pageSize: limitNum,
                
            },
        });

    } catch (err) {
        console.error('Erreur dans getTargetedUsers:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
};

// ✅ NOUVELLE FONCTION: Vérifier si un utilisateur est ciblé par un thème
export const checkUserIsTargeted = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId, userId } = req.params;

    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
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

        const user = await Utilisateur.findById(userId)
            .populate({
                path: 'posteDeTravail',
                populate: { path: 'famillesMetier' } // ← Important !
            })
            .populate('structure')
            .populate('service');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        let isTargeted = false;

        for (const familleCible of theme.publicCible) {
            // Vérifier si le poste de l'utilisateur appartient à cette famille
            if (user.posteDeTravail.familleMetier.toString() !== familleCible.familleMetier.toString()) {
                continue;
            }
            
            // Pas de restriction sur les postes → utilisateur ciblé
            if (!familleCible.postes || familleCible.postes.length === 0) {
                isTargeted = true;
                break;
            }
            
            // Vérifier les restrictions de postes
            for (const posteRestriction of familleCible.postes) {
                if (user.posteDeTravail._id.toString() !== posteRestriction.poste.toString()) {
                    continue;
                }
                
                // Pas de restriction sur les structures → utilisateur ciblé
                if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                    isTargeted = true;
                    break;
                }
                
                // Vérifier les restrictions de structures
                for (const structureRestriction of posteRestriction.structures) {
                    if (user.structure._id.toString() !== structureRestriction.structure.toString()) {
                        continue;
                    }
                    
                    // Pas de restriction sur les services → utilisateur ciblé
                    if (!structureRestriction.services || structureRestriction.services.length === 0) {
                        isTargeted = true;
                        break;
                    }
                    
                    // Vérifier les restrictions de services
                    const serviceIds = structureRestriction.services.map(s => s.service.toString());
                    if (serviceIds.includes(user.service._id.toString())) {
                        isTargeted = true;
                        break;
                    }
                }
                
                if (isTargeted) break;
            }
            
            if (isTargeted) break;
        }

        return res.status(200).json({
            success: true,
            data: {
                isTargeted,
                userId,
                themeId,
            },
        });

    } catch (err) {
        console.error('Erreur dans checkUserIsTargeted:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
}

export const getThemeById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        // Récupérer le thème avec toutes les populations nécessaires
        const theme = await ThemeFormation.findById(themeId)
            .populate({
                path: 'formation',
                populate: { 
                    path: 'programmeFormation axeStrategique familleMetier',
                    options: { strictPopulate: false }
                }
            })
            .populate({ 
                path: 'publicCible.familleMetier', 
                options: { strictPopulate: false } 
            })
            .populate({ 
                path: 'publicCible.postes.poste', 
                options: { strictPopulate: false } 
            })
            .populate({ 
                path: 'publicCible.postes.structures.structure', 
                options: { strictPopulate: false } 
            })
            .populate({ 
                path: 'publicCible.postes.structures.services.service', 
                options: { strictPopulate: false } 
            })
            .populate({ 
                path: 'responsable', 
                select: 'nom prenom email matricule photoDeProfil',
                options: { strictPopulate: false } 
            })
            .populate({ 
                path: 'formateurs.formateur', 
                select: 'nom prenom email matricule photoDeProfil',
                options: { strictPopulate: false } 
            })
            .lean();

        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        // // Récupérer les budgets associés au thème
        // const budgets = await BudgetFormation.find({ theme: themeId }).lean();
        // const budgetIds = budgets.map(b => b._id);

        // // Récupérer les dépenses associées aux budgets
        // const depenses = await Depense.find({ budget: { $in: budgetIds } })
        //     .populate({
        //         path: 'taxes',
        //         select: 'taux nomFr nomEn',
        //         options: { strictPopulate: false }
        //     })
        //     .lean();

        // Calculer les montants budgétaires
        // let budgetEstimatif = 0;
        // let budgetReel = 0;

        // depenses.forEach(dep => {
        //     const quantite = dep.quantite ?? 1;
        //     const tauxTotal = (dep.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);

        //     const montantPrevuHT = dep.montantUnitairePrevu || 0;
        //     const montantReelHT = dep.montantUnitaireReel ?? montantPrevuHT;

        //     const montantPrevuTTC = montantPrevuHT * quantite * (1 + tauxTotal / 100);
        //     const montantReelTTC = montantReelHT * quantite * (1 + tauxTotal / 100);

        //     budgetEstimatif += montantPrevuTTC;
        //     budgetReel += montantReelTTC;
        // });

        // Calculer la durée du thème
        // const duree = (theme.dateDebut && theme.dateFin)
        //     ? Math.ceil((new Date(theme.dateFin) - new Date(theme.dateDebut)) / (1000 * 60 * 60 * 24))
        //     : null;

        // // Compter le nombre d'utilisateurs dans le public cible
        // let totalPublicCible = 0;
        // if (theme.publicCible && theme.publicCible.length > 0) {
        //     const userIds = new Set();

        //     for (const familleCible of theme.publicCible) {
        //         // Cas 1: Toute la famille
        //         if (!familleCible.postes || familleCible.postes.length === 0) {
        //             const postes = await PosteDeTravail.find({ 
        //                 familleMetier: familleCible.familleMetier._id 
        //             }).select('_id');
                    
        //             const posteIds = postes.map(p => p._id);
        //             const users = await Utilisateur.find({
        //                 posteDeTravail: { $in: posteIds }
        //             }).select('_id');
                    
        //             users.forEach(u => userIds.add(u._id.toString()));
        //         } 
        //         // Cas 2: Restrictions par postes
        //         else {
        //             for (const posteRestriction of familleCible.postes) {
        //                 if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
        //                     const users = await Utilisateur.find({
        //                         posteDeTravail: posteRestriction.poste._id
        //                     }).select('_id');
        //                     users.forEach(u => userIds.add(u._id.toString()));
        //                 } else {
        //                     for (const structureRestriction of posteRestriction.structures) {
        //                         if (!structureRestriction.services || structureRestriction.services.length === 0) {
        //                             const users = await Utilisateur.find({
        //                                 posteDeTravail: posteRestriction.poste._id,
        //                                 structure: structureRestriction.structure._id
        //                             }).select('_id');
        //                             users.forEach(u => userIds.add(u._id.toString()));
        //                         } else {
        //                             const serviceIds = structureRestriction.services.map(s => s.service._id);
        //                             const users = await Utilisateur.find({
        //                                 posteDeTravail: posteRestriction.poste._id,
        //                                 service: { $in: serviceIds }
        //                             }).select('_id');
        //                             users.forEach(u => userIds.add(u._id.toString()));
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }

        //     totalPublicCible = userIds.size;
        // }

        // Récupérer le nombre de tâches
        // const totalTaches = await TacheThemeFormation.countDocuments({ theme: themeId });
        // const tachesExecutees = await TacheThemeFormation.countDocuments({ 
        //     theme: themeId, 
        //     estExecutee: true 
        // });

        // Construire la réponse enrichie
        // const enrichedTheme = {
        //     ...theme,
        //     budgetEstimatif: Math.round(budgetEstimatif * 100) / 100,
        //     budgetReel: Math.round(budgetReel * 100) / 100,
        //     duree,
        //     totalPublicCible,
        //     nombreBudgets: budgets.length,
        //     nombreDepenses: depenses.length,
        //     totalTaches,
        //     tachesExecutees,
        //     tauxCompletionTaches: totalTaches > 0 
        //         ? Math.round((tachesExecutees / totalTaches) * 100) 
        //         : 0,
        // };

        return res.status(200).json({
            success: true,
            data: theme,
        });

    } catch (err) {
        console.error('Erreur dans getThemeById:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
};

// Controller: getThemesEnCoursResponsable
export const getThemesEnCoursResponsable = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { userId } = req.params;

    // Validation de l'ID utilisateur
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const today = new Date();

        // Récupérer les thèmes en cours où l'utilisateur est responsable
        const themes = await ThemeFormation.find({
            responsable: userId,
            dateDebut: { $lte: today }, // Déjà commencé
            dateFin: { $gte: today }    // Pas encore terminé
        })
        .select('titreFr titreEn dateDebut dateFin')
        .sort({ dateDebut: -1 })
        .limit(10)
        .lean();

        if (themes.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    themes: [],
                    totalItems: 0
                }
            });
        }

        const themeIds = themes.map(t => t._id);

        // Récupérer le nombre total de tâches génériques actives
        const totalTachesGeneriques = await TacheGenerique.countDocuments({ actif: true });

        // Récupérer les tâches exécutées pour ces thèmes
        const tachesExecutees = await TacheThemeFormation.aggregate([
            {
                $match: {
                    theme: { $in: themeIds },
                    estExecutee: true
                }
            },
            {
                $group: {
                    _id: '$theme',
                    nombreTachesExecutees: { $sum: 1 }
                }
            }
        ]);

        // Créer un map pour accès rapide
        const tachesExecuteesParTheme = {};
        for (const item of tachesExecutees) {
            tachesExecuteesParTheme[item._id.toString()] = item.nombreTachesExecutees;
        }

        // Enrichir les thèmes avec la progression
        const enrichedThemes = themes.map(theme => {
            const tid = theme._id.toString();
            const tachesExecutees = tachesExecuteesParTheme[tid] || 0;
            const progression = totalTachesGeneriques > 0
                ? Math.round((tachesExecutees / totalTachesGeneriques) * 100)
                : 0;

            return {
                _id: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                dateDebut: theme.dateDebut,
                dateFin: theme.dateFin,
                progression
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                themes: enrichedThemes,
                totalItems: enrichedThemes.length
            }
        });

    } catch (err) {
        console.error('Erreur dans getThemesEnCoursResponsable:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Controller: getThemesEnCoursParticipant
export const getThemesEnCoursParticipant = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { userId } = req.params;

    // Validation de l'ID utilisateur
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const today = new Date();

        // Récupérer l'utilisateur avec ses informations
        const user = await Utilisateur.findById(userId)
            .select('posteDeTravail structure service familleMetier')
            .populate('posteDeTravail')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        // Récupérer tous les thèmes en cours
        const themesEnCours = await ThemeFormation.find({
            dateDebut: { $lte: today },
            dateFin: { $gte: today }
        })
        .select('titreFr titreEn dateDebut dateFin publicCible')
        .lean();

        // Filtrer les thèmes où l'utilisateur fait partie du public cible
        const themesParticipant = [];
        for (const theme of themesEnCours) {
            const isTargeted = await isUserInPublicCible(theme, user);
            if (isTargeted) {
                themesParticipant.push(theme);
            }
        }

        // Limiter à 10 résultats
        const themesLimited = themesParticipant.slice(0, 10);

        if (themesLimited.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    themes: [],
                    totalItems: 0
                }
            });
        }

        const themeIds = themesLimited.map(t => t._id);

        // Récupérer le nombre total de tâches génériques actives
        const totalTachesGeneriques = await TacheGenerique.countDocuments({ actif: true });

        // Récupérer les tâches exécutées pour ces thèmes
        const tachesExecutees = await TacheThemeFormation.aggregate([
            {
                $match: {
                    theme: { $in: themeIds },
                    estExecutee: true
                }
            },
            {
                $group: {
                    _id: '$theme',
                    nombreTachesExecutees: { $sum: 1 }
                }
            }
        ]);

        // Créer un map pour accès rapide
        const tachesExecuteesParTheme = {};
        for (const item of tachesExecutees) {
            tachesExecuteesParTheme[item._id.toString()] = item.nombreTachesExecutees;
        }

        // Enrichir les thèmes avec la progression
        const enrichedThemes = themesLimited.map(theme => {
            const tid = theme._id.toString();
            const tachesExecutees = tachesExecuteesParTheme[tid] || 0;
            const progression = totalTachesGeneriques > 0
                ? Math.round((tachesExecutees / totalTachesGeneriques) * 100)
                : 0;

            return {
                _id: theme._id,
                titreFr: theme.titreFr,
                titreEn: theme.titreEn,
                dateDebut: theme.dateDebut,
                dateFin: theme.dateFin,
                progression
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                themes: enrichedThemes,
                totalItems: enrichedThemes.length
            }
        });

    } catch (err) {
        console.error('Erreur dans getThemesEnCoursParticipant:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Controller: getFormationsUtilisateur
export const getFormationsUtilisateur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validation de l'ID utilisateur
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const today = new Date();

        // Récupérer l'utilisateur
        const user = await Utilisateur.findById(userId)
            .select('posteDeTravail structure service familleMetier')
            .populate('posteDeTravail')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang),
            });
        }

        // 1. Récupérer les thèmes où l'utilisateur est responsable (en cours ou à venir)
        const themesResponsable = await ThemeFormation.find({
            responsable: userId,
            dateFin: { $gte: today } // Pas encore terminé
        })
        .select('_id formation titreFr titreEn dateDebut dateFin')
        .populate('formation', 'titreFr titreEn')
        .lean();

        // 2. Récupérer tous les thèmes en cours ou à venir
        const themesEnCoursOuAVenir = await ThemeFormation.find({
            dateFin: { $gte: today }
        })
        .select('_id formation titreFr titreEn dateDebut dateFin publicCible')
        .populate('formation', 'titreFr titreEn')
        .lean();

        // 3. Filtrer les thèmes où l'utilisateur est participant
        const themesParticipant = [];
        for (const theme of themesEnCoursOuAVenir) {
            // Ne pas inclure les thèmes où l'utilisateur est déjà responsable
            const isResponsable = themesResponsable.some(t => t._id.toString() === theme._id.toString());
            if (!isResponsable) {
                const isTargeted = await isUserInPublicCible(theme, user);
                if (isTargeted) {
                    themesParticipant.push(theme);
                }
            }
        }

        // 4. Combiner et organiser par formation
        const formationMap = new Map();

        // Ajouter les thèmes responsable
        for (const theme of themesResponsable) {
            const formationId = theme.formation._id.toString();
            if (!formationMap.has(formationId)) {
                formationMap.set(formationId, {
                    _id: theme.formation._id,
                    titreFr: theme.formation.titreFr,
                    titreEn: theme.formation.titreEn,
                    themes: [],
                    role: 'responsable',
                    dateDebut: null,
                    dateFin: null
                });
            }
            formationMap.get(formationId).themes.push(theme);
        }

        // Ajouter les thèmes participant
        for (const theme of themesParticipant) {
            const formationId = theme.formation._id.toString();
            if (!formationMap.has(formationId)) {
                formationMap.set(formationId, {
                    _id: theme.formation._id,
                    titreFr: theme.formation.titreFr,
                    titreEn: theme.formation.titreEn,
                    themes: [],
                    role: 'participant',
                    dateDebut: null,
                    dateFin: null
                });
            }
            formationMap.get(formationId).themes.push(theme);
        }

        // 5. Convertir en tableau et calculer dates et progression
        const formationsArray = Array.from(formationMap.values());

        // Récupérer le nombre total de tâches génériques
        const totalTachesGeneriques = await TacheGenerique.countDocuments({ actif: true });

        // Récupérer tous les IDs de thèmes
        const allThemeIds = [];
        formationsArray.forEach(formation => {
            formation.themes.forEach(theme => allThemeIds.push(theme._id));
        });

        // Récupérer les tâches exécutées
        const tachesExecutees = await TacheThemeFormation.aggregate([
            {
                $match: {
                    theme: { $in: allThemeIds },
                    estExecutee: true
                }
            },
            {
                $group: {
                    _id: '$theme',
                    nombreTachesExecutees: { $sum: 1 }
                }
            }
        ]);

        const tachesExecuteesParTheme = {};
        for (const item of tachesExecutees) {
            tachesExecuteesParTheme[item._id.toString()] = item.nombreTachesExecutees;
        }

        // 6. Enrichir chaque formation
        const enrichedFormations = formationsArray.map(formation => {
            const themes = formation.themes;
            const nombreThemes = themes.length;

            // Calculer dateDebut (la plus ancienne) et dateFin (la plus récente)
            if (nombreThemes > 0) {
                const datesDebut = themes.map(t => new Date(t.dateDebut).getTime()).filter(d => !isNaN(d));
                const datesFin = themes.map(t => new Date(t.dateFin).getTime()).filter(d => !isNaN(d));

                formation.dateDebut = datesDebut.length > 0 ? new Date(Math.min(...datesDebut)) : null;
                formation.dateFin = datesFin.length > 0 ? new Date(Math.max(...datesFin)) : null;
            }

            // Calculer la progression
            const totalTachesAttendu = totalTachesGeneriques * nombreThemes;
            let totalTachesExecutees = 0;

            themes.forEach(theme => {
                const tid = theme._id.toString();
                totalTachesExecutees += (tachesExecuteesParTheme[tid] || 0);
            });

            const progression = totalTachesAttendu > 0
                ? Math.round((totalTachesExecutees / totalTachesAttendu) * 100)
                : 0;

            // Déterminer l'état
            let etat = t('etat_pas_commence', lang);
            if (formation.dateDebut) {
                if (today < new Date(formation.dateDebut)) {
                    etat = t('etat_pas_commence', lang);
                } else if (today > new Date(formation.dateFin)) {
                    etat = t('etat_termine', lang);
                } else {
                    etat = t('etat_en_cours', lang);
                }
            }

            return {
                _id: formation._id,
                titreFr: formation.titreFr,
                titreEn: formation.titreEn,
                dateDebut: formation.dateDebut,
                dateFin: formation.dateFin,
                progression,
                role: formation.role,
                etat
            };
        });

        // 7. Tri par date de début (plus récent d'abord)
        enrichedFormations.sort((a, b) => {
            if (!a.dateDebut) return 1;
            if (!b.dateDebut) return -1;
            return new Date(b.dateDebut) - new Date(a.dateDebut);
        });

        // 8. Pagination
        const total = enrichedFormations.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedFormations = enrichedFormations.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            data: {
                formations: paginatedFormations,
                pagination: {
                    totalItems: total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    pageSize: limit
                }
            }
        });

    } catch (err) {
        console.error('Erreur dans getFormationsUtilisateur:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Fonction utilitaire (à réutiliser ou importer)
