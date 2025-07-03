import ProgrammeFormation from '../models/ProgrammeFormation.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Utilisateur from '../models/Utilisateur.js';
import Formation from '../models/Formation.js';
import mongoose from 'mongoose';
import { calculerCoutsBudget } from '../services/budgetFormationService.js';
import Depense from '../models/Depense.js';

// Ajouter un programme de formation
export const createProgrammeFormation = async (req, res) => {
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
        const { titreFr, titreEn, annee, creePar,} = req.body;

        // Vérifier unicité de l'annee
        const exists = await ProgrammeFormation.exists({ annee });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('programme_formation_existante', lang),
            });
        }


        // Vérification ObjectId pour creePar
        if (creePar && creePar._id) {
            if (!mongoose.Types.ObjectId.isValid(creePar._id)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                    error: 'Invalid creePar ObjectId',
                });
            }
        }

        
        // Création
        const programme = await ProgrammeFormation.create({
            titreFr,
            titreEn,
            annee,
            creePar: creePar._id,
        });

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: programme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Modifier un programme de formation
export const updateProgrammeFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { titreFr, titreEn, annee, creePar } = req.body;

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
        const programme = await ProgrammeFormation.findById(id);
        if (!programme) {
            return res.status(404).json({
                success: false,
                message: t('programme_formation_non_trouve', lang),
            });
        }

        // Vérifier unicité annee
        if ( annee) {
            const exists = await ProgrammeFormation.findOne({
                annee,
                _id: { $ne: id },
            });
            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: t('programme_formation_existante', lang),
                });
            }
        }

        // Validation creePar
        if (creePar && creePar._id) {
            if (!mongoose.Types.ObjectId.isValid(creePar._id)) {
                return res.status(400).json({
                    success: false,
                    message: t('identifiant_invalide', lang),
                });
            }
            
            programme.creePar = creePar._id;
        } 

        if (titreFr !== undefined) programme.titreFr = titreFr;
        if (titreEn !== undefined) programme.titreEn = titreEn;
        if (annee !== undefined) programme.annee = annee;

        await programme.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: programme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Supprimer un programme de formation
