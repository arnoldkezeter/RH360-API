import EvaluationAChaud from '../models/EvaluationAChaud.js';
import ThemeFormation from '../models/ThemeFormation.js'; // Import manquant
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { t } from '../utils/i18n.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import EvaluationAChaudReponse from '../models/EvaluationAChaudReponse.js';
import { LieuFormation } from '../models/LieuFormation.js';

// Créer un modèle d'évaluation à chaud
export const createEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    const {
        titreFr,
        titreEn,
        theme,
        descriptionFr,
        descriptionEn,
        rubriques, // Correction: suppression des crochets vides
        actif,
    } = req.body;

    try {
        if (theme && !mongoose.Types.ObjectId.isValid(theme._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme._id) : null;
        if (theme && !themeExists) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }

        const existsFr = await EvaluationAChaud.findOne({ titreFr });
        if (existsFr) {
            return res.status(400).json({
                success: false,
                message: t('evaluation_existe_fr', lang)
            });
        }

        const existsEn = await EvaluationAChaud.findOne({ titreEn });
        if (existsEn) {
            return res.status(400).json({
                success: false,
                message: t('evaluation_existe_en', lang)
            });
        }

        const evaluation = new EvaluationAChaud({
            titreFr,
            titreEn,
            theme:theme._id,
            descriptionFr,
            descriptionEn,
            rubriques,
            actif
        });
        await evaluation.save();

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: evaluation
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Modifier un modèle d'évaluation
export const updateEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;
    const {
        titreFr,
        titreEn,
        theme,
        descriptionFr,
        descriptionEn,
        rubriques, // Ajout manquant
        actif,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: t('champs_obligatoires', lang),
                errors: errors.array().map(err => err.msg),
            });
        }

        if (theme && !mongoose.Types.ObjectId.isValid(theme._id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang),
            });
        }

        const themeExists = theme ? await ThemeFormation.findById(theme._id) : null;
        if (theme && !themeExists) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang),
            });
        }
        
        const evaluation = await EvaluationAChaud.findById(id);
        if (!evaluation) {
            return res.status(404).json({ 
                success: false, 
                message: t('evaluation_non_trouvee', lang) 
            });
        }

        // Correction: utilisation de l'opérateur d'affectation
        evaluation.titreFr = titreFr;
        evaluation.titreEn = titreEn;
        evaluation.theme = theme._id;
        evaluation.descriptionFr = descriptionFr;
        evaluation.descriptionEn = descriptionEn;
        evaluation.rubriques = rubriques; // Ajout manquant
        evaluation.actif = actif;
        
        await evaluation.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: evaluation
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};


