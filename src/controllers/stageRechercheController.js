import StageRecherche from '../models/StageRecherche.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Chercheur from '../models/Chercheur.js';
import { sendStageRechercheNotificationEmail } from '../utils/sendMailNotificationChercheur.js';
import mongoose from 'mongoose';
import fs from "fs";
import path from "path";
import { promisify } from 'util';
import { sendEmail } from '../utils/sendMailNotificationStatutStage.js';

const isValidDateRange = (start, end) => new Date(start) <= new Date(end);

const isOverlapping = (start1, end1, start2, end2) => {
  return new Date(start1) <= new Date(end2) && new Date(start2) <= new Date(end1);
};

const checkOverlaps = (items, idKey) => {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (
        items[i][idKey] &&
        items[i][idKey].toString() === items[j][idKey].toString() &&
        isOverlapping(items[i].dateDebut, items[i].dateFin, items[j].dateDebut, items[j].dateFin)
      ) {
        return true;
      }
    }
  }
  return false;
};

export const createStageRecherche = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const {
        nomFr,
        nomEn,
        chercheur,
        superviseur,
        dateDebut,
        dateFin,
        anneeStage,
        statut
    } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }
    
    if (!isValidDateRange(dateDebut, dateFin)) {
        return res.status(400).json({
            success: false,
            message: t('date_debut_anterieur_date_fin', lang),
        });
    }

    

    // Création du stageRecherche
    const stageRecherche = new StageRecherche({ nomFr, nomEn, chercheur,superviseur, dateDebut, dateFin, anneeStage, statut });
    await stageRecherche.save({ session });  

    await session.commitTransaction();
    session.endSession();

    // Envoi mail notification
   
    const chercheurDoc = await Chercheur.findById(chercheur);
    if (chercheurDoc && chercheurDoc.email) {
        sendStageRechercheNotificationEmail(
            chercheurDoc.email,
            lang,
            chercheurDoc.nom,
            chercheurDoc.prenom
        );
    }
    

    return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: stageRecherche,
    });

  } catch (err) {
    console.log(err)
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const getStageRechercheById = async (req, res) => {
  try {
    const { id} = req.params;

    // Validation des paramètres
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID du stageRecherche et le type sont requis en tant que query parameters'
      });
    }

    

    // Utilisation de la même logique que la fonction principale avec select limité
    let query = StageRecherche.findById(id)
        .populate({
            path: 'chercheur',
            select: 'nom prenom'
        })
        .populate({
            path: 'superviseur',
            select: 'nom prenom'
        })

    const stageRecherche = await query.exec();

    if (!stageRecherche) {
      return res.status(404).json({
        success: false,
        message: `Aucun stageRecherche de type ${type} trouvé avec l'ID ${id}`
      });
    }

    

    res.status(200).json({
      success: true,
      data: stageRecherche,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du stageRecherche:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Format d\'ID invalide'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la récupération du stageRecherche'
    });
  }
};


export const updateStageRecherche = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const stageId = req.params.stageId;
    const {
        nomFr,
        nomEn,
        chercheur,
        superviseur,
        dateDebut,
        dateFin,
        anneeStage,
        statut
    } = req.body;

    // Vérifier que le stageRecherche existe
    const existingStageRecherche = await StageRecherche.findById(stageId);
    if (!existingStageRecherche) {
        return res.status(404).json({
            success: false,
            message: t('stage_introuvable', lang),
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
    
    if (!isValidDateRange(dateDebut, dateFin)) {
        return res.status(400).json({
            success: false,
            message: t('date_debut_anterieur_date_fin', lang),
        });
    }
        

    // MISE À JOUR DU stageRecherche
    const updatedStageRecherche = await StageRecherche.findByIdAndUpdate(
      stageId,
      { 
        nomFr, 
        nomEn, 
        chercheur,
        superviseur,
        dateDebut, 
        dateFin, 
        anneeStage, 
        statut,
      },
      { new: true, session }
    );

    
    await session.commitTransaction();
    session.endSession();


    return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: updatedStageRecherche,
    });

  } catch (err) {
    console.log(err)
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
        success: false,
        message: t('erreur_serveur', lang),
        error: err.message,
    });
  }
};

export const deleteStageRecherche = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    try {
        const stageRecherche = await StageRecherche.findByIdAndDelete(id);
        if (!stageRecherche) {
            return res.status(404).json({ 
                success: false, 
                message: t('stage_non_trouve', lang) 
            });
        }
       

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};



