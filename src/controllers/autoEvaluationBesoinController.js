//controllers/autoEvaluationBesoinController
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import BesoinFormationPredefini from '../models/BesoinFormationPredefini.js';
import AutoEvaluationBesoin from '../models/AutoEvaluationBesoin.js';
import BesoinAjouteUtilisateur from '../models/BesoinAjoutUtilisateur.js';
import Utilisateur from '../models/Utilisateur.js';

export const createAutoEvaluation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { utilisateur, besoin, niveau, insuffisancesFr, insuffisancesEn, formulationBesoinsFr, formulationBesoinsEn } = req.body;
    
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    if (niveau < 1 || niveau > 4) {
      return res.status(400).json({ 
        success:false,
        message: t('error_niveau', lang) 
      });
    }

    // Vérifier que le besoin existe
    const besoinExists = await BesoinFormationPredefini.findById(besoin);
    if (!besoinExists) {
      return res.status(404).json({ 
        success:false,
        message: t('besoin_non_trouve', lang) 
      });
    }

    // Empêcher les doublons
    const alreadyExists = await AutoEvaluationBesoin.findOne({ utilisateur, besoin });
    if (alreadyExists) {
      return res.status(409).json({ 
        success:false,
        message: t('evaluation_soumis', lang) }
      );
    }

    let autoEval = new AutoEvaluationBesoin({
      utilisateur,
      besoin,
      niveau,
      insuffisancesFr,
      insuffisancesEn,
      formulationBesoinsFr,
      formulationBesoinsEn
    });

    await autoEval.save();
    autoEval = await AutoEvaluationBesoin.findById(autoEval._id)
    .populate({path:'utilisateur', select: 'nom prenom email'})
    .populate('besoin')
    .lean();
    return res.status(201).json({
      success:true,
      message:t('ajouter_succes', lang),
      data:autoEval
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// Modifier une auto-évaluation
export const updateAutoEvaluation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { id } = req.params;
    const { niveau, insuffisancesFr, insuffisancesEn, besoinsFormationFr, besoinsFormationEn } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }
    let evaluation = await AutoEvaluationBesoin.findByIdAndUpdate(
      id,
      {
        niveau,
        insuffisancesFr,
        insuffisancesEn,
        besoinsFormationFr,
        besoinsFormationEn,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!evaluation) return res.status(404).json({success:false, message: t('auto_evaluation_non_trouvee', lang) });
    evaluation = await AutoEvaluationBesoin.findById(evaluation._id)
    .populate({path:'utilisateur', select: 'nom prenom email'})
    .populate('besoin')
    .lean();
    return res.status(200).json({
      success:true,
      message:t('modifier_succes',lang),
      data:evaluation
    });
  } catch (error) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};


// Supprimer une auto-évaluation
export const deleteAutoEvaluation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { id } = req.params;

    const evaluation = await AutoEvaluationBesoin.findByIdAndDelete(id);

    if (!evaluation) return res.status(404).json({success:false, message: t('auto_evaluation_non_trouvee', lang) });

    return res.status(200).json({
      success:true,
      message: t('supprimer_succes', lang) 
    });
  } catch (error) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};