// Supprimer un modèle
export const deleteEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            success: false, 
            message: t('identifiant_invalide', lang) 
        });
    }

    try {
        const evaluation = await EvaluationAChaud.findByIdAndDelete(id);
        if (!evaluation) {
            return res.status(404).json({ 
                success: false, 
                message: t('evaluation_non_trouvee', lang) 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: t('supprimer_succes', lang) 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Liste paginée
export const listEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const total = await EvaluationAChaud.countDocuments();
        const data = await EvaluationAChaud.find()
            .populate('theme', 'nomFr nomEn') // Ajout du populate pour le thème
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.status(200).json({
            success: true,
            data,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Pour menus déroulants
export const dropdownEvaluationAChaud = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr'; // Correction: déclaration de lang
    
    try {
        const evaluations = await EvaluationAChaud.find({ actif: true })
            .select('titreFr titreEn')
            .sort({ titreFr: 1 });

        return res.status(200).json({ 
            success: true, 
            data: evaluations // Correction: formatage
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: t('erreur_serveur', lang), 
            error: err.message 
        });
    }
};

// Récupérer une évaluation à chaud complète par ID
export const getEvaluationAChaudById = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const evaluation = await EvaluationAChaud.findById(id)
            .populate('theme', 'nomFr nomEn') // Ajout du populate pour le thème
            .populate('rubriques.questions.echelles'); // Populate des échelles de réponse

        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: t('evaluation_non_trouvee', lang),
            });
        }

        return res.status(200).json({
            success: true,
            data: evaluation,
        });
    } catch (err) {
        return res.status(500).json({ // Correction: ajout de return
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const getFilteredEvaluation = async (req, res) => {
    const lang = req.headers['accept-language']?.toLowerCase() || 'fr';
    // const { themeId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();
    

    // if (!mongoose.Types.ObjectId.isValid(themeId)) {
    //     return res.status(400).json({
    //         success: false,
    //         message: t('identifiant_invalide', lang),
    //     });
    // }

    try {
        let filter = {}
        // Construction du filtre de base
        // filter = { 
        //     theme: themeId, 
        // };

        // Ajout du filtre de recherche si search existe
        if (search) {
            filter.$or = [
                { titreFr: { $regex: search, $options: 'i' } },
                { titreEn: { $regex: search, $options: 'i' } },
            ];
        }

        // Compter le total d'évaluations avec les filtres appliqués
        const total = await EvaluationAChaud.countDocuments(filter);

        // Récupérer les évaluations avec pagination et filtres
        const evaluations = await EvaluationAChaud.find(filter)
            .populate('theme', 'titreFr titreEn')
            .populate('rubriques.questions.echelles')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        
        return res.status(200).json({
            success: true,
            data:{ 
                evaluationChauds:evaluations,
                totalItems:total,
                currentPage:page,
                totalPage: Math.ceil(total / limit),
                pageSize:limit
            } 
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



export const getEvaluationsChaudByUtilisateur = async (req, res) => {
  try {
    const utilisateurId = req.params.utilisateurId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();

    // Étape 1 : Récupération des cohortes
    const cohortesIds = await CohorteUtilisateur
      .find({ utilisateur: utilisateurId })
      .distinct('cohorte');

    // Étape 2 : Récupération des themes via LieuFormation
    const themeIds = await LieuFormation
      .find({ cohortes: { $in: cohortesIds } })
      .distinct('theme');

    // Étape 3 : Filtrage + pagination des évaluations
    const filter = {
      theme: { $in: themeIds },
      actif: true,
      ...(search && {
        $or: [
          { titreFr: { $regex: search, $options: 'i' } },
          { titreEn: { $regex: search, $options: 'i' } }
        ]
      })
    };

    const [total, evaluations] = await Promise.all([
      EvaluationAChaud.countDocuments(filter),
      EvaluationAChaud.find(filter)
        .populate('theme', 'titreFr titreEn')
        .populate({path:'rubriques.questions.echelles', options:{strictPopulate:false}})
        .populate({path:'rubriques.questions.echelles.typeEchelle', select:"nomFr nomEn", options:{strictPopulate:false}})
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const evaluationIds = evaluations.map(e => e._id);

    // Étape 4 : Récupération groupée des réponses avec populations
    const reponses = await EvaluationAChaudReponse.find({
      utilisateur: utilisateurId,
      modele: { $in: evaluationIds }
    })
      
      .lean();

    const reponsesByModele = Object.fromEntries(
      reponses.map(rep => [rep.modele.toString(), rep])
    );

    // Étape 5 : Calcul des progressions
    for (let evaluation of evaluations) {
      const reponse = reponsesByModele[evaluation._id.toString()];
      
      let totalQuestions = 0;
      for (const rubrique of evaluation.rubriques || []) {
        for (const question of rubrique.questions || []) {
          totalQuestions += question.sousQuestions?.length || 1;
        }
      }

      let totalRepondu = 0;
      if (reponse) {
        for (const rubriqueRep of reponse.rubriques || []) {
          for (const questionRep of rubriqueRep.questions || []) {
            if (questionRep.sousReponses?.length > 0) {
              totalRepondu += questionRep.sousReponses.length;
            } else if (questionRep.reponseEchelleId) {
              totalRepondu += 1;
            }
          }
        }
      }

      evaluation.progression = totalQuestions > 0
        ? Math.round((totalRepondu / totalQuestions) * 100)
        : 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        evaluationChauds: evaluations,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit
      }
    });

  } catch (error) {
    console.error('Erreur getEvaluationsChaudByUtilisateur:', error);
    return res.status(500).json({ // Correction: ajout de return
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};