const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

export const changerStatutStageRecherche = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { stageId } = req.params;
    const { statut } = req.body;
    const session = await mongoose.startSession();
    
    // Fonction helper pour nettoyer le fichier uploadé
    const cleanupUploadedFile = async () => {
        if (req.file?.path) {
            try {
                await unlinkAsync(req.file.path);
            } catch (error) {
                console.error('Erreur lors de la suppression du fichier uploadé:', error);
            }
        }
    };

    try {
        // Validation de l'ID du stage
        if (!mongoose.Types.ObjectId.isValid(stageId)) {
            await cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // Validation du statut
        const statutsValides = ['ACCEPTE', 'REFUSE'];
        if (!statut || !statutsValides.includes(statut)) {
            await cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: t('statut_invalide', lang),
                statutsValides
            });
        }

        // Démarrer la transaction
        session.startTransaction();

        // Récupérer le stage avec le chercheur
        const stage = await StageRecherche.findById(stageId)
            .populate({
                path: 'chercheur',
                select: 'nom prenom email'
            })
            .session(session);

        if (!stage) {
            await cleanupUploadedFile();
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: t('stage_non_trouve', lang)
            });
        }

        // Vérifier que le chercheur existe
        if (!stage.chercheur) {
            await cleanupUploadedFile();
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: lang === 'fr' ? 'Chercheur non trouvé' : 'Researcher not found'
            });
        }

        let noteServicePath = null;
        let noteServiceRelatif = null;

        // Gestion de la note de service pour ACCEPTE
        if (statut === 'ACCEPTE') {
            if (!req.file) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: t('note_service_obligatoire', lang)
                });
            }

            // Validation du type de fichier
            const extensionsAutorisees = ['.pdf', '.doc', '.docx'];
            const extension = path.extname(req.file.originalname).toLowerCase();
            if (!extensionsAutorisees.includes(extension)) {
                await cleanupUploadedFile();
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: t('format_fichier_invalide', lang),
                    formatsAcceptes: extensionsAutorisees
                });
            }

            // Validation de la taille du fichier (max 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (req.file.size > maxSize) {
                await cleanupUploadedFile();
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: t('fichier_trop_volumineux', lang),
                    tailleMax: '5MB'
                });
            }

            // Supprimer l'ancienne note si elle existe
            if (stage.noteService) {
                const oldFilePath = path.join(
                    process.cwd(), 
                    'public/uploads/notes_service', 
                    path.basename(stage.noteService)
                );
                try {
                    if (await existsAsync(oldFilePath)) {
                        await unlinkAsync(oldFilePath);
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression de l\'ancienne note:', error);
                    // On continue quand même, ce n'est pas bloquant
                }
            }

            noteServiceRelatif = `/files/notes_service/${req.file.filename}`;
            noteServicePath = path.join(
                process.cwd(), 
                "public/uploads/notes_service", 
                req.file.filename
            );

            // Vérifier que le fichier a bien été uploadé
            if (!(await existsAsync(noteServicePath))) {
                await session.abortTransaction();
                session.endSession();
                return res.status(500).json({
                    success: false,
                    message: t('erreur_upload_fichier', lang)
                });
            }

            stage.noteService = noteServiceRelatif;
        }

        // Mettre à jour le statut
        stage.statut = statut;
        await stage.save({ session });

        // Valider la transaction avant d'envoyer l'email
        await session.commitTransaction();
        session.endSession();

        // Envoyer l'email au chercheur
        const chercheur = stage.chercheur;
        let emailSent = false;
        let emailError = null;

        if (chercheur?.email) {
            // Validation basique de l'email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(chercheur.email)) {
                let subject, text, html;
                const attachments = [];

                if (statut === "ACCEPTE") {
                    subject = lang === 'fr' 
                        ? "Votre demande de stage de recherche a été acceptée" 
                        : "Your research internship request has been accepted";
                    
                    text = lang === 'fr'
                        ? "Votre demande de stage de recherche a été acceptée. Veuillez consulter la note de service jointe."
                        : "Your research internship request has been accepted. Please find the service note attached.";
                    
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2c3e50;">Demande de Stage de Recherche</h2>
                            <p>Bonjour <strong>${chercheur.nom} ${chercheur.prenom || ''}</strong>,</p>
                            <p>Nous avons le plaisir de vous informer que votre demande de stage de recherche 
                            <strong style="color: #27ae60;">a été acceptée</strong>.</p>
                            <p>Veuillez trouver en pièce jointe la note de service officielle.</p>
                            <p>Cordialement,<br/>Direction Générale des Impôts</p>
                        </div>
                    `;

                    if (noteServicePath && await existsAsync(noteServicePath)) {
                        attachments.push({
                            filename: `Note_Service_${stage._id}.pdf`,
                            path: noteServicePath,
                            contentType: 'application/pdf'
                        });
                    }
                } else {
                    subject = lang === 'fr'
                        ? "Votre demande de stage de recherche n'a pas été retenue"
                        : "Your research internship request was not accepted";
                    
                    text = lang === 'fr'
                        ? "Votre demande de stage de recherche n'a pas été retenue."
                        : "Your research internship request was not accepted.";
                    
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2c3e50;">Demande de Stage de Recherche</h2>
                            <p>Bonjour <strong>${chercheur.nom} ${chercheur.prenom || ''}</strong>,</p>
                            <p>Nous vous informons que votre demande de stage de recherche n'a pas été retenue pour cette session.</p>
                            <p>Nous vous encourageons à postuler lors des prochaines sessions.</p>
                            <p>Cordialement,<br/>Direction Générale des Impôts</p>
                        </div>
                    `;
                }

                try {
                    await sendEmail({
                        to: chercheur.email,
                        subject,
                        text,
                        html,
                        attachments
                    });
                    emailSent = true;
                } catch (error) {
                    emailError = error.message;
                    console.error(`Erreur envoi email à ${chercheur.email}:`, error);
                }
            } else {
                console.warn(`Email invalide pour ${chercheur.nom}: ${chercheur.email}`);
            }
        } else {
            console.warn(`Chercheur ${chercheur?.nom || 'inconnu'} sans email`);
        }

        // Construire la réponse
        const response = {
            success: true,
            message: t('modifier_succes', lang),
            data: {
                stage: {
                    _id: stage._id,
                    statut: stage.statut,
                    noteService: stage.noteService,
                    chercheur: {
                        _id: chercheur._id,
                        nom: chercheur.nom,
                        prenom: chercheur.prenom,
                        email: chercheur.email
                    }
                },
                emailEnvoye: emailSent
            }
        };

        // Ajouter l'erreur d'email si en mode développement
        if (emailError && process.env.NODE_ENV === 'development') {
            response.data.erreurEmail = emailError;
        }

        return res.status(200).json(response);

    } catch (error) {
        // Nettoyage en cas d'erreur
        await cleanupUploadedFile();
        
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error("Erreur dans changerStatutStageRecherche:", error);
        
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//Liste des stages
export const listeStageRecherches = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        statut = '' 
    } = req.query;

    try {
        // Construction du filtre de recherche
        const matchFilters = {};

        // Filtre par recherche (nomFr ou nomEn)
        if (search && search.trim() !== '') {
            matchFilters.$or = [
                { nomFr: { $regex: search, $options: 'i' } },
                { nomEn: { $regex: search, $options: 'i' } }
            ];
        }

        // Filtre par statut
        if (statut && statut !== 'ALL') {
            matchFilters.statut = statut;
        }

        const pipeline = [
            // Filtre initial
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),
            
            {
                $lookup: {
                    from: 'chercheurs', // Collection des chercheurs
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo',
                },
            },
            {
                $lookup: {
                    from: 'rotations', // Collection des rotations
                    localField: '_id',
                    foreignField: 'stageRecherche',
                    as: 'rotations',
                },
            },
            {
                $addFields: {
                    nom: {
                        $cond: [
                            { $eq: [lang, 'en'] },
                            '$nomEn',
                            '$nomFr'
                        ]
                    },
                    // Nombre de chercheurs (toujours 1 pour les stages individuels)
                    nombreChercheurs: {
                        $cond: [{ $ne: ['$chercheur', null] }, 1, 0]
                    },
                    // Dates basées sur les rotations
                    dateDebutCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $min: '$rotations.dateDebut' },
                            '$dateDebut'
                        ]
                    },
                    dateFinCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $max: '$rotations.dateFin' },
                            '$dateFin'
                        ]
                    },
                },
            },
            {
                $sort: { createdAt: -1 }, // Tri par date de création
            },
            {
                $skip: (parseInt(page) - 1) * parseInt(limit),
            },
            {
                $limit: parseInt(limit),
            },
            {
                $project: {
                    _id: 1,
                    nom: 1,
                    nomFr: 1,
                    nomEn: 1,
                    nombreChercheurs: 1,
                    dateDebut: '$dateDebutCalculee',
                    dateFin: '$dateFinCalculee',
                    dateDebutOriginale: '$dateDebut',
                    dateFinOriginale: '$dateFin',
                    anneeStage: 1,
                    statut: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ];

        // Exécution de l'agrégation
        const stages = await StageRecherche.aggregate(pipeline);

        // Compter le total avec les mêmes filtres
        const totalPipeline = [
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),
            { $count: "total" }
        ];
        
        const totalResult = await StageRecherche.aggregate(totalPipeline);
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return res.status(200).json({
            success: true,
            data: {
                stageRecherches:stages,
                totalItems: total,
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
                hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
                hasPrevPage: parseInt(page) > 1,
                // Informations de filtrage
                filters: {
                    search: search || '',
                    statut: statut || 'ALL'
                }
            },
        });
    } catch (error) {
        console.error('Erreur dans listeStageRecherches:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

//Liste des stages par établissement
export const listeStageRecherchesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { etablissementId } = req.params;

    try {
        const pipeline = [
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $match: {
                    'chercheurInfo.etablissement': new mongoose.Types.ObjectId(etablissementId)
                }
            },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $project: {
                    _id: 1,
                    nomFr: 1,
                    nomEn: 1,
                    dateDebut: 1,
                    dateFin: 1,
                    anneeStage: 1,
                    statut: 1,
                    chercheur: {
                        _id: '$chercheurInfo._id',
                        nom: '$chercheurInfo.nom',
                        prenom: '$chercheurInfo.prenom',
                        etablissement: '$etablissement'
                    },
                    createdAt: 1,
                    updatedAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ];

        const stages = await StageRecherche.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            message: t('liste_stages_succes', lang),
            data: {
                stages
            },
        });
    } catch (error) {
        console.error('Erreur dans listeStageRecherchesParEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


// Helper pour construire les filtres
const buildFilters = (query) => {
    const filters = {};
    
    if (query.dateDebut) filters.dateDebut = { $gte: new Date(query.dateDebut) };
    if (query.dateFin) filters.dateFin = { $lte: new Date(query.dateFin) };
    if (query.statut) filters.statut = query.statut;
    if (query.anneeStage) filters.anneeStage = parseInt(query.anneeStage);
    
    return filters;
};

/**
 * Nombre de stages enregistrés par établissement
 * GET /api/statistiques/stages-par-etablissement
 */
export const nombreStageRecherchesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);
        
        const stagesIndividuels = await StageRecherche.aggregate([
            { $match: filters },
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: '$etablissement._id',
                    etablissement: { $first: '$etablissement' },
                    nombreStageRecherches: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: stagesIndividuels
        });

    } catch (error) {
        console.error('Erreur nombreStageRecherchesParEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

/**
 * Nombre de stages par statut et établissement
 * GET /api/statistiques/stages-statut-etablissement
 */
export const nombreStageRecherchesParStatutEtEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);

        const pipeline = [
            { $match: filters },
            {
                $lookup: {
                    from: 'chercheurs',
                    localField: 'chercheur',
                    foreignField: '_id',
                    as: 'chercheurInfo'
                }
            },
            { $unwind: '$chercheurInfo' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'chercheurInfo.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: {
                        etablissement: '$etablissement._id',
                        statut: '$statut'
                    },
                    etablissementInfo: { $first: '$etablissement' },
                    count: { $sum: 1 }
                }
            }
        ];

        const result = await StageRecherche.aggregate(pipeline);

        // Regrouper par établissement
        const etablissementMap = new Map();
        
        result.forEach(item => {
            const etablissementId = item._id.etablissement.toString();
            if (!etablissementMap.has(etablissementId)) {
                etablissementMap.set(etablissementId, {
                    etablissement: {
                        nomFr: item.etablissementInfo.nomFr,
                        nomEn: item.etablissementInfo.nomEn
                    },
                    acceptes: 0,
                    refuses: 0,
                    enAttente: 0
                });
            }
            
            const etablissement = etablissementMap.get(etablissementId);
            if (item._id.statut === 'ACCEPTE') etablissement.acceptes += item.count;
            else if (item._id.statut === 'REFUSE') etablissement.refuses += item.count;
            else if (item._id.statut === 'EN_ATTENTE') etablissement.enAttente += item.count;
        });

        return res.status(200).json({
            success: true,
            data: Array.from(etablissementMap.values())
        });

    } catch (error) {
        console.error('Erreur nombreStageRecherchesParStatutEtEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

export const totalChercheursSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    const dateDebutFilter = new Date(dateDebut);
    const dateFinFilter = new Date(dateFin);

    // Agrégation pour compter les chercheurs distincts
    const chercheursIndividuelsResult = await StageRecherche.aggregate([
      {
        $match: {
          chercheur: { $exists: true, $ne: null },
          dateDebut: { $lte: dateFinFilter },
          dateFin: { $gte: dateDebutFilter }
        }
      },
      {
        $group: {
          _id: '$chercheur' // Grouper par chercheur (distinct)
        }
      }
    ]);

    const totalChercheurs = chercheursIndividuelsResult.length;

    return res.status(200).json({
      success: true,
      totalChercheurs
    });

  } catch (error) {
    console.error("Erreur dans totalChercheursSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};

export const totalChercheursTerminesSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    // ✅ On ne garde que la date (sans l’heure)
    const dateDebutFilter = new Date(dateDebut);

    const dateFinFilter = new Date(dateFin);

    const now = new Date();
    now.setHours(23, 59, 59, 999); // sécurité : on s’arrête à aujourd’hui inclus

    const chercheursIndividuelsResult = await StageRecherche.aggregate([
      {
        $match: {
          chercheur: { $exists: true, $ne: null },
          dateFin: { 
            $gte: dateDebutFilter,  // fini après ou à la dateDebut
            $lte: dateFinFilter,    // fini avant ou à la dateFin
            $lte: now               // déjà terminé
          }
        }
      },
      {
        $group: {
          _id: '$chercheur'
        }
      }
    ]);

    const totalChercheursTermines = chercheursIndividuelsResult.length;
    
    return res.status(200).json({
      success: true,
      data:totalChercheursTermines
    });

  } catch (error) {
    console.error("Erreur dans totalChercheursTerminesSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};


export const moyenneChercheursParSuperviseurSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    const dateDebutFilter = new Date(dateDebut);
    const dateFinFilter = new Date(dateFin);

    const pipeline = [
      {
        $match: {
          chercheur: { $exists: true, $ne: null },
          superviseur: { $exists: true, $ne: null },
          dateDebut: { $lte: dateFinFilter },
          dateFin: { $gte: dateDebutFilter }
        }
      },
      {
        $group: {
          _id: '$superviseur',
          chercheurs: { $addToSet: '$chercheur' } // chercheurs uniques par superviseur
        }
      },
      {
        $project: {
          _id: 0,
          superviseurId: '$_id',
          nombreChercheurs: { $size: '$chercheurs' }
        }
      },
      {
        $group: {
          _id: null,
          totalChercheurs: { $sum: '$nombreChercheurs' },
          totalSuperviseurs: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          moyenneChercheursParSuperviseur: {
            $cond: [
              { $eq: ['$totalSuperviseurs', 0] },
              0,
              { $divide: ['$totalChercheurs', '$totalSuperviseurs'] }
            ]
          }
        }
      }
    ];

    const result = await StageRecherche.aggregate(pipeline);
    const moyenne = result[0]?.moyenneChercheursParSuperviseur || 0;

    return res.status(200).json({
      success: true,
      data: moyenne
    });
  } catch (error) {
    console.error("Erreur dans moyenneChercheursParSuperviseurSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};

export const dureeMoyenneStageRecherchesSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    const dateDebutFilter = new Date(dateDebut);
    const dateFinFilter = new Date(dateFin);

    const pipeline = [
      {
        $match: {
          dateDebut: { $lte: dateFinFilter },
          dateFin: { $gte: dateDebutFilter }
        }
      },
      {
        $project: {
          dureeEnJours: {
            $divide: [
              { $subtract: ['$dateFin', '$dateDebut'] },
              1000 * 60 * 60 * 24 // conversion ms → jours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          dureeMoyenneJours: { $avg: '$dureeEnJours' }
        }
      }
    ];

    const result = await StageRecherche.aggregate(pipeline);
    const dureeMoyenneJours = result[0]?.dureeMoyenneJours || 0;

    // Conversion en mois approximatifs (30 jours)
    const dureeMoyenneMois = dureeMoyenneJours / 30;

    return res.status(200).json({
      success: true,
      dureeMoyenneJours: dureeMoyenneJours.toFixed(2),
      dureeMoyenneMois: dureeMoyenneMois.toFixed(2)
    });
  } catch (error) {
    console.error("Erreur dans dureeMoyenneStageRecherchesSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};

export const tauxStatutStageRecherchesSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const result = await StageRecherche.aggregate([
            { $match: matchStageRecherche },
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalStageRecherches = result.reduce((acc, cur) => acc + cur.count, 0);
        const map = result.reduce((acc, cur) => {
            acc[cur._id] = cur.count;
            return acc;
        }, {});

        const tauxAccepte = totalStageRecherches > 0 ? (map.ACCEPTE || 0) / totalStageRecherches : 0;
        const tauxRefuse = totalStageRecherches > 0 ? (map.REFUSE || 0) / totalStageRecherches : 0;
        const tauxEnAttente = totalStageRecherches > 0 ? (map.EN_ATTENTE || 0) / totalStageRecherches : 0;

        return res.status(200).json({
            success: true,
            tauxStatutStageRecherches: {
                tauxAccepte: tauxAccepte,
                tauxRefuse: tauxRefuse,
                tauxEnAttente: tauxEnAttente,
            }
        });
    } catch (error) {
        console.error("Erreur dans tauxStatutStageRecherchesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionChercheursParServiceSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
        return res.status(400).json({
            success: false,
            message: lang === 'fr'
                ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
                : 'dateDebut and dateFin parameters are required.'
        });
    }

    try {
        const dateDebutFilter = new Date(dateDebut);
        const dateFinFilter = new Date(dateFin);

        const matchStageRecherche = {
            chercheur: { $exists: true, $ne: null },
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const repartition = await Rotation.aggregate([
            { $match: matchStageRecherche },
            {
                $group: {
                    _id: '$service',
                    chercheurs: { $addToSet: '$chercheur' }
                }
            },
            {
                $project: {
                    _id: 0,
                    service: '$_id',
                    nombreChercheurs: { $size: '$chercheurs' }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionChercheursParServiceSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionChercheursParSuperviseurSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    // ✅ Normalisation des dates (on ignore l’heure)
    const dateDebutFilter = new Date(dateDebut);
    dateDebutFilter.setHours(0, 0, 0, 0);

    const dateFinFilter = new Date(dateFin);
    dateFinFilter.setHours(23, 59, 59, 999);

    if (isNaN(dateDebutFilter) || isNaN(dateFinFilter)) {
      return res.status(400).json({
        success: false,
        message: lang === 'fr'
          ? 'Les dates fournies ne sont pas valides.'
          : 'The provided dates are not valid.'
      });
    }

    if (dateDebutFilter > dateFinFilter) {
      return res.status(400).json({
        success: false,
        message: lang === 'fr'
          ? 'La date de début doit être antérieure à la date de fin.'
          : 'The start date must be earlier than the end date.'
      });
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const repartition = await StageRecherche.aggregate([
      {
        $match: {
          chercheur: { $exists: true, $ne: null },
          superviseur: { $exists: true, $ne: null },
          dateDebut: { $lte: dateFinFilter },
          dateFin: { $gte: dateDebutFilter }
        }
      },
      {
        $group: {
          _id: '$superviseur',
          chercheurs: { $addToSet: '$chercheur' },
          stages: { $push: { dateDebut: '$dateDebut', dateFin: '$dateFin' } }
        }
      },
      {
        $lookup: {
          from: 'utilisateurs',
          localField: '_id',
          foreignField: '_id',
          as: 'superviseurInfo'
        }
      },
      { $unwind: { path: '$superviseurInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          superviseur: {
            _id: '$superviseurInfo._id',
            nom: '$superviseurInfo.nom',
            prenom: '$superviseurInfo.prenom',
            email: '$superviseurInfo.email'
          },
          nombreChercheurs: { $size: '$chercheurs' },
          stagesEnCours: {
            $size: {
              $filter: {
                input: '$stages',
                as: 'stage',
                cond: {
                  $and: [
                    { $lte: ['$$stage.dateDebut', now] },
                    { $gte: ['$$stage.dateFin', now] }
                  ]
                }
              }
            }
          },
          stagesTermines: {
            $size: {
              $filter: {
                input: '$stages',
                as: 'stage',
                cond: { $lt: ['$$stage.dateFin', now] }
              }
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: repartition.length > 0 ? repartition : []
    });

  } catch (error) {
    console.error("Erreur dans repartitionChercheursParSuperviseurSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};


export const repartitionChercheursParEtablissementSurPeriode = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  if (!dateDebut || !dateFin) {
    return res.status(400).json({
      success: false,
      message: lang === 'fr'
        ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
        : 'dateDebut and dateFin parameters are required.'
    });
  }

  try {
    const dateDebutFilter = new Date(dateDebut);
    dateDebutFilter.setHours(0, 0, 0, 0);

    const dateFinFilter = new Date(dateFin);
    dateFinFilter.setHours(23, 59, 59, 999);

    if (isNaN(dateDebutFilter) || isNaN(dateFinFilter)) {
      return res.status(400).json({
        success: false,
        message: lang === 'fr'
          ? 'Les dates fournies ne sont pas valides.'
          : 'The provided dates are not valid.'
      });
    }

    if (dateDebutFilter > dateFinFilter) {
      return res.status(400).json({
        success: false,
        message: lang === 'fr'
          ? 'La date de début doit être antérieure à la date de fin.'
          : 'The start date must be earlier than the end date.'
      });
    }

    const matchStageRecherche = {
      chercheur: { $exists: true, $ne: null },
      dateDebut: { $lte: dateFinFilter },
      dateFin: { $gte: dateDebutFilter }
    };

    const repartition = await StageRecherche.aggregate([
      { $match: matchStageRecherche },
      {
        // 💡 MODIFICATION : Joindre la collection 'baseutilisateurs' au lieu de 'chercheurs'
        $lookup: {
          from: 'baseutilisateurs', 
          localField: 'chercheur',
          foreignField: '_id',
          as: 'chercheurInfo'
        }
      },
      { $unwind: { path: '$chercheurInfo', preserveNullAndEmptyArrays: true } },
      
      // Filtre pour garantir que l'établissement existe sur le document BaseUtilisateur/Chercheur.
      { 
        $match: { 
          'chercheurInfo.etablissement': { $exists: true, $ne: null },
          // Optionnel mais recommandé : s'assurer que c'est bien un chercheur
          'chercheurInfo.type': 'Chercheur' 
        } 
      },
      
      {
        $group: {
          // L'établissement se trouve maintenant dans le document joint
          _id: '$chercheurInfo.etablissement',
          totalStages: { $sum: 1 },
          stagesAccepte: { $sum: { $cond: [{ $eq: ['$statut', 'ACCEPTE'] }, 1, 0] } },
          stagesRefuse: { $sum: { $cond: [{ $eq: ['$statut', 'REFUSE'] }, 1, 0] } },
          chercheurs_ids: { $addToSet: '$chercheur' } 
        }
      },
      {
        $lookup: {
          from: 'etablissements',
          localField: '_id',
          foreignField: '_id',
          as: 'etablissementInfo'
        }
      },
      { $unwind: { path: '$etablissementInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          etablissement: {
            nomFr: '$etablissementInfo.nomFr',
            nomEn: '$etablissementInfo.nomEn'
          },
          nombreChercheurs: { $size: '$chercheurs_ids' },
          chercheurs_ids: 1, 
          totalStages: 1,
          stagesAccepte: 1,
          stagesRefuse: 1
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: repartition.length > 0 ? repartition : []
    });

  } catch (error) {
    console.error("Erreur dans repartitionChercheursParEtablissementSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};




export const nombreStageRecherchesEnCoursSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    try {
        const dateDebutFilter = dateDebut ? new Date(dateDebut) : undefined;
        const dateFinFilter = dateFin ? new Date(dateFin) : undefined;
        const now = new Date();

        const matchStageRecherche = {
            dateDebut: { $lte: now },
            dateFin: { $gte: now }
        };

        // Ajouter les filtres de période si fournis
        if (dateDebutFilter) {
            matchStageRecherche.dateDebut.$lte = dateFinFilter || now;
        }
        if (dateFinFilter) {
            matchStageRecherche.dateFin.$gte = dateDebutFilter || now;
        }

        const result = await Rotation.aggregate([
            { $match: matchStageRecherche },
            { $count: 'total' }
        ]);

        const totalStageRecherchesEnCours = result[0]?.total || 0;

        return res.status(200).json({
            success: true,
            totalStageRecherchesEnCours: totalStageRecherchesEnCours
        });
    } catch (error) {
        console.error("Erreur dans nombreStageRecherchesEnCoursSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};
