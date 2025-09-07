import Stage from '../models/Stage.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Stagiaire from '../models/Stagiaire.js';
import { sendStageNotificationEmail } from '../utils/sendMailNotificatonStage.js';
import { Groupe } from '../models/Groupe.js';
import { Rotation } from '../models/Rotation.js';
import { AffectationFinale } from '../models/AffectationFinale.js';
import mongoose from 'mongoose';

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

export const createStage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const {
        nomFr,
        nomEn,
        type,
        stagiaire,
        groupes,
        rotations,
        affectationsFinales,
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

    if (type === 'INDIVIDUEL') {
        if (!stagiaire){
            return res.status(400).json({
                success: false,
                message: t('stagiaire_obligatoire', lang),
            });
        }
        if (groupes && groupes.length > 0){
            return res.status(400).json({
                success: false,
                message: t('groupe_non_autorise', lang),
            });
        } 
    } else if (type === 'GROUPE') {
        if (!groupes || !Array.isArray(groupes) || groupes.length === 0){
            return res.status(400).json({
                success: false,
                message: t('groupe_obligatoire', lang),
            });
        }
        if (stagiaire){
            return res.status(400).json({
                success: false,
                message: t('stagiaire_non_autorise', lang),
            });
        } 
    } else {
        return res.status(400).json({
            success: false,
            message: t('invalide_type_stage', lang),
        });
    }

    if (groupes) {
        const stagiaireIds = new Set();
        for (const grp of groupes) {
            if (!grp.numero){
                return res.status(400).json({
                    success: false,
                    message: t('numero_groupe', lang),
                });
            } 
            if (!grp.stagiaires || !Array.isArray(grp.stagiaires)){
                return res.status(400).json({
                    success: false,
                    message: t('groupe_tableau_stagiaire', lang),
                });
            }
            
            grp.stagiaires.forEach(id => {
                if (stagiaireIds.has(id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('stagiaire_plusieurs_groupes', lang),
                    });
                }
                stagiaireIds.add(id);
            });
        }
    }

    if (rotations) {
        if (!Array.isArray(rotations)){
            return res.status(400).json({
                success: false,
                message: t('rotation_tableau', lang),
            });
        } 
        rotations.forEach((rot, idx) => {
            if (!rot.service || !rot.superviseur || !rot.dateDebut || !rot.dateFin)
                throw new Error(`Rotation #${idx + 1}: service, superviseur, dateDebut et dateFin obligatoires`);
            if (!isValidDateRange(rot.dateDebut, rot.dateFin))
                throw new Error(`Rotation #${idx + 1}: dateDebut doit être ≤ dateFin`);
            if (rot.stagiaire && rot.groupe)
                throw new Error(`Rotation #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
            if (!rot.stagiaire && !rot.groupe)
             throw new Error(`Rotation #${idx + 1}: stagiaire ou groupe doit être défini`);
        });

        if (checkOverlaps(rotations, 'stagiaire')){
            return res.status(400).json({
                success: false,
                message: t('conflit_chevauchement_rotation_stagiaire', lang),
            });
        }
        if (checkOverlaps(rotations, 'groupe')){
            return res.status(400).json({
                success: false,
                message: t('conflit_chevauchement_rotation_groupe', lang),
            });
        }
    }

    if (affectationsFinales) {
      if (!Array.isArray(affectationsFinales)) throw new Error('affectationsFinales doit être un tableau');
      affectationsFinales.forEach((aff, idx) => {
        if (!aff.service || !aff.dateDebut || !aff.dateFin)
          throw new Error(`Affectation finale #${idx + 1}: service, dateDebut et dateFin obligatoires`);
        if (!isValidDateRange(aff.dateDebut, aff.dateFin))
          throw new Error(`Affectation finale #${idx + 1}: dateDebut doit être ≤ dateFin`);
        if (aff.stagiaire && aff.groupe)
          throw new Error(`Affectation finale #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
        if (!aff.stagiaire && !aff.groupe)
          throw new Error(`Affectation finale #${idx + 1}: stagiaire ou groupe doit être défini`);
      });

      if (checkOverlaps(affectationsFinales, 'stagiaire'))
        throw new Error('Conflit de chevauchement détecté dans affectations finales (même stagiaire)');
      if (checkOverlaps(affectationsFinales, 'groupe'))
        throw new Error('Conflit de chevauchement détecté dans affectations finales (même groupe)');
    }

    // Création du stage
    const stage = new Stage({ nomFr, nomEn, type, stagiaire, dateDebut, dateFin, anneeStage, statut });
    await stage.save({ session });

    // Map pour associer numéro de groupe -> ObjectId
    const groupeMapping = new Map();

    if (type === 'GROUPE') {
      const groupesIds = [];
      for (const grp of groupes) {
        const groupeDoc = new Groupe({
          stage: stage._id,
          numero: grp.numero,
          stagiaires: grp.stagiaires || []
        });
        await groupeDoc.save({ session });
        groupesIds.push(groupeDoc._id);
        
        // Créer le mapping : numéro -> ObjectId
        groupeMapping.set(grp.numero, groupeDoc._id);
      }
      stage.groupes = groupesIds;
      await stage.save({ session });
    }

    // Création des rotations avec les bons ObjectIds
    if (rotations) {
      for (const rot of rotations) {
        let groupeObjectId = null;
        
        // Si la rotation concerne un groupe, récupérer son ObjectId
        if (rot.groupe) {
          groupeObjectId = groupeMapping.get(rot.groupe);
          if (!groupeObjectId) {
            throw new Error(`Groupe ${rot.groupe} introuvable pour la rotation`);
          }
        }

        const rotationDoc = new Rotation({
          stage: stage._id,
          service: rot.service,
          superviseur: rot.superviseur,
          dateDebut: rot.dateDebut,
          dateFin: rot.dateFin,
          stagiaire: rot.stagiaire || null,
          groupe: groupeObjectId // Utiliser l'ObjectId au lieu du numéro
        });
        await rotationDoc.save({ session });
      }
    }

    // Création des affectations finales avec les bons ObjectIds
    if (affectationsFinales) {
      for (const aff of affectationsFinales) {
        let groupeObjectId = null;
        
        // Si l'affectation concerne un groupe, récupérer son ObjectId
        if (aff.groupe) {
          groupeObjectId = groupeMapping.get(aff.groupe);
          if (!groupeObjectId) {
            throw new Error(`Groupe ${aff.groupe} introuvable pour l'affectation finale`);
          }
        }

        const affDoc = new AffectationFinale({
          stage: stage._id,
          service: aff.service,
          superviseur: aff.superviseur || null,
          stagiaire: aff.stagiaire || null,
          groupe: groupeObjectId, // Utiliser l'ObjectId au lieu du numéro
          dateDebut: aff.dateDebut,
          dateFin: aff.dateFin
        });
        await affDoc.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Envoi mail notification
    if (type === 'INDIVIDUEL') {
      const stagiaireDoc = await Stagiaire.findById(stagiaire);
      if (stagiaireDoc && stagiaireDoc.email) {
        sendStageNotificationEmail(
          stagiaireDoc.email,
          lang,
          stagiaireDoc.nom,
          stagiaireDoc.prenom
        );
      }
    } else if (type === 'GROUPE') {
      // Charge tous les stagiaires des groupes et envoie mail à chacun
      const groupesDocs = await Groupe.find({ stage: stage._id }).populate('stagiaires');
      for (const groupe of groupesDocs) {
        for (const stagiaireDoc of groupe.stagiaires) {
          if (stagiaireDoc.email) {
            sendStageNotificationEmail(
              stagiaireDoc.email,
              lang,
              stagiaireDoc.nom,
              stagiaireDoc.prenom
            );
          }
        }
      }
    }

    return res.status(201).json({
        success: true,
        message: t('ajouter_succes', lang),
        data: stage,
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

export const getStageByIdAndType = async (req, res) => {
  try {
    const { id, type } = req.params;

    // Validation des paramètres
    if (!id || !type) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID du stage et le type sont requis en tant que query parameters'
      });
    }

    // Validation du type
    const validTypes = ['INDIVIDUEL', 'GROUPE'];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Type de stage invalide. Les types acceptés sont: INDIVIDUEL, GROUPE'
      });
    }

    // Utilisation de la même logique que la fonction principale avec select limité
    let query = Stage.findById(id)
      .where('type').equals(type.toUpperCase())
      .select('_id nomFr nomEn dateDebut dateFin stagiaire groupes'); // Sélection limitée des champs

    if (type.toUpperCase() === 'INDIVIDUEL') {
      query = query.populate({
        path: 'stagiaire',
        select: 'nom prenom'
      });
    } else {
      query = query.populate({
        path: 'groupes',
        populate: {
          path: 'stagiaires',
          model: 'Stagiaire',
          select: 'nom prenom'
        }
      });
    }

    const stage = await query.exec();

    if (!stage) {
      return res.status(404).json({
        success: false,
        message: `Aucun stage de type ${type} trouvé avec l'ID ${id}`
      });
    }

    // Récupération des rotations associées au stage
    const rotations = await Rotation.find({ stage: id })
      .populate('service', 'nomEn nomFr')
      .populate('superviseur', 'nom prenom')
      .populate('stagiaire', 'nom prenom')
      .populate({
        path: 'groupe',
        populate: {
          path: 'stagiaires',
          model: 'Stagiaire',
          select: 'nom prenom'
        }
      });

    // Récupération des affectations finales associées au stage
    const affectationsFinales = await AffectationFinale.find({ stage: id })
      .populate('service', 'nomEn nomFr')
      .populate('superviseur', 'nom prenom')
      .populate('stagiaire', 'nom prenom')
      .populate({
        path: 'groupe',
        populate: {
          path: 'stagiaires',
          model: 'Stagiaire',
          select: 'nom prenom'
        }
      });

    res.status(200).json({
      success: true,
      data: {
        _id: stage._id,
        nomFr:stage.nomFr,
        nomEn:stage.nomEn,
        dateDebut: stage.dateDebut,
        dateFin: stage.dateFin,
        stagiaire: stage.stagiaire || null,
        groupes: stage.groupes || [],
        rotations,
        affectationsFinales,
        metadata: {
          type: type.toUpperCase(),
          nombreParticipants: type.toUpperCase() === 'INDIVIDUEL' 
            ? 1 
            : stage.groupes?.reduce((total, groupe) => total + (groupe.stagiaires?.length || 0), 0) || 0,
          dureeEnJours: Math.ceil((new Date(stage.dateFin) - new Date(stage.dateDebut)) / (1000 * 60 * 60 * 24)),
          nombreRotations: rotations.length,
          nombreAffectationsFinales: affectationsFinales.length
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du stage:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Format d\'ID invalide'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la récupération du stage'
    });
  }
};

// Update partiel (attention, si modification groupes/rotations, gérer avec prudence)
// export const updateStage = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   const lang = req.headers['accept-language'] || 'fr';
//   const { id } = req.params;

//   try {
//     const {
//         nomFr,
//         nomEn,
//         type,
//         stagiaire,
//         groupes,
//         rotations,
//         affectationsFinales,
//         dateDebut,
//         dateFin,
//         anneeStage,
//         statut
//     } = req.body;

//     // Vérifier que le stage existe
//     const existingStage = await Stage.findById(id);
//     if (!existingStage) {
//         return res.status(404).json({
//             success: false,
//             message: t('stage_introuvable', lang),
//         });
//     }

//     // Validation des champs
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             message: t('champs_obligatoires', lang),
//             errors: errors.array().map(err => err.msg),
//         });
//     }

//     if (!isValidDateRange(dateDebut, dateFin)) {
//         return res.status(400).json({
//             success: false,
//             message: t('date_debut_anterieur_date_fin', lang),
//         });
//     }

//     // Validation du type et des participants
//     if (type === 'INDIVIDUEL') {
//         if (!stagiaire){
//             return res.status(400).json({
//                 success: false,
//                 message: t('stagiaire_obligatoire', lang),
//             });
//         }
//         if (groupes && groupes.length > 0){
//             return res.status(400).json({
//                 success: false,
//                 message: t('groupe_non_autorise', lang),
//             });
//         } 
//     } else if (type === 'GROUPE') {
//         if (!groupes || !Array.isArray(groupes) || groupes.length === 0){
//             return res.status(400).json({
//                 success: false,
//                 message: t('groupe_obligatoire', lang),
//             });
//         }
//         if (stagiaire){
//             return res.status(400).json({
//                 success: false,
//                 message: t('stagiaire_non_autorise', lang),
//             });
//         } 
//     } else {
//         return res.status(400).json({
//             success: false,
//             message: t('invalide_type_stage', lang),
//         });
//     }

//     // Validation des groupes (éviter les doublons de stagiaires)
//     if (groupes) {
//         const stagiaireIds = new Set();
//         for (const grp of groupes) {
//             if (!grp.numero){
//                 return res.status(400).json({
//                     success: false,
//                     message: t('numero_groupe', lang),
//                 });
//             } 
//             if (!grp.stagiaires || !Array.isArray(grp.stagiaires)){
//                 return res.status(400).json({
//                     success: false,
//                     message: t('groupe_tableau_stagiaire', lang),
//                 });
//             }
            
//             for (const stagiaireId of grp.stagiaires) {
//                 if (stagiaireIds.has(stagiaireId)) {
//                     return res.status(400).json({
//                         success: false,
//                         message: t('stagiaire_plusieurs_groupes', lang),
//                     });
//                 }
//                 stagiaireIds.add(stagiaireId);
//             }
//         }
//     }

//     // Validation des rotations
//     if (rotations) {
//         if (!Array.isArray(rotations)){
//             return res.status(400).json({
//                 success: false,
//                 message: t('rotation_tableau', lang),
//             });
//         } 
//         rotations.forEach((rot, idx) => {
//             if (!rot.service || !rot.superviseur || !rot.dateDebut || !rot.dateFin)
//                 throw new Error(`Rotation #${idx + 1}: service, superviseur, dateDebut et dateFin obligatoires`);
//             if (!isValidDateRange(rot.dateDebut, rot.dateFin))
//                 throw new Error(`Rotation #${idx + 1}: dateDebut doit être ≤ dateFin`);
//             if (rot.stagiaire && rot.groupe)
//                 throw new Error(`Rotation #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
//             if (!rot.stagiaire && !rot.groupe)
//              throw new Error(`Rotation #${idx + 1}: stagiaire ou groupe doit être défini`);
//         });

//         if (checkOverlaps(rotations, 'stagiaire')){
//             return res.status(400).json({
//                 success: false,
//                 message: t('conflit_chevauchement_rotation_stagiaire', lang),
//             });
//         }
//         if (checkOverlaps(rotations, 'groupe')){
//             return res.status(400).json({
//                 success: false,
//                 message: t('conflit_chevauchement_rotation_groupe', lang),
//             });
//         }
//     }

//     // Validation des affectations finales
//     if (affectationsFinales) {
//       if (!Array.isArray(affectationsFinales)) {
//         return res.status(400).json({
//             success: false,
//             message: t('affectation_finale_tableau', lang),
//         });
//       }
      
//       affectationsFinales.forEach((aff, idx) => {
//         if (!aff.service || !aff.dateDebut || !aff.dateFin)
//           throw new Error(`Affectation finale #${idx + 1}: service, dateDebut et dateFin obligatoires`);
//         if (!isValidDateRange(aff.dateDebut, aff.dateFin))
//           throw new Error(`Affectation finale #${idx + 1}: dateDebut doit être ≤ dateFin`);
//         if (aff.stagiaire && aff.groupe)
//           throw new Error(`Affectation finale #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
//         if (!aff.stagiaire && !aff.groupe)
//           throw new Error(`Affectation finale #${idx + 1}: stagiaire ou groupe doit être défini`);
//       });

//       if (checkOverlaps(affectationsFinales, 'stagiaire')) {
//         return res.status(400).json({
//             success: false,
//             message: t('conflit_chevauchement_affectation_stagiaire', lang),
//         });
//       }
//       if (checkOverlaps(affectationsFinales, 'groupe')) {
//         return res.status(400).json({
//             success: false,
//             message: t('conflit_chevauchement_affectation_groupe', lang),
//         });
//       }
//     }

//     // Supprimer les anciennes données liées au stage
//     await Groupe.deleteMany({ stage: id }, { session });
//     await Rotation.deleteMany({ stage: id }, { session });
//     await AffectationFinale.deleteMany({ stage: id }, { session });

//     // Mise à jour du stage principal
//     const updatedStage = await Stage.findByIdAndUpdate(
//         id,
//         {
//             nomFr,
//             nomEn,
//             type,
//             stagiaire: type === 'INDIVIDUEL' ? stagiaire : null,
//             groupes: [], // Sera mis à jour après création des groupes
//             dateDebut,
//             dateFin,
//             anneeStage,
//             statut
//         },
//         { 
//             new: true, 
//             session,
//             runValidators: true 
//         }
//     );

//     // Recréer les groupes si type GROUPE
//     if (type === 'GROUPE' && groupes) {
//       const groupesIds = [];
//       for (const grp of groupes) {
//         const groupeDoc = new Groupe({
//           stage: updatedStage._id,
//           numero: grp.numero,
//           stagiaires: grp.stagiaires || []
//         });
//         await groupeDoc.save({ session });
//         groupesIds.push(groupeDoc._id);
//       }
//       updatedStage.groupes = groupesIds;
//       await updatedStage.save({ session });
//     }

//     // Recréer les rotations
//     if (rotations) {
//       for (const rot of rotations) {
//         const rotationDoc = new Rotation({
//           stage: updatedStage._id,
//           service: rot.service,
//           superviseur: rot.superviseur,
//           dateDebut: rot.dateDebut,
//           dateFin: rot.dateFin,
//           stagiaire: rot.stagiaire || null,
//           groupe: rot.groupe || null
//         });
//         await rotationDoc.save({ session });
//       }
//     }

//     // Recréer les affectations finales
//     if (affectationsFinales) {
//       for (const aff of affectationsFinales) {
//         // // Vérifier les conflits pour les affectations finales
//         // const conflicts = await AffectationFinale.checkConflicts({
//         //   stagiaire: aff.stagiaire,
//         //   groupe: aff.groupe,
//         //   service: aff.service,
//         //   dateDebut: aff.dateDebut,
//         //   dateFin: aff.dateFin
//         // });

//         // if (conflicts.length > 0) {
//         //   throw new Error(`Conflit détecté pour l'affectation finale dans le service ${aff.service}`);
//         // }

//         const affDoc = new AffectationFinale({
//           stage: updatedStage._id,
//           service: aff.service,
//           superviseur: aff.superviseur || null,
//           stagiaire: aff.stagiaire || null,
//           groupe: aff.groupe || null,
//           dateDebut: aff.dateDebut,
//           dateFin: aff.dateFin
//         });
//         await affDoc.save({ session });
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();

//     // Récupérer le stage complet avec toutes les relations
//     const stageComplet = await Stage.findById(updatedStage._id)
//       .populate('stagiaire')
//       .populate({
//         path: 'groupes',
//         populate: {
//           path: 'stagiaires'
//         }
//       });

//     return res.status(200).json({
//         success: true,
//         message: t('modifier_succes', lang),
//         data: stageComplet,
//     });

//   } catch (err) {
//     console.error('Erreur lors de la modification du stage:', err);
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(500).json({
//         success: false,
//         message: t('erreur_serveur', lang),
//         error: process.env.NODE_ENV === 'development' ? err.message : undefined,
//     });
//   }
// };

export const updateStage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const stageId = req.params.stageId;
    const {
        nomFr,
        nomEn,
        type,
        stagiaire,
        groupes,
        rotations,
        affectationsFinales,
        dateDebut,
        dateFin,
        anneeStage,
        statut
    } = req.body;

    // Vérifier que le stage existe
    const existingStage = await Stage.findById(stageId);
    if (!existingStage) {
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

    if (type === 'INDIVIDUEL') {
        if (!stagiaire){
            return res.status(400).json({
                success: false,
                message: t('stagiaire_obligatoire', lang),
            });
        }
        if (groupes && groupes.length > 0){
            return res.status(400).json({
                success: false,
                message: t('groupe_non_autorise', lang),
            });
        } 
    } else if (type === 'GROUPE') {
        if (!groupes || !Array.isArray(groupes) || groupes.length === 0){
            return res.status(400).json({
                success: false,
                message: t('groupe_obligatoire', lang),
            });
        }
        if (stagiaire){
            return res.status(400).json({
                success: false,
                message: t('stagiaire_non_autorise', lang),
            });
        } 
    } else {
        return res.status(400).json({
            success: false,
            message: t('invalide_type_stage', lang),
        });
    }

    if (groupes) {
        const stagiaireIds = new Set();
        for (const grp of groupes) {
            if (!grp.numero){
                return res.status(400).json({
                    success: false,
                    message: t('numero_groupe', lang),
                });
            } 
            if (!grp.stagiaires || !Array.isArray(grp.stagiaires)){
                return res.status(400).json({
                    success: false,
                    message: t('groupe_tableau_stagiaire', lang),
                });
            }
            
            grp.stagiaires.forEach(id => {
                if (stagiaireIds.has(id)) {
                    return res.status(400).json({
                        success: false,
                        message: t('stagiaire_plusieurs_groupes', lang),
                    });
                }
                stagiaireIds.add(id);
            });
        }
    }

    if (rotations) {
        if (!Array.isArray(rotations)){
            return res.status(400).json({
                success: false,
                message: t('rotation_tableau', lang),
            });
        } 
        rotations.forEach((rot, idx) => {
            if (!rot.service || !rot.superviseur || !rot.dateDebut || !rot.dateFin)
                throw new Error(`Rotation #${idx + 1}: service, superviseur, dateDebut et dateFin obligatoires`);
            if (!isValidDateRange(rot.dateDebut, rot.dateFin))
                throw new Error(`Rotation #${idx + 1}: dateDebut doit être ≤ dateFin`);
            if (rot.stagiaire && rot.groupe)
                throw new Error(`Rotation #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
            if (!rot.stagiaire && !rot.groupe)
             throw new Error(`Rotation #${idx + 1}: stagiaire ou groupe doit être défini`);
        });

        if (checkOverlaps(rotations, 'stagiaire')){
            return res.status(400).json({
                success: false,
                message: t('conflit_chevauchement_rotation_stagiaire', lang),
            });
        }
        if (checkOverlaps(rotations, 'groupe')){
            return res.status(400).json({
                success: false,
                message: t('conflit_chevauchement_rotation_groupe', lang),
            });
        }
    }

    if (affectationsFinales) {
      if (!Array.isArray(affectationsFinales)) throw new Error('affectationsFinales doit être un tableau');
      affectationsFinales.forEach((aff, idx) => {
        if (!aff.service || !aff.dateDebut || !aff.dateFin)
          throw new Error(`Affectation finale #${idx + 1}: service, dateDebut et dateFin obligatoires`);
        if (!isValidDateRange(aff.dateDebut, aff.dateFin))
          throw new Error(`Affectation finale #${idx + 1}: dateDebut doit être ≤ dateFin`);
        if (aff.stagiaire && aff.groupe)
          throw new Error(`Affectation finale #${idx + 1}: Uniquement stagiaire ou groupe doit être défini`);
        if (!aff.stagiaire && !aff.groupe)
          throw new Error(`Affectation finale #${idx + 1}: stagiaire ou groupe doit être défini`);
      });

      if (checkOverlaps(affectationsFinales, 'stagiaire'))
        throw new Error('Conflit de chevauchement détecté dans affectations finales (même stagiaire)');
      if (checkOverlaps(affectationsFinales, 'groupe'))
        throw new Error('Conflit de chevauchement détecté dans affectations finales (même groupe)');
    }

    // SUPPRESSION DES DONNÉES EXISTANTES
    
    // Supprimer les anciens groupes
    await Groupe.deleteMany({ stage: stageId }, { session });
    
    // Supprimer les anciennes rotations
    await Rotation.deleteMany({ stage: stageId }, { session });
    
    // Supprimer les anciennes affectations finales
    await AffectationFinale.deleteMany({ stage: stageId }, { session });

    // MISE À JOUR DU STAGE
    const updatedStage = await Stage.findByIdAndUpdate(
      stageId,
      { 
        nomFr, 
        nomEn, 
        type, 
        stagiaire: type === 'INDIVIDUEL' ? stagiaire : null,
        dateDebut, 
        dateFin, 
        anneeStage, 
        statut,
        groupes: [] // Sera mis à jour plus bas si nécessaire
      },
      { new: true, session }
    );

    // RECRÉATION DES NOUVELLES DONNÉES
    
    // Map pour associer numéro de groupe -> ObjectId
    const groupeMapping = new Map();

    if (type === 'GROUPE') {
      const groupesIds = [];
      for (const grp of groupes) {
        const groupeDoc = new Groupe({
          stage: stageId,
          numero: grp.numero,
          stagiaires: grp.stagiaires || []
        });
        await groupeDoc.save({ session });
        groupesIds.push(groupeDoc._id);
        
        // Créer le mapping : numéro -> ObjectId
        groupeMapping.set(grp.numero, groupeDoc._id);
      }
      
      // Mettre à jour le stage avec les nouveaux groupes
      updatedStage.groupes = groupesIds;
      await updatedStage.save({ session });
    }

    // Création des nouvelles rotations avec les bons ObjectIds
    if (rotations) {
      for (const rot of rotations) {
        let groupeObjectId = null;
        
        // Si la rotation concerne un groupe, récupérer son ObjectId
        if (rot.groupe) {
          groupeObjectId = groupeMapping.get(rot.groupe);
          if (!groupeObjectId) {
            throw new Error(`Groupe ${rot.groupe} introuvable pour la rotation`);
          }
        }

        const rotationDoc = new Rotation({
          stage: stageId,
          service: rot.service,
          superviseur: rot.superviseur,
          dateDebut: rot.dateDebut,
          dateFin: rot.dateFin,
          stagiaire: rot.stagiaire || null,
          groupe: groupeObjectId // Utiliser l'ObjectId au lieu du numéro
        });
        await rotationDoc.save({ session });
      }
    }

    // Création des nouvelles affectations finales avec les bons ObjectIds
    if (affectationsFinales) {
      for (const aff of affectationsFinales) {
        let groupeObjectId = null;
        
        // Si l'affectation concerne un groupe, récupérer son ObjectId
        if (aff.groupe) {
          groupeObjectId = groupeMapping.get(aff.groupe);
          if (!groupeObjectId) {
            throw new Error(`Groupe ${aff.groupe} introuvable pour l'affectation finale`);
          }
        }

        const affDoc = new AffectationFinale({
          stage: stageId,
          service: aff.service,
          superviseur: aff.superviseur || null,
          stagiaire: aff.stagiaire || null,
          groupe: groupeObjectId, // Utiliser l'ObjectId au lieu du numéro
          dateDebut: aff.dateDebut,
          dateFin: aff.dateFin
        });
        await affDoc.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Envoi mail notification (optionnel pour les modifications)
    // Vous pouvez commenter cette section si vous ne voulez pas d'emails lors des modifications
    /*
    if (type === 'INDIVIDUEL') {
      const stagiaireDoc = await Stagiaire.findById(stagiaire);
      if (stagiaireDoc && stagiaireDoc.email) {
        sendStageUpdateNotificationEmail(
          stagiaireDoc.email,
          lang,
          stagiaireDoc.nom,
          stagiaireDoc.prenom
        );
      }
    } else if (type === 'GROUPE') {
      // Charge tous les stagiaires des groupes et envoie mail à chacun
      const groupesDocs = await Groupe.find({ stage: stageId }).populate('stagiaires');
      for (const groupe of groupesDocs) {
        for (const stagiaireDoc of groupe.stagiaires) {
          if (stagiaireDoc.email) {
            sendStageUpdateNotificationEmail(
              stagiaireDoc.email,
              lang,
              stagiaireDoc.nom,
              stagiaireDoc.prenom
            );
          }
        }
      }
    }
    */

    return res.status(200).json({
        success: true,
        message: t('modifier_succes', lang),
        data: updatedStage,
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

export const deleteStage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    try {
        const stage = await Stage.findByIdAndDelete(id);
        if (!stage) {
            return res.status(404).json({ 
                success: false, 
                message: t('stage_non_trouve', lang) 
            });
        }
        // Supprimer groupes, rotations, affectations liés ?
        await Groupe.deleteMany({ stage: stage._id });
        await Rotation.deleteMany({ stage: stage._id });
        await AffectationFinale.deleteMany({ stage: stage._id });

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

export const updateGroupe = async (req, res) => {
  try {
    const groupe = await Groupe.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!groupe) return res.status(404).json({ success: false, message: 'Groupe non trouvé' });
    res.json({ success: true, data: groupe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteGroupe = async (req, res) => {
  try {
    const groupe = await Groupe.findByIdAndDelete(req.params.id);
    if (!groupe) return res.status(404).json({ success: false, message: 'Groupe non trouvé' });
    res.json({ success: true, message: 'Groupe supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGroupesByStage = async (req, res) => {
  try {
    const groupes = await Groupe.find({ stage: req.params.stageId }).populate('stagiaires');
    res.json({ success: true, data: groupes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGroupeById = async (req, res) => {
  try {
    const groupe = await Groupe.findById(req.params.id).populate('stagiaires');
    if (!groupe) return res.status(404).json({ success: false, message: 'Groupe non trouvé' });
    res.json({ success: true, data: groupe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRotationsByStage = async (req, res) => {
  try {
    const rotations = await Rotation.find({ stage: req.params.stageId })
      .populate('service superviseur stagiaire groupe');
    res.json({ success: true, data: rotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRotationById = async (req, res) => {
  try {
    const rotation = await Rotation.findById(req.params.id)
      .populate('service superviseur stagiaire groupe');
    if (!rotation) return res.status(404).json({ success: false, message: 'Rotation non trouvée' });
    res.json({ success: true, data: rotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRotation = async (req, res) => {
  try {
    const rotation = await Rotation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rotation) return res.status(404).json({ success: false, message: 'Rotation non trouvée' });
    res.json({ success: true, data: rotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteRotation = async (req, res) => {
  try {
    const rotation = await Rotation.findByIdAndDelete(req.params.id);
    if (!rotation) return res.status(404).json({ success: false, message: 'Rotation non trouvée' });
    res.json({ success: true, message: 'Rotation supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAffectationsByStage = async (req, res) => {
  try {
    const affectations = await AffectationFinale.find({ stage: req.params.stageId })
      .populate('service superviseur stagiaire groupe');
    res.json({ success: true, data: affectations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAffectationById = async (req, res) => {
  try {
    const aff = await AffectationFinale.findById(req.params.id)
      .populate('service superviseur stagiaire groupe');
    if (!aff) return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    res.json({ success: true, data: aff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAffectation = async (req, res) => {
  try {
    const aff = await AffectationFinale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!aff) return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    res.json({ success: true, data: aff });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAffectation = async (req, res) => {
  try {
    const aff = await AffectationFinale.findByIdAndDelete(req.params.id);
    if (!aff) return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    res.json({ success: true, message: 'Affectation supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


//Liste des stages
export const listeStages = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        type = '', 
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

        // Filtre par type
        if (type && type !== 'ALL') {
            matchFilters.type = type;
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
                    from: 'stagiaires', // Collection des stagiaires
                    localField: 'stagiaire',
                    foreignField: '_id',
                    as: 'stagiaireInfo',
                },
            },
            {
                $lookup: {
                    from: 'groupes', // Collection des groupes
                    localField: 'groupes',
                    foreignField: '_id',
                    as: 'groupesInfo',
                },
            },
            {
                $lookup: {
                    from: 'rotations', // Collection des rotations
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'rotations',
                },
            },
            {
                $lookup: {
                    from: 'affectationfinales', // Collection des affectations finales
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'affectations',
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
                    // Nombre de stagiaires selon le type
                    nombreStagiaires: {
                        $cond: [
                            { $eq: ['$type', 'INDIVIDUEL'] },
                            { $cond: [{ $ne: ['$stagiaire', null] }, 1, 0] },
                            {
                                $reduce: {
                                    input: '$groupesInfo',
                                    initialValue: 0,
                                    in: { $add: ['$$value', { $size: { $ifNull: ['$$this.stagiaires', []] } }] }
                                }
                            }
                        ]
                    },
                    nombreGroupes: { $size: '$groupesInfo' },
                    // Dates basées sur les rotations ou affectations
                    dateDebutCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $min: '$rotations.dateDebut' },
                            {
                                $cond: [
                                    { $gt: [{ $size: '$affectations' }, 0] },
                                    { $min: '$affectations.dateDebut' },
                                    '$dateDebut'
                                ]
                            }
                        ]
                    },
                    dateFinCalculee: {
                        $cond: [
                            { $gt: [{ $size: '$rotations' }, 0] },
                            { $max: '$rotations.dateFin' },
                            {
                                $cond: [
                                    { $gt: [{ $size: '$affectations' }, 0] },
                                    { $max: '$affectations.dateFin' },
                                    '$dateFin'
                                ]
                            }
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
                    type: 1,
                    nombreStagiaires: 1,
                    nombreGroupes: 1,
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
        const stages = await Stage.aggregate(pipeline);

        // Compter le total avec les mêmes filtres
        const totalPipeline = [
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),
            { $count: "total" }
        ];
        
        const totalResult = await Stage.aggregate(totalPipeline);
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return res.status(200).json({
            success: true,
            data: {
                stages,
                totalItems: total,
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
                hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
                hasPrevPage: parseInt(page) > 1,
                // Informations de filtrage
                filters: {
                    search: search || '',
                    type: type || 'ALL',
                    statut: statut || 'ALL'
                }
            },
        });
    } catch (error) {
        console.error('Erreur dans listeStages:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

//Liste des stages par établissement
export const listeStagesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { etablissementId } = req.params;

    try {
        const stagesIndividuels = await Stage.find({
            typeStage: 'INDIVIDUEL',
            'stages.stagiaire.etablissement': etablissementId,
        }).populate('stages.stagiaire', 'nom prenom etablissement');

        const groupes = await Groupe.find({
            'stages.etablissement': etablissementId,
        }).populate('stages', 'nom prenom etablissement');

        return res.status(200).json({
            success: true,
            message: t('liste_stages_succes', lang),
            data: {
                stagesIndividuels,
                groupes,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



export const calendrierRotations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        // Récupérer les rotations avec leurs groupes et services
        const rotations = await Rotation.find()
            .populate('groupe', 'numero')
            .populate('service', 'nomFr nomEn structure')
            .sort({ dateDebut: 1 });

        // Récupérer les stages finaux pour chaque groupe
        const stagesFinaux = await Groupe.find()
            .populate('serviceFinal.service', 'nomFr nomEn structure')
            .populate('numero', 'numero');

        // Construire le calendrier
        const calendrier = {};

        // Ajouter les rotations
        rotations.forEach((rotation) => {
            const groupe = `Groupe ${rotation.groupe.numero}`;
            const service = {
                nomFr: rotation.service.nomFr,
                nomEn: rotation.service.nomEn,
                structure: rotation.service.structure,
            };
            const periode = `${rotation.dateDebut.toISOString()} - ${rotation.dateFin.toISOString()}`;

            if (!calendrier[groupe]) calendrier[groupe] = {};
            if (!calendrier[groupe][service.nomFr]) calendrier[groupe][service.nomFr] = [];

            calendrier[groupe][service.nomFr].push(periode);
        });

        // Ajouter les stages finaux
        stagesFinaux.forEach((groupe) => {
            const groupeKey = `Groupe ${groupe.numero}`;
            const service = groupe.serviceFinal.service;

            if (service) {
                const serviceDetails = {
                    nomFr: service.nomFr,
                    nomEn: service.nomEn,
                    structure: service.structure,
                };
                const periode = 'Stage final';

                if (!calendrier[groupeKey]) calendrier[groupeKey] = {};
                if (!calendrier[groupeKey][serviceDetails.nomFr]) calendrier[groupeKey][serviceDetails.nomFr] = [];

                calendrier[groupeKey][serviceDetails.nomFr].push(periode);
            }
        });

        return res.status(200).json({
            success: true,
            calendrier,
        });
    } catch (error) {
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
export const nombreStagesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);
        
        // Pipeline pour stages individuels
        const stagesIndividuels = await Stage.aggregate([
            { $match: { type: 'INDIVIDUEL', ...filters } },
            {
                $lookup: {
                    from: 'stagiaires',
                    localField: 'stagiaire',
                    foreignField: '_id',
                    as: 'stagiaireInfo'
                }
            },
            { $unwind: '$stagiaireInfo' },
            { $unwind: '$stagiaireInfo.parcours' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'stagiaireInfo.parcours.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: '$etablissement._id',
                    etablissement: { $first: '$etablissement' },
                    nombreStages: { $sum: 1 }
                }
            }
        ]);

        // Pipeline pour stages en groupe
        const stagesGroupes = await Stage.aggregate([
            { $match: { type: 'GROUPE', ...filters } },
            { $unwind: '$groupes' },
            {
                $lookup: {
                    from: 'groupes',
                    localField: 'groupes',
                    foreignField: '_id',
                    as: 'groupeInfo'
                }
            },
            { $unwind: '$groupeInfo' },
            { $unwind: '$groupeInfo.stagiaires' },
            {
                $lookup: {
                    from: 'stagiaires',
                    localField: 'groupeInfo.stagiaires',
                    foreignField: '_id',
                    as: 'stagiaireInfo'
                }
            },
            { $unwind: '$stagiaireInfo' },
            { $unwind: '$stagiaireInfo.parcours' },
            {
                $lookup: {
                    from: 'etablissements',
                    localField: 'stagiaireInfo.parcours.etablissement',
                    foreignField: '_id',
                    as: 'etablissement'
                }
            },
            { $unwind: '$etablissement' },
            {
                $group: {
                    _id: '$etablissement._id',
                    etablissement: { $first: '$etablissement' },
                    nombreStages: { $sum: 1 }
                }
            }
        ]);

        // Fusion des résultats
        const etablissementMap = new Map();
        
        [...stagesIndividuels, ...stagesGroupes].forEach(item => {
            const idStr = item._id.toString();
            if (etablissementMap.has(idStr)) {
                etablissementMap.get(idStr).nombreStages += item.nombreStages;
            } else {
                etablissementMap.set(idStr, {
                    _id: item._id,
                    etablissement: item.etablissement,
                    nombreStages: item.nombreStages
                });
            }
        });

        const result = Array.from(etablissementMap.values());

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Erreur nombreStagesParEtablissement:', error);
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
export const nombreStagesParStatutEtEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const filters = buildFilters(req.query);

        const pipeline = [
            { $match: filters },
            {
                $facet: {
                    individuels: [
                        { $match: { type: 'INDIVIDUEL' } },
                        {
                            $lookup: {
                                from: 'stagiaires',
                                localField: 'stagiaire',
                                foreignField: '_id',
                                as: 'stagiaireInfo'
                            }
                        },
                        { $unwind: '$stagiaireInfo' },
                        { $unwind: '$stagiaireInfo.parcours' },
                        {
                            $lookup: {
                                from: 'etablissements',
                                localField: 'stagiaireInfo.parcours.etablissement',
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
                    ],
                    groupes: [
                        { $match: { type: 'GROUPE' } },
                        { $unwind: '$groupes' },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupes',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        { $unwind: '$groupeInfo.stagiaires' },
                        {
                            $lookup: {
                                from: 'stagiaires',
                                localField: 'groupeInfo.stagiaires',
                                foreignField: '_id',
                                as: 'stagiaireInfo'
                            }
                        },
                        { $unwind: '$stagiaireInfo' },
                        { $unwind: '$stagiaireInfo.parcours' },
                        {
                            $lookup: {
                                from: 'etablissements',
                                localField: 'stagiaireInfo.parcours.etablissement',
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
                    ]
                }
            }
        ];

        const [result] = await Stage.aggregate(pipeline);
        const merged = [...result.individuels, ...result.groupes];

        // Regrouper par établissement
        const etablissementMap = new Map();
        
        merged.forEach(item => {
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
        console.error('Erreur nombreStagesParStatutEtEtablissement:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};



export const totalStagiairesSurPeriode = async (req, res) => {
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

    // --- Stagiaires individuels à partir des Rotations ---
    const stagiairesIndividuelsResult = await Rotation.aggregate([
    {
        $match: {
        stagiaire: { $exists: true, $ne: null },
        dateDebut: { $lte: dateFinFilter },
        dateFin: { $gte: dateDebutFilter }
        }
    },
    {
        $group: {
         _id: '$stagiaire'
        }
    }
    ]);
    const stagiairesIndividuelsSet = new Set(stagiairesIndividuelsResult.map(doc => doc._id.toString()));


    // --- Stagiaires de groupe à partir des Affectations Finales ---
    const stagiairesGroupesResult = await AffectationFinale.aggregate([
      {
        $match: {
          groupe: { $exists: true, $ne: null },
          dateDebut: { $lte: dateFinFilter },
          dateFin: { $gte: dateDebutFilter }
        }
      },
      {
        $lookup: {
          from: 'groupes',
          localField: 'groupe',
          foreignField: '_id',
          as: 'groupeInfo'
        }
      },
      { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },
      { $unwind: { path: '$groupeInfo.stagiaires', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$groupeInfo.stagiaires'
        }
      }
    ]);
    const stagiairesGroupesSet = new Set(stagiairesGroupesResult.map(doc => doc._id.toString()));

    // Fusionner et compter
    const tousStagiairesSet = new Set([...stagiairesIndividuelsSet, ...stagiairesGroupesSet]);

    return res.status(200).json({
      success: true,
      totalStagiaires: tousStagiairesSet.size
    });

  } catch (error) {
    console.error("Erreur dans totalStagiairesSurPeriode:", error);
    return res.status(500).json({
      success: false,
      message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
      error: error.message
    });
  }
};


export const totalStagiairesTerminesSurPeriode = async (req, res) => {
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
        const now = new Date();

        // --- Stagiaires individuels à partir des Rotations ---
        // On cherche les rotations qui se sont terminées DANS la période spécifiée
        const stagiairesIndividuelsResult = await Rotation.aggregate([
            {
                $match: {
                    stagiaire: { $exists: true, $ne: null },
                    // On s'assure que la date de fin est dans la période et antérieure à aujourd'hui
                    dateFin: { $gte: dateDebutFilter, $lte: dateFinFilter, $lt: now }
                }
            },
            {
                $group: {
                    _id: '$stagiaire'
                }
            }
        ]);
        const stagiairesIndividuelsSet = new Set(stagiairesIndividuelsResult.map(doc => doc._id.toString()));

        // --- Stagiaires de groupe à partir des Affectations Finales ---
        // On cherche les affectations de groupe qui se sont terminées DANS la période
        const stagiairesGroupesResult = await AffectationFinale.aggregate([
            {
                $match: {
                    groupe: { $exists: true, $ne: null },
                    // On s'assure que la date de fin est dans la période et antérieure à aujourd'hui
                    dateFin: { $gte: dateDebutFilter, $lte: dateFinFilter, $lt: now }
                }
            },
            {
                $lookup: {
                    from: 'groupes',
                    localField: 'groupe',
                    foreignField: '_id',
                    as: 'groupeInfo'
                }
            },
            { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$groupeInfo.stagiaires', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: '$groupeInfo.stagiaires'
                }
            }
        ]);
        const stagiairesGroupesSet = new Set(stagiairesGroupesResult.map(doc => doc._id.toString()));

        // Fusionner et compter
        const tousStagiairesSet = new Set([...stagiairesIndividuelsSet, ...stagiairesGroupesSet]);

        return res.status(200).json({
            success: true,
            totalStagiairesTermines: tousStagiairesSet.size
        });

    } catch (error) {
        console.error("Erreur dans totalStagiairesTerminesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};



export const moyenneStagiairesParSuperviseurSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const pipeline = [
            // Étape 1: Utiliser $facet pour lancer deux pipelines d'agrégation en parallèle
            {
                $facet: {
                    // Pipeline pour les stagiaires individuels via les Rotations
                    stagiairesIndividuels: [
                        { $match: { ...matchStage, stagiaire: { $exists: true, $ne: null } } },
                        { $group: { _id: '$superviseur', stagiaires: { $addToSet: '$stagiaire' } } }
                    ],
                    // Pipeline pour les stagiaires de groupe via les AffectationsFinales
                    stagiairesGroupes: [
                        { $match: { ...matchStage, groupe: { $exists: true, $ne: null } } },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        { $group: { _id: '$superviseur', stagiaires: { $addToSet: '$groupeInfo.stagiaires' } } }
                    ]
                }
            },
            // Étape 2: Fusionner les résultats des deux pipelines
            {
                $project: {
                    tousLesStagiaires: { $concatArrays: ['$stagiairesIndividuels', '$stagiairesGroupes'] }
                }
            },
            { $unwind: '$tousLesStagiaires' },
            // Étape 3: Regrouper à nouveau pour consolider les listes de stagiaires par superviseur
            {
                $group: {
                    _id: '$tousLesStagiaires._id',
                    stagiaires: {
                        $addToSet: {
                            $reduce: {
                                input: '$tousLesStagiaires.stagiaires',
                                initialValue: [],
                                in: { $concatArrays: ['$$value', '$$this'] }
                            }
                        }
                    }
                }
            },
            // Étape 4: Calculer la taille de chaque liste de stagiaires
            {
                $project: {
                    _id: 0,
                    superviseurId: '$_id',
                    nombreStagiaires: { $size: { $reduce: { input: '$stagiaires', initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } } } }
                }
            },
            // Étape 5: Calculer la moyenne finale
            {
                $group: {
                    _id: null,
                    totalStagiaires: { $sum: '$nombreStagiaires' },
                    totalSuperviseurs: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    moyenneStagiairesParSuperviseur: { $divide: ['$totalStagiaires', '$totalSuperviseurs'] }
                }
            }
        ];

        const result = await Rotation.aggregate(pipeline);
        const moyenne = result[0]?.moyenneStagiairesParSuperviseur || 0;

        return res.status(200).json({
            success: true,
            data: moyenne
        });
    } catch (error) {
        console.error("Erreur dans moyenneStagiairesParSuperviseurSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};


export const dureeMoyenneStagesSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        // Pipeline pour les rotations individuelles
        const dureesRotations = await Rotation.aggregate([
            { $match: matchStage },
            {
                $project: {
                    dureeEnJours: {
                        $divide: [{ $subtract: ['$dateFin', '$dateDebut'] }, 1000 * 60 * 60 * 24]
                    }
                }
            }
        ]);

        // Pipeline pour les affectations finales de groupe
        const dureesAffectations = await AffectationFinale.aggregate([
            { $match: matchStage },
            {
                $project: {
                    dureeEnJours: {
                        $divide: [{ $subtract: ['$dateFin', '$dateDebut'] }, 1000 * 60 * 60 * 24]
                    }
                }
            }
        ]);

        // Fusionner et calculer les totaux
        const toutesDurees = [...dureesRotations, ...dureesAffectations];

        const totalJours = toutesDurees.reduce((sum, item) => sum + item.dureeEnJours, 0);
        const totalStages = toutesDurees.length;

        const moyenneEnMois = totalStages > 0 ? (totalJours / totalStages) / 30 : 0;

        return res.status(200).json({
            success: true,
            dureeMoyenneMois: moyenneEnMois.toFixed(2)
        });

    } catch (error) {
        console.error("Erreur dans dureeMoyenneStagesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};


export const tauxStatutStagesSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const result = await Stage.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalStages = result.reduce((acc, cur) => acc + cur.count, 0);
        const map = result.reduce((acc, cur) => {
            acc[cur._id] = cur.count;
            return acc;
        }, {});

        const tauxAccepte = totalStages > 0 ? (map.ACCEPTE || 0) / totalStages : 0;
        const tauxRefuse = totalStages > 0 ? (map.REFUSE || 0) / totalStages : 0;
        const tauxEnAttente = totalStages > 0 ? (map.EN_ATTENTE || 0) / totalStages : 0;

        return res.status(200).json({
            success: true,
            tauxStatutStages: {
                tauxAccepte: tauxAccepte,
                tauxRefuse: tauxRefuse,
                tauxEnAttente: tauxEnAttente,
            }
        });
    } catch (error) {
        console.error("Erreur dans tauxStatutStagesSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const repartitionStagiairesParServiceSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const pipeline = [
            {
                $facet: {
                    // Pipeline pour les stagiaires individuels, filtré par la période
                    individuels: [
                        { $match: { ...matchStage, stagiaire: { $exists: true, $ne: null } } },
                        {
                            $group: {
                                _id: '$service',
                                stagiaires: { $addToSet: '$stagiaire' }
                            }
                        }
                    ],
                    // Pipeline pour les stagiaires de groupe, filtré par la période
                    groupes: [
                        { $match: { ...matchStage, groupe: { $exists: true, $ne: null } } },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        {
                            $group: {
                                _id: '$service',
                                stagiaires: { $addToSet: '$groupeInfo.stagiaires' }
                            }
                        }
                    ]
                }
            },
            // Fusionner les résultats des deux pipelines
            {
                $project: {
                    tousLesStagiaires: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStagiaires' },
            // Regrouper par service pour consolider les listes de stagiaires
            {
                $group: {
                    _id: '$tousLesStagiaires._id',
                    stagiaires: { $addToSet: '$tousLesStagiaires.stagiaires' }
                }
            },
            // Compter les stagiaires uniques par service
            {
                $project: {
                    _id: 0,
                    service: '$_id',
                    nombreStagiaires: {
                        $size: {
                            $reduce: {
                                input: '$stagiaires',
                                initialValue: [],
                                in: { $concatArrays: ['$$value', '$$this'] }
                            }
                        }
                    }
                }
            }
        ];

        const repartition = await Rotation.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionStagiairesParServiceSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};


export const repartitionStagiairesParSuperviseurSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const pipeline = [
            // Étape 1: Traiter les stages individuels et de groupe en parallèle
            {
                $facet: {
                    // Stagiaires individuels à partir des rotations
                    individuels: [
                        { $match: { ...matchStage, stagiaire: { $exists: true, $ne: null } } },
                        { $group: { _id: '$superviseur', stagiaires: { $addToSet: '$stagiaire' } } }
                    ],
                    // Stagiaires de groupe à partir des affectations finales
                    groupes: [
                        { $match: { ...matchStage, groupe: { $exists: true, $ne: null } } },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        { $unwind: '$groupeInfo.stagiaires' },
                        { $group: { _id: '$superviseur', stagiaires: { $addToSet: '$groupeInfo.stagiaires' } } }
                    ]
                }
            },
            // Étape 2: Fusionner les résultats des deux pipelines
            {
                $project: {
                    tousLesStagiaires: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStagiaires' },
            // Étape 3: Consolider les stagiaires par superviseur et compter
            {
                $group: {
                    _id: '$tousLesStagiaires._id',
                    nombreStagiaires: { $sum: { $size: '$tousLesStagiaires.stagiaires' } }
                }
            },
            // Étape 4: Joindre les informations des superviseurs
            {
                $lookup: {
                    from: 'superviseurs', // Remplace 'superviseurs' par le nom de ta collection de superviseurs
                    localField: '_id',
                    foreignField: '_id',
                    as: 'superviseurInfo'
                }
            },
            { $unwind: '$superviseurInfo' },
            // Étape 5: Projetter le résultat final
            {
                $project: {
                    _id: 0,
                    superviseur: {
                        _id: '$superviseurInfo._id',
                        nom: '$superviseurInfo.nom',
                        prenom: '$superviseurInfo.prenom'
                    },
                    nombreStagiaires: '$nombreStagiaires'
                }
            }
        ];

        const repartition = await Rotation.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionStagiairesParSuperviseurSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};



export const repartitionStagiairesParEtablissementSurPeriode = async (req, res) => {
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

        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const pipeline = [
            {
                $facet: {
                    // Pipeline pour les stagiaires individuels
                    individuels: [
                        { $match: { ...matchStage, stagiaire: { $exists: true, $ne: null } } },
                        {
                            $lookup: {
                                from: 'stagiaires',
                                localField: 'stagiaire',
                                foreignField: '_id',
                                as: 'stagiaireInfo'
                            }
                        },
                        { $unwind: '$stagiaireInfo' },
                        {
                            $group: {
                                _id: '$stagiaireInfo.etablissement',
                                stagiaires: { $addToSet: '$stagiaire' }
                            }
                        }
                    ],
                    // Pipeline pour les stagiaires de groupe
                    groupes: [
                        { $match: { ...matchStage, groupe: { $exists: true, $ne: null } } },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        { $unwind: '$groupeInfo.stagiaires' },
                        {
                            $lookup: {
                                from: 'stagiaires',
                                localField: 'groupeInfo.stagiaires',
                                foreignField: '_id',
                                as: 'stagiaireInfo'
                            }
                        },
                        { $unwind: '$stagiaireInfo' },
                        {
                            $group: {
                                _id: '$stagiaireInfo.etablissement',
                                stagiaires: { $addToSet: '$stagiaireInfo._id' }
                            }
                        }
                    ]
                }
            },
            // Fusionner les résultats
            {
                $project: {
                    tousLesStagiaires: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStagiaires' },
            // Regrouper par établissement pour consolider les listes de stagiaires
            {
                $group: {
                    _id: '$tousLesStagiaires._id',
                    stagiaires: { $addToSet: '$tousLesStagiaires.stagiaires' }
                }
            },
            // Compter les stagiaires uniques par établissement et joindre le nom de l'établissement
            {
                $project: {
                    etablissementId: '$_id',
                    nombreStagiaires: {
                        $size: {
                            $reduce: {
                                input: '$stagiaires',
                                initialValue: [],
                                in: { $concatArrays: ['$$value', '$$this'] }
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'etablissements', // Remplace par le nom de ta collection d'établissements
                    localField: 'etablissementId',
                    foreignField: '_id',
                    as: 'etablissementInfo'
                }
            },
            { $unwind: '$etablissementInfo' },
            {
                $project: {
                    _id: 0,
                    etablissement: {
                        _id: '$etablissementInfo._id',
                        nom: '$etablissementInfo.nom'
                    },
                    nombreStagiaires: 1
                }
            }
        ];

        const repartition = await Rotation.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            data: repartition
        });
    } catch (error) {
        console.error("Erreur dans repartitionStagiairesParEtablissementSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};

export const nombreStagesEnCoursSurPeriode = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    // if (!dateDebut || !dateFin) {
    //     return res.status(400).json({
    //         success: false,
    //         message: lang === 'fr'
    //             ? 'Les paramètres dateDebut et dateFin sont obligatoires.'
    //             : 'dateDebut and dateFin parameters are required.'
    //     });
    // }

    try {
        const dateDebutFilter = dateDebut ?new Date(dateDebut):undefined;
        const dateFinFilter = dateFin?new Date(dateFin):undefined;
        const now = new Date();

        const matchStage = {
            dateDebut: { $lte: dateFinFilter, $lte: now },
            dateFin: { $gte: dateDebutFilter, $gte: now }
        };

        const result = await Rotation.aggregate([
            {
                $facet: {
                    // Compter les stages individuels en cours
                    stagesIndividuels: [
                        { $match: matchStage },
                        { $count: 'total' }
                    ],
                    // Compter les stages de groupe en cours
                    stagesGroupes: [
                        { $match: matchStage },
                        { $count: 'total' }
                    ]
                }
            },
            {
                $project: {
                    totalStagesEnCours: {
                        $sum: [
                            { $ifNull: [{ $arrayElemAt: ['$stagesIndividuels.total', 0] }, 0] },
                            { $ifNull: [{ $arrayElemAt: ['$stagesGroupes.total', 0] }, 0] }
                        ]
                    }
                }
            }
        ]);

        const totalStagesEnCours = result[0]?.totalStagesEnCours || 0;

        return res.status(200).json({
            success: true,
            totalStagesEnCours: totalStagesEnCours
        });
    } catch (error) {
        console.error("Erreur dans nombreStagesEnCoursSurPeriode:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'fr' ? 'Erreur serveur.' : 'Server error.',
            error: error.message
        });
    }
};