export const getEvaluationsByUser = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { utilisateurId } = req.params;

    const evaluations = await AutoEvaluationBesoin.find({utilisateur: utilisateurId }).populate('besoin');
    return res.status(200).json({
      success:true,
      evaluations
    });
  } catch (err) {
     return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const getAllEvaluations = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const evaluations = await AutoEvaluationBesoin.find().populate('besoin utilisateur');
    return res.json({
      success:true,
      data:evaluations
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const getBesoinsPredefinisAvecAutoEvaluation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const {userId, page = 1, limit = 10, search = '' } = req.query;

    // Validation des paramètres
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
    }

    const skip = (page - 1) * limit;

    const poste = await Utilisateur.findById(userId).select('posteDeTravail').lean();

    if (!poste) {
      return res.status(404).json({
        success: false,
        message: t('utilisateur_non_trouve', lang)
      });
    }

    const posteId = poste?.posteDeTravail;

    // Si pas de poste assigné, retourner un résultat vide
    if (!posteId) {
      return res.status(200).json({
        success: true,
        data: {
          totalItems: 0,
          currentPage: Number(page),
          totalPages: 0,
          pageSize: Number(limit),
          autoEvaluationBesoins: []
        },
      });
    }

    // Filtrage des besoins associés au poste, avec option de recherche
    const searchRegex = search && search.trim() ? new RegExp(search.trim(), 'i') : null;

    const query = {
      postesDeTravail: posteId,
      actif: true,
      ...(searchRegex && {
        $or: [
          { titreFr: { $regex: searchRegex } },
          { titreEn: { $regex: searchRegex } }
        ]
      }),
    };

    const total = await BesoinFormationPredefini.countDocuments(query);

    const besoins = await BesoinFormationPredefini.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const besoinIds = besoins.map((b) => b._id);

    // Récupérer les autoévaluations de l'utilisateur pour ces besoins
    const evaluations = await AutoEvaluationBesoin.find({
      utilisateur:userId,
      besoin: { $in: besoinIds },
    }).lean();

    const evalMap = {};
    evaluations.forEach((e) => {
      evalMap[e.besoin.toString()] = e;
    });

    const results = besoins.map((b) => {
      const ev = evalMap[b._id.toString()];
      return {
        _id: ev?._id || null,
        besoin: {
          _id: b._id,
          titreFr: b.titreFr,
          titreEn: b.titreEn,
          descriptionFr: b.descriptionFr,
          descriptionEn: b.descriptionEn,
          actif: b.actif,
        },
        niveau: ev?.niveau || 0,
        insuffisancesFr: ev?.insuffisancesFr || null,
        insuffisancesEn: ev?.insuffisancesEn || null,
        formulationBesoinsFr: ev?.formulationBesoinsFr || null,
        formulationBesoinsEn: ev?.formulationBesoinsEn || null,
        statut: ev?.statut || 'NON_EVALUE',
        commentaireAdminFr: ev?.commentaireAdminFr || null,
        commentaireAdminEn: ev?.commentaireAdminEn || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalItems: total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        pageSize: Number(limit),
        autoEvaluationBesoins: results
      },
    });
  } catch (err) {
    console.error("Erreur getBesoinsPredefinisAvecAutoEvaluation:", err);
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};


export const getGroupedAutoEvaluations = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const grouped = await AutoEvaluationBesoin.aggregate([
      {
        $match: {
          niveau: { $lte: 2 } // niveau faible uniquement
        }
      },
      {
        $lookup: {
          from: 'besoinformationpredefinis',
          localField: 'besoin',
          foreignField: '_id',
          as: 'besoin'
        }
      },
      { $unwind: '$besoin' },
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'utilisateur',
          foreignField: '_id',
          as: 'utilisateur'
        }
      },
      { $unwind: '$utilisateur' },
      {
        $group: {
          _id: {
            besoinId: '$besoin._id',
            niveau: '$niveau',
            titreFr: '$besoin.titreFr',
            titreEn: '$besoin.titreEn'
          },
          count: { $sum: 1 },
          evaluations: {
            $push: {
              utilisateurNom: '$utilisateur.nom',
              utilisateurPrenom: '$utilisateur.prenom',
              utilisateurEmail: '$utilisateur.email',
              createdAt: '$createdAt',
              statut: '$statut',
              evaluationId: '$_id'
            }
          }
        }
      },
      {
        $sort: {
          '_id.niveau': 1,
          count: -1
        }
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          besoinId: '$_id.besoinId',
          titreFr: '$_id.titreFr',
          titreEn: '$_id.titreEn',
          niveau: '$_id.niveau',
          count: 1,
          evaluations: 1
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: grouped,
      pagination: { page, limit }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: err.message
    });
  }
};