export const deleteProgrammeFormation = async (req, res) => {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const programme = await ProgrammeFormation.findById(id);
        if (!programme) {
            return res.status(404).json({
                success: false,
                message: t('programme_formation_non_trouve', lang),
            });
        }

        await ProgrammeFormation.deleteOne({ _id: id });

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


// Liste paginée des programmes de formation
export const getProgrammesFormation = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.headers['accept-language'] || 'fr';

    const sortField = 'annee';

    try {
        const total = await ProgrammeFormation.countDocuments();

        const programmes = await ProgrammeFormation.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ [sortField]: -1 })
            .populate({
                path: 'creePar',
                select: 'nom prenom email',
                options: { strictPopulate: false },
            })
            .lean();

        return res.status(200).json({
            success: true,
            data: programmes,
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


// Récupérer un programme de formation par ID
export const getProgrammeFormationById = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const programme = await ProgrammeFormation.findById(id)
            .populate({
                path: 'creePar',
                select: 'nom prenom email',
                options: { strictPopulate: false },
            })
            .lean();

        if (!programme) {
            return res.status(404).json({
                success: false,
                message: t('programme_formation_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: programme,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_interne', lang),
            error: err.message,
        });
    }
};


// Recherche par titre (Fr ou En selon langue)
export const searchProgrammeFormationByTitle = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { titre } = req.query;

    if (!titre) {
        return res.status(400).json({
            success: false,
            message: t('titre_requis', lang),
        });
    }

    const queryField = 'annee';

    try {
        const programmes = await ProgrammeFormation.find({
            [queryField]: { $regex: new RegExp(titre, 'i') },
        })
            .populate({
                path: 'creePar',
                select: 'nom prenom',
                options: { strictPopulate: false },
            })
            .sort({ [queryField]: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: programmes,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


// Charger programmes pour dropdown
export const getProgrammesForDropdown = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const programmes = await ProgrammeFormation.find({}, '_id annee titreFr titreEn')
            .sort({ 'annee': -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                programmeFormations:programmes,
                totalItems: programmes.length,
                currentPage: 1,
                totalPages: 1,
                pageSize: programmes.length,
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


//Liste des programmes de formation avec stats
export const getStatistiquesProgrammesFormation = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const totalProgrammes = await ProgrammeFormation.countDocuments();

        // Récupérer les programmes avec pagination
        const programmes = await ProgrammeFormation.find()
            .select('annee titreFr titreEn')
            .sort({ annee: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Si aucun programme n'existe, retourner une réponse vide
        if (!programmes || programmes.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    programmeFormations: [],
                    totalItems: 0,
                    currentPage: page,
                    totalPages: 0,
                    pageSize: limit
                }
            });
        }

        const programmeIds = programmes.map((p) => p._id);
        // Rechercher toutes les formations associées aux programmes retournés
        const formations = await Formation.find({ programmeFormation: { $in: programmeIds } })
            .select('programmeFormation nbTachesTotal nbTachesExecutees')
            .lean();
        // Organiser les formations par programmeId
        const formationsParProgramme = {};
        for (const formation of formations) {
            const pid = formation.programmeFormation.toString();
            if (!formationsParProgramme[pid]) {
                formationsParProgramme[pid] = [];
            }
            formationsParProgramme[pid].push(formation);
        }

        // Construire les résultats
        const results = programmes.map((programme) => {
            const pid = programme._id.toString();
            const formations = formationsParProgramme[pid] || [];

            const nombreFormationPrevue = formations.length;
            let nombreFormationExecutee = 0;

            for (const f of formations) {
                const total = f.nbTachesTotal || 0;
                const done = f.nbTachesExecutees || 0;
                if (total > 0 && total === done) {
                    nombreFormationExecutee += 1;
                }
            }

            let etat = t('etat_non_entame', lang);
            if (nombreFormationPrevue > 0 && nombreFormationExecutee === nombreFormationPrevue) {
                etat = t('etat_termine', lang);
            } else if (nombreFormationExecutee > 0) {
                etat = t('etat_en_cours', lang);
            }

            return {
                _id: programme._id,
                annee: programme.annee,
                titreFr:programme.titreFr,
                titreEn:programme.titreEn,
                nombreFormationPrevue,
                nombreFormationExecutee,
                etat
            };
        });
        
        return res.status(200).json({
            success: true,
            data: {
                programmeFormations: results,
                totalItems: totalProgrammes,
                currentPage: page,
                totalPages: Math.ceil(totalProgrammes / limit),
                pageSize: limit
            }
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};



//Statistiques
//Nombre total de programme de formation actif
export const getNombreProgrammesActifs = async (req, res) => {
    try {
        const programmes = await ProgrammeFormation.find().select('annee').lean();
        const programmeIds = programmes.map(p => p._id);

        const formations = await Formation.find({ programmeFormation: { $in: programmeIds } })
            .select('programmeFormation nbTachesTotal nbTachesExecutees')
            .lean();

        const programmesMap = {};

        for (const formation of formations) {
            const pid = formation.programmeFormation.toString();
            if (!programmesMap[pid]) {
                programmesMap[pid] = { total: 0, executees: 0 };
            }

            programmesMap[pid].total += 1;

            if (
                (formation.nbTachesTotal || 0) > 0 &&
                (formation.nbTachesTotal === formation.nbTachesExecutees)
            ) {
                programmesMap[pid].executees += 1;
            }
        }

        let nombreActifs = 0;
        for (const [pid, { total, executees }] of Object.entries(programmesMap)) {
            if (total === 0 || executees < total) {
                nombreActifs += 1;
            }
        }

        return res.status(200).json({ success: true, data: nombreActifs });
    } catch (err) {
        console.log(err)
        return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
    }
};


//Pourcentage d'exécution d'un programme de formation
export const getPourcentageExecutionProgrammes = async (req, res) => {
    try {
        const formations = await Formation.find().select('nbTachesTotal nbTachesExecutees').lean();

        let totalFormations = formations.length;
        let totalExecutees = 0;

        for (const f of formations) {
            const total = f.nbTachesTotal || 0;
            const done = f.nbTachesExecutees || 0;
            if (total > 0 && total === done) {
                totalExecutees += 1;
            }
        }

        const pourcentage = totalFormations === 0
            ? 0
            : Math.round((totalExecutees / totalFormations) * 100);

        return res.status(200).json({ success: true, data:pourcentage });
    } catch (err) {
        console.log(err)
        return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
    }
};


//Répartition des formation par programme de formation
export const getRepartitionFormationsParProgramme = async (req, res) => {
    try {
        const programmes = await ProgrammeFormation.find().select('annee').lean();
        const programmeIds = programmes.map(p => p._id);

        const formations = await Formation.find({ programmeFormation: { $in: programmeIds } })
            .select('programmeFormation nbTachesTotal nbTachesExecutees')
            .lean();

        const regroupement = {};

        for (const formation of formations) {
            const pid = formation.programmeFormation.toString();
            if (!regroupement[pid]) {
                regroupement[pid] = { nombrePrevu: 0, nombreExecute: 0 };
            }

            regroupement[pid].nombrePrevu += 1;

            const total = formation.nbTachesTotal || 0;
            const done = formation.nbTachesExecutees || 0;

            if (total > 0 && total === done) {
                regroupement[pid].nombreExecute += 1;
            }
        }

        const resultat = programmes.map(p => {
            const pid = p._id.toString();
            const prevu = regroupement[pid]?.nombrePrevu || 0;
            const execute = regroupement[pid]?.nombreExecute || 0;
            return {
                programmeId: pid,
                annee: p.annee,
                nombreFormationPrevue: prevu,
                nombreFormationExecutee: execute
            };
        });

        return res.status(200).json({ success: true, data: resultat });
    } catch (err) {
        console.log(err)
        return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
    }
};

//Taux d'execution d'une foramtion par axe stratégique
export const getTauxExecutionParAxeStrategique = async (req, res) => {
    const { programmeId } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
        return res.status(400).json({
        success: false,
        message: t('identifiant_invalide', lang),
        });
    }

    try {
        // Récupérer les formations du programme avec axeStrategique, nbTachesTotal, nbTachesExecutees
        const formations = await Formation.find({ programmeFormation: programmeId })
        .select('axeStrategique nbTachesTotal nbTachesExecutees')
        .lean();

        if (formations.length === 0) {
        return res.status(404).json({
            success: false,
            message: t('aucune_formation_trouvee', lang),
        });
        }

        // Regrouper par axeStrategique
        const axesMap = {};
        let totalFormations = 0;
        let totalExecutees = 0;

        for (const f of formations) {
        const axe = f.axeStrategique ? f.axeStrategique.toString() : 'non_defini';

        if (!axesMap[axe]) {
            axesMap[axe] = { nombreFormations: 0, nombreExecutees: 0 };
        }

        axesMap[axe].nombreFormations += 1;
        totalFormations += 1;

        const totalTaches = f.nbTachesTotal || 0;
        const doneTaches = f.nbTachesExecutees || 0;

        if (totalTaches > 0 && totalTaches === doneTaches) {
            axesMap[axe].nombreExecutees += 1;
            totalExecutees += 1;
        }
        }

        // Calcul des taux d'exécution par axe
        const tauxParAxe = Object.entries(axesMap).map(([axe, data]) => {
        const taux =
            data.nombreFormations === 0
            ? 0
            : Math.round((data.nombreExecutees / data.nombreFormations) * 100);
        return { axeStrategique: axe, tauxExecution: taux };
        });

        // Taux global du programme
        const tauxGlobal =
        totalFormations === 0 ? 0 : Math.round((totalExecutees / totalFormations) * 100);

        return res.status(200).json({
        success: true,
        data: {
            tauxParAxe,
            tauxGlobal,
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

// Coûts par formation pour un programme
export const getCoutsParFormationPourProgramme = async (req, res) => {
  const { programmeId } = req.params;
  const lang = req.headers['accept-language']?.toLowerCase() || 'fr';

  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    return res.status(400).json({
      success: false,
      message: t('identifiant_invalide', lang),
    });
  }

  try {
    // 1. Formations du programme
    const formations = await Formation.find({ programmeFormation: programmeId })
      .select('_id titreFr titreEn')
      .lean();

    if (formations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // 2. Thèmes associés
    const formationIds = formations.map(f => f._id);
    const themes = await ThemeFormation.find({ formation: { $in: formationIds } })
      .select('_id formation')
      .lean();

    if (themes.length === 0) {
      return res.status(200).json({
        success: true,
        data: formations.map(f => ({
          formationId: f._id,
          titreFr: f.titreFr,
          titreEn: f.titreEn,
          coutPrevu: 0,
          coutReel: 0,
        })),
      });
    }

    // 3. Budgets des thèmes
    const themeIds = themes.map(t => t._id);
    const budgets = await BudgetFormation.find({ theme: { $in: themeIds } })
      .select('_id theme')
      .lean();
    const budgetIds = budgets.map(b => b._id);

    // 4. Dépenses avec taxes multiples
    const depenses = await Depense.find({ budget: { $in: budgetIds } })
      .populate('taxes', 'taux')
      .lean();

    const costsByTheme = {};

    depenses.forEach(dep => {
      const budget = budgets.find(b => b._id.toString() === dep.budget.toString());
      if (!budget) return;

      const themeId = budget.theme.toString();
      const quantite = dep.quantite ?? 1;
      const tauxTotal = (dep.taxes || []).reduce((sum, taxe) => sum + (taxe.taux || 0), 0);

      const prevuHT = dep.montantUnitairePrevu ?? 0;
      const reelHT = dep.montantUnitaireReel ?? dep.montantUnitairePrevu ?? 0;

      const prevuTTC = prevuHT * quantite * (1 + tauxTotal / 100);
      const reelTTC = reelHT * quantite * (1 + tauxTotal / 100);

      if (!costsByTheme[themeId]) {
        costsByTheme[themeId] = { coutPrevu: 0, coutReel: 0 };
      }

      costsByTheme[themeId].coutPrevu += prevuTTC;
      costsByTheme[themeId].coutReel += reelTTC;
    });

    // 5. Agrégation par formation
    const costsByFormation = {};
    themes.forEach(theme => {
      const formationId = theme.formation.toString();
      const themeId = theme._id.toString();
      const themeCosts = costsByTheme[themeId] || { coutPrevu: 0, coutReel: 0 };

      if (!costsByFormation[formationId]) {
        costsByFormation[formationId] = { coutPrevu: 0, coutReel: 0 };
      }

      costsByFormation[formationId].coutPrevu += themeCosts.coutPrevu;
      costsByFormation[formationId].coutReel += themeCosts.coutReel;
    });

    // 6. Format final
    const result = formations.map(f => {
      const c = costsByFormation[f._id.toString()] || { coutPrevu: 0, coutReel: 0 };
      return {
        formationId: f._id,
        titreFr: f.titreFr,
        titreEn: f.titreEn,
        coutPrevu: +c.coutPrevu.toFixed(2),
        coutReel: +c.coutReel.toFixed(2),
      };
    });

    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message,
    });
  }
};



