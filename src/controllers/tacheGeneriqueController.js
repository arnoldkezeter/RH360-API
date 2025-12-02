import { validationResult } from "express-validator";
import mongoose from "mongoose";
import { t } from "../utils/i18n.js";
import TacheGenerique from "../models/TacheGenerique.js";

// Ajouter une tâche générique
export const createTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t("champs_obligatoires", lang),
      errors: errors.array().map(err => err.msg),
    });
  }

  try {
    let { ordre, code, niveau, nomFr, nomEn, descriptionFr, descriptionEn, type, obligatoire } = req.body;

    // Nettoyage et validation des champs requis
    niveau = niveau?.trim();
    ordre = ordre?.trim();
    code = code?.trim();
    nomFr = nomFr?.trim();
    nomEn = nomEn?.trim();
    descriptionFr = descriptionFr?.trim() || "";
    descriptionEn = descriptionEn?.trim() || "";

    // Validation des champs requis
    if (!ordre || !code || !nomFr || !nomEn || !type) {
      return res.status(400).json({
        success: false,
        message: t("champs_obligatoires", lang),
      });
    }

    // Vérification unicité code, nomFr, nomEn
    const exists = await TacheGenerique.findOne({
      $or: [
        { code },
        { nomFr },
        { nomEn }
      ]
    });
    if (exists) {
      let conflictField = "";
      if (exists.code === code) conflictField = "code";
      else if (exists.nomFr === nomFr) conflictField = "nomFr";
      else if (exists.nomEn === nomEn) conflictField = "nomEn";
      
      return res.status(409).json({
        success: false,
        message: t("tache_generique_existante", lang),
        conflictField,
      });
    }

    // Validation du champ type (enum)
    const typesValides = ['form', 'checkbox', 'upload', 'autoGenerate', 'email', 'evaluation', 'table-form'];
    if (!typesValides.includes(type)) {
      return res.status(400).json({
        success: false,
        message: t("type_tache_invalide", lang),
        typesValides,
      });
    }
    if (niveau) {
      const niveaux = ['pre-formation', 'pendant-formation', 'post-formation'];
      if (!niveaux.includes(type)) {
        return res.status(400).json({
          success: false,
          message: t("niveau_execution_invalide", lang),
          niveaux,
        });
      }
    }

    const tache = await TacheGenerique.create({
      ordre,
      niveau,
      code,
      nomFr,
      nomEn,
      descriptionFr,
      descriptionEn,
      type,
      obligatoire: obligatoire !== undefined ? obligatoire : true,
      actif: true,
    });

    return res.status(201).json({
      success: true,
      message: t("ajouter_succes", lang),
      data: tache,
    });

  } catch (error) {
    console.error("Erreur createTacheGenerique:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Modifier une tâche générique
export const updateTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;
  const { ordre, niveau, nomFr, nomEn, descriptionFr, descriptionEn, type, obligatoire, actif } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: t("champs_obligatoires", lang),
      errors: errors.array().map((err) => err.msg),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id);
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    // Vérification unicité pour nomFr et nomEn (si modifiés)
    if (nomFr || nomEn) {
      const query = {
        _id: { $ne: id },
        $or: []
      };
      
      if (nomFr && nomFr !== tache.nomFr) {
        query.$or.push({ nomFr: nomFr.trim() });
      }
      
      if (nomEn && nomEn !== tache.nomEn) {
        query.$or.push({ nomEn: nomEn.trim() });
      }
      
      if (query.$or.length > 0) {
        const exists = await TacheGenerique.findOne(query);
        if (exists) {
          return res.status(409).json({
            success: false,
            message: t("tache_generique_existante", lang),
          });
        }
      }
    }

    // Validation du type si modifié
    if (type) {
      const typesValides = ['form', 'checkbox', 'upload', 'autoGenerate', 'email', 'evaluation', 'table-form'];
      if (!typesValides.includes(type)) {
        return res.status(400).json({
          success: false,
          message: t("type_tache_invalide", lang),
          typesValides,
        });
      }
      tache.type = type;
    }

    if (niveau) {
      
      const niveaux = ['pre-formation', 'pendant-formation', 'post-formation'];
      if (!niveaux.includes(niveau)) {
        return res.status(400).json({
          success: false,
          message: t("niveau_execution_invalide", lang),
          niveaux,
        });
      }
      tache.niveau = niveau;
    }

    // Mise à jour des champs modifiables
    if (ordre !== undefined) tache.ordre = ordre;
    if (niveau!==undefined) tache.niveau = niveau;
    if (nomFr !== undefined) tache.nomFr = nomFr.trim();
    if (nomEn !== undefined) tache.nomEn = nomEn.trim();
    if (descriptionFr !== undefined) tache.descriptionFr = descriptionFr?.trim() || "";
    if (descriptionEn !== undefined) tache.descriptionEn = descriptionEn?.trim() || "";
    if (obligatoire !== undefined) tache.obligatoire = obligatoire;
    if (actif !== undefined) tache.actif = actif;

    await tache.save();

    return res.status(200).json({
      success: true,
      message: t("modifier_succes", lang),
      data: tache,
    });
  } catch (error) {
    console.error("Erreur updateTacheGenerique:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Supprimer une tâche générique (soft delete recommandé)
export const deleteTacheGenerique = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;
  const { forceDelete } = req.query; // Option pour suppression définitive

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id);
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    if (forceDelete === 'true') {
      // Suppression définitive
      await TacheGenerique.deleteOne({ _id: id });
      return res.status(200).json({
        success: true,
        message: t("supprimer_succes", lang),
      });
    } else {
      // Soft delete - désactiver la tâche
      tache.actif = false;
      await tache.save();
      
      return res.status(200).json({
        success: true,
        message: t("desactiver_succes", lang),
        data: tache,
      });
    }
  } catch (error) {
    console.error("Erreur deleteTacheGenerique:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Lister les tâches génériques avec pagination et filtres
export const getTachesGeneriques = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { nom, type, actif } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const sortField = "ordre"
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

  try {
    let query = {};

    // Filtres
    if (nom) {
      const searchRegex = new RegExp(nom.trim(), "i");
      query.$or = [
        { nomFr: { $regex: searchRegex } },
        { nomEn: { $regex: searchRegex } },
        { code: { $regex: searchRegex } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (actif !== undefined) {
      query.actif = actif === 'true';
    }

    const total = await TacheGenerique.countDocuments(query);
    
    const taches = await TacheGenerique.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortField]: sortOrder, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        tacheGeneriques: taches,
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Erreur getTachesGeneriques:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getAllTachesGeneriques = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  
  try {

   
    
    const taches = await TacheGenerique.find()
      .lean();

    return res.status(200).json({
      success: true,
      data: taches
    });
  } catch (error) {
    console.error("Erreur getTachesGeneriques:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Tâche générique par ID
export const getTacheGeneriqueById = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id).lean();
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    return res.status(200).json({
      success: true,
      data: tache,
    });
  } catch (error) {
    console.error("Erreur getTacheGeneriqueById:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Charger les tâches pour les menus déroulants
export const getTachesGeneriquesForDropdown = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { actif = 'true' } = req.query;
  const sortField = lang === "en" ? "nomEn" : "nomFr";

  try {
    const query = actif !== undefined ? { actif: actif === 'true' } : {};
    
    const taches = await TacheGenerique.find(query, "_id code nomFr nomEn type")
      .sort({ [sortField]: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        tacheGeneriques: taches,
        totalItems: taches.length,
      },
    });
  } catch (error) {
    console.error("Erreur getTachesGeneriquesForDropdown:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Activer/Désactiver une tâche générique
export const toggleTacheGeneriqueStatus = async (req, res) => {
  const lang = req.headers["accept-language"] || "fr";
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: t("identifiant_invalide", lang),
    });
  }

  try {
    const tache = await TacheGenerique.findById(id);
    if (!tache) {
      return res.status(404).json({
        success: false,
        message: t("tache_non_trouvee", lang),
      });
    }

    tache.actif = !tache.actif;
    await tache.save();

    return res.status(200).json({
      success: true,
      message: t(tache.actif ? "activer_succes" : "desactiver_succes", lang),
      data: tache,
    });
  } catch (error) {
    console.error("Erreur toggleTacheGeneriqueStatus:", error);
    return res.status(500).json({
      success: false,
      message: t("erreur_serveur", lang),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const seedTachesGeneriques = async (req, res) => {
  try {
    console.log('🚀 Début du pré-enregistrement des tâches génériques...\n');
    
    let countCreated = 0;
    let countUpdated = 0;
    let countSkipped = 0;
    
    for (const tacheData of tachesGeneriques) {
      try {
        // Vérifier si la tâche existe déjà (par code)
        const existingTache = await TacheGenerique.findOne({ code: tacheData.code });
        
        if (existingTache) {
          // Mettre à jour si des champs ont changé
          const fieldsToUpdate = ['nomFr', 'nomEn', 'descriptionFr', 'descriptionEn', 'type', 'obligatoire'];
          let hasChanges = false;
          
          fieldsToUpdate.forEach(field => {
            if (existingTache[field] !== tacheData[field]) {
              existingTache[field] = tacheData[field];
              hasChanges = true;
            }
          });
          
          if (hasChanges) {
            await existingTache.save();
            console.log(`🔄 Tâche mise à jour: ${tacheData.nomFr}`);
            countUpdated++;
          } else {
            console.log(`⏭️  Tâche déjà à jour: ${tacheData.nomFr}`);
            countSkipped++;
          }
        } else {
          // Créer une nouvelle tâche
          await TacheGenerique.create({
            ...tacheData,
            actif: true
          });
          console.log(`✅ Tâche créée: ${tacheData.nomFr}`);
          countCreated++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour la tâche "${tacheData.nomFr}":`, error.message);
      }
    }
    
    console.log('\n📊 Résumé du pré-enregistrement:');
    console.log(`   • Tâches créées: ${countCreated}`);
    console.log(`   • Tâches mises à jour: ${countUpdated}`);
    console.log(`   • Tâches ignorées (déjà à jour): ${countSkipped}`);
    console.log(`   • Total traité: ${countCreated + countUpdated + countSkipped}`);
    
    console.log('\n🎉 Pré-enregistrement terminé avec succès !');
    
    return res.status(200).json({
      success: true,
      message:"Enregistrer avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur lors du pré-enregistrement:', error);
    return res.status(200).json({
      success: true,
      message:"erreur serveur"
    });
  }
};


// Liste des tâches génériques à pré-enregistrer
const tachesGeneriques = [
  {
    code: 'def_objectifs',
    nomFr: 'Définition des objectifs',
    nomEn: 'Objectives Definition',
    descriptionFr: 'Définir et enregistrer les objectifs pédagogiques de la formation',
    descriptionEn: 'Define and record the pedagogical objectives of the training',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'ident_participants',
    nomFr: 'Identification des participants',
    nomEn: 'Participants Identification',
    descriptionFr: 'Sélectionner les participants parmi les employés concernés selon les postes de travail du public cible',
    descriptionEn: 'Select participants from concerned employees according to target audience job positions',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'ident_formateurs',
    nomFr: 'Identification des formateurs',
    nomEn: 'Trainers Identification',
    descriptionFr: 'Enregistrer et sélectionner les équipes pédagogiques dans l\'application',
    descriptionEn: 'Register and select pedagogical teams in the application',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'choix_lieu_periode',
    nomFr: 'Choix du lieu et de la période',
    nomEn: 'Venue and Period Selection',
    descriptionFr: 'Choisir le(s) lieu(x) de formation, la période et les jours concernés',
    descriptionEn: 'Choose training venue(s), period and concerned days',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'elaboration_budget',
    nomFr: 'Élaboration du budget',
    nomEn: 'Budget Development',
    descriptionFr: 'Élaborer et enregistrer le budget prévisionnel de la formation',
    descriptionEn: 'Develop and record the training budget forecast',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'elaboration_tdr',
    nomFr: 'Élaboration des termes de référence',
    nomEn: 'Terms of Reference Development',
    descriptionFr: 'Élaborer les termes de référence de la formation',
    descriptionEn: 'Develop the training terms of reference',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'note_service_convocation',
    nomFr: 'Élaboration de la note de service convoquant les participants',
    nomEn: 'Service Note for Participants Convocation',
    descriptionFr: 'Génération automatique de la note de service pour convoquer les participants',
    descriptionEn: 'Automatic generation of service note to convene participants',
    type: 'autoGenerate',
    obligatoire: true
  },
  {
    code: 'note_presentation',
    nomFr: 'Élaboration de la note de présentation',
    nomEn: 'Presentation Note Development',
    descriptionFr: 'Génération automatique de la note de présentation de la formation',
    descriptionEn: 'Automatic generation of training presentation note',
    type: 'autoGenerate',
    obligatoire: true
  },
  {
    code: 'validation_dg',
    nomFr: 'Validation par le Directeur Général',
    nomEn: 'General Director Validation',
    descriptionFr: 'Upload de la note de service signée et scannée par le DG pour validation',
    descriptionEn: 'Upload of service note signed and scanned by General Director for validation',
    type: 'upload',
    obligatoire: true
  },
  {
    code: 'reunion_prep_beneficiaires',
    nomFr: 'Réunion préparatoire avec les services bénéficiaires',
    nomEn: 'Preparatory Meeting with Beneficiary Services',
    descriptionFr: 'Organiser et valider la tenue de la réunion préparatoire avec les services bénéficiaires',
    descriptionEn: 'Organize and validate the preparatory meeting with beneficiary services',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'reunion_prep_formateurs',
    nomFr: 'Réunion préparatoire avec les formateurs',
    nomEn: 'Preparatory Meeting with Trainers',
    descriptionFr: 'Organiser et valider la tenue de la réunion préparatoire avec les formateurs',
    descriptionEn: 'Organize and validate the preparatory meeting with trainers',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'communication_participants',
    nomFr: 'Communication aux participants',
    nomEn: 'Communication to Participants',
    descriptionFr: 'Envoi automatique d\'emails de communication aux participants',
    descriptionEn: 'Automatic sending of communication emails to participants',
    type: 'email',
    obligatoire: true
  },
  {
    code: 'communication_formateurs',
    nomFr: 'Communication aux formateurs',
    nomEn: 'Communication to Trainers',
    descriptionFr: 'Envoi automatique d\'emails de communication aux formateurs',
    descriptionEn: 'Automatic sending of communication emails to trainers',
    type: 'email',
    obligatoire: true
  },
  {
    code: 'confection_fiches_eval_chaud',
    nomFr: 'Confection des fiches d\'évaluation à chaud',
    nomEn: 'Hot Evaluation Forms Creation',
    descriptionFr: 'Créer les fiches d\'évaluation à chaud dans l\'application',
    descriptionEn: 'Create hot evaluation forms in the application',
    type: 'form',
    obligatoire: true
  },
  {
    code: 'confection_fiches_presence_formateur',
    nomFr: 'Confection des fiches de présence formateur',
    nomEn: 'Trainer Attendance Sheets Creation',
    descriptionFr: 'Génération automatique des fiches de présence pour les formateurs',
    descriptionEn: 'Automatic generation of attendance sheets for trainers',
    type: 'autoGenerate',
    obligatoire: true
  },
  {
    code: 'confection_fiches_presence_participant',
    nomFr: 'Confection des fiches de présence participant',
    nomEn: 'Participant Attendance Sheets Creation',
    descriptionFr: 'Génération automatique des fiches de présence pour les participants',
    descriptionEn: 'Automatic generation of attendance sheets for participants',
    type: 'autoGenerate',
    obligatoire: true
  },
  {
    code: 'confection_supports',
    nomFr: 'Confection des supports de formation',
    nomEn: 'Training Materials Creation',
    descriptionFr: 'Préparer et valider les supports pédagogiques de la formation',
    descriptionEn: 'Prepare and validate training pedagogical materials',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'confection_kits_formateur',
    nomFr: 'Confection des kits du formateur',
    nomEn: 'Trainer Kits Creation',
    descriptionFr: 'Préparer et valider les kits destinés aux formateurs',
    descriptionEn: 'Prepare and validate kits for trainers',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'verification_salles',
    nomFr: 'Vérification de la disponibilité des salles',
    nomEn: 'Training Rooms Availability Check',
    descriptionFr: 'Vérifier et confirmer la disponibilité des salles de formation',
    descriptionEn: 'Check and confirm training rooms availability',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'mise_disposition_frais',
    nomFr: 'Mise à disposition des frais de mission',
    nomEn: 'Mission Expenses Provision',
    descriptionFr: 'Valider la mise à disposition des frais de mission pour la formation',
    descriptionEn: 'Validate the provision of mission expenses for training',
    type: 'checkbox',
    obligatoire: true
  },
  {
    code: 'deroulement_formation',
    nomFr: 'Déroulement effectif de la formation',
    nomEn: 'Actual Training Conduct',
    descriptionFr: 'Valider le déroulement effectif de chaque journée de formation',
    descriptionEn: 'Validate the actual conduct of each training day',
    type: 'table-form',
    obligatoire: true
  },
  {
    code: 'rapport_formation',
    nomFr: 'Élaboration du rapport de la formation',
    nomEn: 'Preparation of the training report',
    descriptionFr: "Rédiger et finaliser le rapport détaillé de la formation, incluant les objectifs, déroulement, évaluations et recommandations.",
    descriptionEn: "Drafting and finalizing the detailed training report, including objectives, proceedings, evaluations, and recommendations.",
    type: 'upload', 
    obligatoire: true
  },

  {
    code: 'signature_presence_formateur',
    nomFr: 'Signature des fiches de présence formateur',
    nomEn: 'Trainer Attendance Sheets Signature',
    descriptionFr: 'Valider la signature des fiches de présence formateur par jour de formation',
    descriptionEn: 'Validate trainer attendance sheets signature per training day',
    type: 'table-form',
    obligatoire: true
  },
  {
    code: 'signature_presence_participant',
    nomFr: 'Signature des fiches de présence participant',
    nomEn: 'Participant Attendance Sheets Signature',
    descriptionFr: 'Valider la signature des fiches de présence participant par jour de formation',
    descriptionEn: 'Validate participant attendance sheets signature per training day',
    type: 'table-form',
    obligatoire: true
  },
  {
    code: 'remplissage_eval_chaud',
    nomFr: 'Remplissage des fiches d\'évaluation à chaud',
    nomEn: 'Hot Evaluation Forms Completion',
    descriptionFr: 'Valider le remplissage des fiches d\'évaluation à chaud (en ligne ou manuel)',
    descriptionEn: 'Validate hot evaluation forms completion (online or manual)',
    type: 'evaluation',
    obligatoire: true
  },
  {
    code: 'evaluation_connaissances',
    nomFr: 'Évaluation des connaissances par le formateur',
    nomEn: 'Knowledge Assessment by Trainer',
    descriptionFr: 'Enregistrement des moyennes obtenues par chaque participant (optionnel)',
    descriptionEn: 'Recording of averages obtained by each participant (optional)',
    type: 'form',
    obligatoire: false
  },
  {
    code: 'evaluation_froid',
    nomFr: 'Réalisation de l\'évaluation à froid',
    nomEn: 'Cold Evaluation Implementation',
    descriptionFr: 'Valider la réalisation de l\'évaluation à froid (en ligne ou manuel)',
    descriptionEn: 'Validate cold evaluation implementation (online or manual)',
    type: 'evaluation',
    obligatoire: true
  }
];