export const validateEvaluation = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { id } = req.params;
    const { statut, commentaireAdminFr, commentaireAdminEn } = req.body;

    if (!['VALIDE', 'REJETE'].includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }

    const updated = await AutoEvaluationBesoin.findByIdAndUpdate(
      id,
      { statut, commentaireAdminFr, commentaireAdminEn },
      { new: true }
    );

    if (!updated) return res.status(404).json({ 
      success:false,
      message: t('auto_evaluation_non_trouvee', lang) 
    });

    return res.status(200).json({
      success:true,
      data:updated
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

//1. Taux de validation des évaluations
export const getTauxValidationEvaluations = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const total = await AutoEvaluationBesoin.countDocuments();
    const valides = await AutoEvaluationBesoin.countDocuments({ statut: 'VALIDE' });
    const rejetees = await AutoEvaluationBesoin.countDocuments({ statut: 'REJETE' });
    const enAttente = await AutoEvaluationBesoin.countDocuments({ statut: 'EN_ATTENTE' });

    return res.status(200).json({
      success:true,
      total,
      valides,
      rejetees,
      enAttente,
      tauxValidation: total ? ((valides / total) * 100).toFixed(1) : 0
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// 2. Moyenne des niveaux par besoin
export const getMoyenneNiveauParBesoin = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const stats = await AutoEvaluationBesoin.aggregate([
      {
        $group: {
          _id: "$besoin",
          moyenneNiveau: { $avg: "$niveau" },
          nbEvaluations: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "besoinformationpredefinis",
          localField: "_id",
          foreignField: "_id",
          as: "besoin"
        }
      },
      { $unwind: "$besoin" },
      {
        $project: {
          besoinId: "$_id",
          titreFr: "$besoin.titreFr",
          titreEn: "$besoin.titreEn",
          moyenneNiveau: { $round: ["$moyenneNiveau", 1] },
          nbEvaluations: 1
        }
      }
    ]);

    return res.status(200).json({
      success:true,
      data:stats
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// 3. Nombre d’évaluations par mois (12 derniers mois)
export const getEvaluationsParMois = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const now = new Date();
    const lastYear = new Date();
    lastYear.setMonth(now.getMonth() - 11);

    const result = await AutoEvaluationBesoin.aggregate([
      {
        $match: {
          createdAt: { $gte: lastYear }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    return res.status(200).json({
      success:true,
      data:result
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// 4. Besoins utilisateur les plus fréquemment exprimés
export const getTopBesoinsAjoutes = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const top = await BesoinAjouteUtilisateur.aggregate([
      {
        $group: {
          _id: "$titreFr",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return res.status(200).json({
      success:true,
      data:top
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// 6. Analyse par utilisateur
export const getStatsParUtilisateur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const result = await AutoEvaluationBesoin.aggregate([
      {
        $group: {
          _id: "$utilisateur",
          nbEvaluations: { $sum: 1 },
          niveauMoyen: { $avg: "$niveau" }
        }
      },
      {
        $lookup: {
          from: "utilisateurs",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          nom: "$user.nom",
          email: "$user.email",
          nbEvaluations: 1,
          niveauMoyen: { $round: ["$niveauMoyen", 1] }
        }
      },
      { $sort: { nbEvaluations: -1 } }
    ]);

    return res.status(200).json({
      success:true,
      data:result
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};


// 📌 Liste des besoins auto-évalués en niveau 1 ou 2
export const getBesoinsFaiblesPrioritaires = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const besoins = await AutoEvaluationBesoin.aggregate([
      {
        $match: {
          niveau: { $lte: 2 },
          statut: "EN_ATTENTE"
        },
      },
      {
        $group: {
          _id: {
            besoin: "$besoin",
            niveau: "$niveau",
          },
          count: { $sum: 1 },
          utilisateurs: { $addToSet: "$utilisateur" },
          derniereMiseAJour: { $max: "$updatedAt" },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      { $limit: 10 },
      {
        $lookup: {
          from: "besoinformationpredefinis",
          localField: "_id.besoin",
          foreignField: "_id",
          as: "besoin",
        },
      },
      { $unwind: "$besoin" },
      {
        $lookup: {
          from: "utilisateurs",
          localField: "utilisateurs",
          foreignField: "_id",
          as: "utilisateurInfo",
        },
      },
      {
        $lookup: {
          from: "postedetravails",
          localField: "utilisateurInfo.posteDeTravail",
          foreignField: "_id",
          as: "postes",
        },
      },
      {
        $project: {
          besoinId: "$_id.besoin",
          niveau: "$_id.niveau",
          count: 1,
          derniereMiseAJour: 1,
          titre: lang === 'en' ? "$besoin.titreEn" : "$besoin.titreFr",
          postes: {
            $map: {
              input: "$postes",
              as: "poste",
              in: {
                id: "$$poste._id",
                nom: lang === 'en' ? "$$poste.nomEn" : "$$poste.nomFr"
              }
            }
          }
        }
      },
      {
        // Supprimer les doublons de postes (même si addToSet est déjà utilisé)
        $addFields: {
          postes: {
            $reduce: {
              input: "$postes",
              initialValue: [],
              in: {
                $cond: [
                  {
                    $in: ["$$this.id", "$$value.id"]
                  },
                  "$$value",
                  { $concatArrays: ["$$value", ["$$this"]] }
                ]
              }
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: besoins,
      total: besoins.length,
    });

  } catch (err) {
    console.error('Erreur dans getBesoinsFaiblesPrioritaires:', err);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? "Erreur serveur" : "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};



// Extraction des mots les plus fréquents dans les insuffisances
export const getMotsClesInsuffisances = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const evaluations = await AutoEvaluationBesoin.find({}, 'insuffisancesFr');

    const fullText = evaluations.map(e => e.insuffisancesFr || '').join(' ').toLowerCase();

    const mots = fullText
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(m => m.length > 3 && !['avec', 'pour', 'dans', 'les', 'des', 'une', 'entre', 'ainsi'].includes(m));

    const freq = {};

    mots.forEach(m => {
      freq[m] = (freq[m] || 0) + 1;
    });

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([mot, count]) => ({ mot, count }));

    return res.status(200).json({
      success:true,
      data:sorted
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};


// Niveau moyen par besoin par mois
export const getEvolutionNiveauBesoin = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { besoinId } = req.params;

    const sixMoins = new Date();
    sixMoins.setMonth(sixMoins.getMonth() - 5);
    sixMoins.setDate(1);

    const result = await AutoEvaluationBesoin.aggregate([
      {
        $match: {
          besoin: besoinId,
          createdAt: { $gte: sixMoins }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          moyenne: { $avg: "$niveau" },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    return res.status(200).json({
      success:true,
      data:result
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

// Répartition des niveaux 1-4 pour un besoin
export const getRepartitionNiveauxParBesoin = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const { besoinId } = req.params;

    const result = await AutoEvaluationBesoin.aggregate([
      { $match: { besoin: besoinId } },
      {
        $group: {
          _id: "$niveau",
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const repartition = [1, 2, 3, 4].map(niv => {
      const entry = result.find(r => r._id === niv);
      return { niveau: niv, total: entry ? entry.total : 0 };
    });

    return res.status(200).json({
      success:true,
      data:repartition
    });
  } catch (err) {
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const getRepartitionBesoinsParPoste = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const repartition = await AutoEvaluationBesoin.aggregate([
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'utilisateur',
          foreignField: '_id',
          as: 'utilisateur'
        }
      },
      { $unwind: '$utilisateur' },
      // Filtrer les utilisateurs qui ont un poste de travail défini
      {
        $match: {
          'utilisateur.posteDeTravail': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$utilisateur.posteDeTravail',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'postedetravails', // Nom correct de la collection (sans 's' à la fin)
          localField: '_id',
          foreignField: '_id',
          as: 'posteDeTravail'
        }
      },
      { $unwind: '$posteDeTravail' },
      {
        $project: {
          _id: 0,
          posteId: '$posteDeTravail._id',
          nomFr: '$posteDeTravail.nomFr',
          nomEn: '$posteDeTravail.nomEn',
          // Utiliser la langue appropriée pour le nom du poste
          nom: lang === 'en' ? '$posteDeTravail.nomEn' : '$posteDeTravail.nomFr',
          nombreBesoins: '$count'
        }
      },
      { $sort: { nombreBesoins: -1 } }
    ]);

   

    return res.status(200).json({
      success: true,
      data: repartition,
    });

  } catch (err) {
    console.error('Erreur lors de la récupération de la répartition des besoins par poste:', err);
    
    return res.status(500).json({
      success: false,
      message:t('erreur_serveur', lang),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


export const getRepartitionBesoinsParNiveauEtPoste = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { posteId } = req.params;

  try {
    const repartition = await mongoose.model('AutoEvaluationBesoin').aggregate([
      // Lookup utilisateur
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'utilisateur',
          foreignField: '_id',
          as: 'utilisateurInfo',
        },
      },
      { $unwind: '$utilisateurInfo' },

      // Filtrer par poste (optionnel si posteId fourni)
      ...(posteId ? [{
        $match: {
          'utilisateurInfo.posteDeTravail': new mongoose.Types.ObjectId(posteId),
        },
      }] : []),

      // Lookup besoin
      {
        $lookup: {
          from: 'besoinformationpredefinis',
          localField: 'besoin',
          foreignField: '_id',
          as: 'besoinInfo',
        },
      },
      { $unwind: '$besoinInfo' },

      // Grouper par besoin + niveau
      {
        $group: {
          _id: {
            titreFr: '$besoinInfo.titreFr',
            titreEn: '$besoinInfo.titreEn',
            niveau: '$niveau',
          },
          count: { $sum: 1 },
        },
      },

      {
        $sort: {
          '_id.titreFr': 1,
          '_id.niveau': 1,
        },
      }
    ]);

    // Transformation côté serveur pour le format requis
    const groupedData = {};
    
    repartition.forEach(item => {
      const key = `${item._id.titreFr}_${item._id.titreEn}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          titreFr: item._id.titreFr,
          titreEn: item._id.titreEn,
          niveau1: 0,
          niveau2: 0,
          niveau3: 0,
          niveau4: 0,
        };
      }
      
      groupedData[key][`niveau${item._id.niveau}`] = item.count;
    });

    const formattedData = Object.values(groupedData)
      .map(item => ({
        ...item,
        total: item.niveau1 + item.niveau2 + item.niveau3 + item.niveau4
      }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json({
      success: true,
      data: {
        repartitionBesoinNiveauPoste: formattedData,
        totalBesoins: formattedData.reduce((sum, item) => sum + item.total, 0),
        nombreCategories: formattedData.length
      },
    });

  } catch (err) {
    console.error('Erreur lors de la récupération de la répartition par niveau:', err);
    
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? "Erreur serveur" : "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};



