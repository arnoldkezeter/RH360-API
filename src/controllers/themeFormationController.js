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

    const toParticipants = participant ? participant.toLowerCase() === 'true' : true;

    if (!themeId || !content || !subject) {
        return res.status(400).json({ success: false, message: t('parametre_requis', lang) });
    }

    try {
        if (!mongoose.Types.ObjectId.isValid(themeId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        let userEmails = [];

        if (toParticipants) {
            const lieux = await LieuFormation.find({ theme: themeId })
                .populate({
                    path: 'participants',
                    select: 'email',
                    model: 'ParticipantFormation'
                })
                .select('cohortes participants')
                .lean();

            const cohorteIds = lieux.flatMap(lieu => lieu.cohortes?.map(id => id.toString()) || []);

            let cohortesEmails = [];
            if (cohorteIds.length > 0) {
                const cohortesUtilisateurs = await CohorteUtilisateur.find({ cohorte: { $in: cohorteIds } })
                    .populate({ path: 'utilisateur', select: 'email' })
                    .lean();

                cohortesEmails = cohortesUtilisateurs
                    .map(cu => cu.utilisateur?.email)
                    .filter(email => email);
            }

            const participantsDirectsEmails = lieux.flatMap(lieu => 
                lieu.participants?.map(p => p.email).filter(email => email) || []
            );

            userEmails = [...new Set([...cohortesEmails, ...participantsDirectsEmails])];

        } else {
            const formateurs = await Formateur.find({ theme: themeId })
                .populate({ path: 'utilisateur', select: 'email' })
                .lean();

            userEmails = formateurs
                .map(f => f.utilisateur?.email)
                .filter(email => email);
        }

        if (userEmails.length === 0) {
            return res.status(404).json({ success: false, message: t('aucun_destinataire_trouve', lang) });
        }

        await Promise.all(userEmails.map(email => sendMailFormation(email, subject, content)));

        res.status(200).json({
            success: true,
            message: t('emails_envoyes_succes', lang),
            count: userEmails.length,
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

// ✅ CORRECTION 7: Refonte complète de getFilteredThemes pour supporter la nouvelle structure
export const getFilteredThemes = async (req, res) => {
  const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
  const {
    formation,
    familleMetier,
    titre,
    debut,
    fin,
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

    // ✅ NOUVELLE LOGIQUE: Filtrer par familleMetier dans la structure publicCible
    if (familleMetier) {
      if (!mongoose.Types.ObjectId.isValid(familleMetier)) {
        return res.status(400).json({
          success: false,
          message: t('identifiant_invalide', lang),
        });
      }
      // Chercher les thèmes qui ont cette famille dans leur publicCible
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (!themeId || !mongoose.Types.ObjectId.isValid(themeId)) {
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
            .populate('publicCible.postes.structures.services.service');

        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        let userIds = new Set();

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

        // Conversion en tableau et pagination
        const userIdsArray = Array.from(userIds);
        const total = userIdsArray.length;
        const startIdx = (page - 1) * limit;
        const endIdx = startIdx + limit;
        const paginatedIds = userIdsArray.slice(startIdx, endIdx);

        // Récupération des utilisateurs complets
        const users = await Utilisateur.find({ _id: { $in: paginatedIds } })
            .populate('posteDeTravail')
            .populate('structure')
            .populate('service')
            .lean();

        return res.status(200).json({
            success: true,
            data: users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (err) {
        console.error('Erreur dans getTargetedUsers:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
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