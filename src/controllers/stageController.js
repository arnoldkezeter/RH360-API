import Stage from '../models/Stage.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Stagiaire from '../models/Stagiaire.js';
import { sendStageNotificationEmail } from '../utils/sendMailNotificatonStage.js';
import { Groupe } from '../models/Groupe.js';
import { Rotation } from '../models/Rotation.js';
import { AffectationFinale } from '../models/AffectationFinale.js';
import mongoose from 'mongoose';
import fs from "fs";
import path from "path";
import { promisify } from 'util';
import { sendEmail } from '../utils/sendMailNotificationStatutStage.js';
import NoteService from '../models/NoteService.js';
import { validerReferencePDF } from '../utils/pdfHelper.js';
import logger from '../utils/logger.js';

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
            nomFr, nomEn, type,
            stagiaire,               // INDIVIDUEL
            groupes, rotations,      // GROUPE
            stagiaires, etablissement, // BATCH
            affectationsFinales,
            dateDebut, dateFin, anneeStage, statut
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

        // ── Validations par type ────────────────────────────────────────────
        if (type === 'INDIVIDUEL') {
            if (!stagiaire) {
                return res.status(400).json({
                    success: false,
                    message: t('stagiaire_obligatoire', lang),
                });
            }
            if (groupes?.length > 0 || stagiaires?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('groupe_non_autorise', lang),
                });
            }
        } else if (type === 'GROUPE') {
            if (!groupes || !Array.isArray(groupes) || groupes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: t('groupe_obligatoire', lang),
                });
            }
            if (stagiaire || stagiaires?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('stagiaire_non_autorise', lang),
                });
            }
        } else if (type === 'BATCH') {
            if (!stagiaires || !Array.isArray(stagiaires) || stagiaires.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: t('min_2_stagiaires', lang),
                });
            }
            if (!etablissement) {
                return res.status(400).json({
                    success: false,
                    message: t('etablissement_obligatoire', lang),
                });
            }
            // Pas de groupes ni de stagiaire unique
            if (stagiaire || groupes?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('no_individual_or_group_trainees', lang),
                });
            }
            // Pas de doublons
            const uniques = new Set(stagiaires.map(String));
            if (uniques.size !== stagiaires.length) {
                return res.status(400).json({
                    success: false,
                    message: t('no_duplicate_trainee_in_batch', lang),
                });
            }
            // Pas de rotations pour un BATCH
            if (rotations?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('batch_no_rotations_supported', lang),
                });
            }
        }

        // ── Validation des groupes (GROUPE uniquement) ──────────────────────
        if (type === 'GROUPE' && groupes) {
            const stagiaireIds = new Set();
            for (const grp of groupes) {
                if (!grp.numero) {
                    return res.status(400).json({
                        success: false,
                        message: t('numero_groupe', lang),
                    });
                }
                if (!grp.stagiaires || !Array.isArray(grp.stagiaires)) {
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

        // ── Validation des rotations (GROUPE uniquement) ────────────────────
        if (rotations) {
            if (!Array.isArray(rotations)) {
                return res.status(400).json({
                    success: false,
                    message: t('rotation_tableau', lang),
                });
            }
            rotations.forEach((rot, idx) => {
                if (!rot.structure || !rot.dateDebut || !rot.dateFin)
                    throw new Error(`Rotation #${idx + 1}: structure, dateDebut et dateFin obligatoires`);
                if (!isValidDateRange(rot.dateDebut, rot.dateFin))
                    throw new Error(`Rotation #${idx + 1}: dateDebut doit être ≤ dateFin`);
                if (rot.stagiaire && rot.groupe)
                    throw new Error(`Rotation #${idx + 1}: stagiaire OU groupe, pas les deux`);
                if (!rot.stagiaire && !rot.groupe)
                    throw new Error(`Rotation #${idx + 1}: stagiaire ou groupe doit être défini`);
            });
            if (checkOverlaps(rotations, 'stagiaire')) {
                return res.status(400).json({
                    success: false,
                    message: t('conflit_chevauchement_rotation_stagiaire', lang),
                });
            }
            if (checkOverlaps(rotations, 'groupe')) {
                return res.status(400).json({
                    success: false,
                    message: t('conflit_chevauchement_rotation_groupe', lang),
                });
            }
        }

        // ── Validation des affectations finales ─────────────────────────────
        if (affectationsFinales) {
            if (!Array.isArray(affectationsFinales))
                throw new Error('affectationsFinales doit être un tableau');

            affectationsFinales.forEach((aff, idx) => {
                if (!aff.structure || !aff.dateDebut || !aff.dateFin)
                    throw new Error(`Affectation #${idx + 1}: structure, dateDebut et dateFin obligatoires`);
                if (!isValidDateRange(aff.dateDebut, aff.dateFin))
                    throw new Error(`Affectation #${idx + 1}: dateDebut doit être ≤ dateFin`);

                // Pour BATCH : chaque affectation doit référencer un stagiaire
                if (type === 'BATCH') {
                    if (!aff.stagiaire) {
                        throw new Error(`Affectation #${idx + 1}: le stagiaire est obligatoire pour un stage BATCH`);
                    }
                    if (!stagiaires.map(String).includes(String(aff.stagiaire))) {
                        throw new Error(`Affectation #${idx + 1}: ce stagiaire ne fait pas partie du stage BATCH`);
                    }
                } else {
                    if (aff.stagiaire && aff.groupe)
                        throw new Error(`Affectation #${idx + 1}: stagiaire OU groupe, pas les deux`);
                    if (!aff.stagiaire && !aff.groupe)
                        throw new Error(`Affectation #${idx + 1}: stagiaire ou groupe doit être défini`);
                }
            });

            if (type !== 'BATCH') {
                if (checkOverlaps(affectationsFinales, 'stagiaire'))
                    throw new Error('Conflit de chevauchement dans les affectations (même stagiaire)');
                if (checkOverlaps(affectationsFinales, 'groupe'))
                    throw new Error('Conflit de chevauchement dans les affectations (même groupe)');
            }
        }

        // ── Création du stage ───────────────────────────────────────────────
        const stagePayload = {
            nomFr, nomEn, type,
            dateDebut, dateFin, anneeStage, statut
        };

        if (type === 'INDIVIDUEL') stagePayload.stagiaire = stagiaire;
        if (type === 'BATCH') {
            stagePayload.stagiaires    = stagiaires;
            stagePayload.etablissement = etablissement;
        }

        const stage = new Stage(stagePayload);
        await stage.save({ session });

        // ── Groupes (GROUPE) ────────────────────────────────────────────────
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
                groupeMapping.set(grp.numero, groupeDoc._id);
            }
            stage.groupes = groupesIds;
            await stage.save({ session });
        }

        // ── Rotations ───────────────────────────────────────────────────────
        if (rotations) {
            for (const rot of rotations) {
                let groupeObjectId = null;
                if (rot.groupe) {
                    groupeObjectId = groupeMapping.get(rot.groupe);
                    if (!groupeObjectId)
                        throw new Error(`Groupe ${rot.groupe} introuvable pour la rotation`);
                }
                await new Rotation({
                    stage: stage._id,
                    structure: rot.structure,
                    superviseur: rot.superviseur || null,
                    dateDebut: rot.dateDebut,
                    dateFin: rot.dateFin,
                    stagiaire: rot.stagiaire || null,
                    groupe: groupeObjectId
                }).save({ session });
            }
        }

        // ── Affectations finales ─────────────────────────────────────────────
        if (affectationsFinales) {
            for (const aff of affectationsFinales) {
                let groupeObjectId = null;
                if (aff.groupe) {
                    groupeObjectId = groupeMapping.get(aff.groupe);
                    if (!groupeObjectId)
                        throw new Error(`Groupe ${aff.groupe} introuvable pour l'affectation`);
                }
                await new AffectationFinale({
                    stage: stage._id,
                    structure: aff.structure,
                    superviseur: aff.superviseur || null,
                    stagiaire: aff.stagiaire || null,   // défini pour INDIVIDUEL et BATCH
                    groupe: groupeObjectId,              // défini pour GROUPE
                    dateDebut: aff.dateDebut,
                    dateFin: aff.dateFin
                }).save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        // ── Emails de notification ───────────────────────────────────────────
        if (type === 'INDIVIDUEL') {
            const stagiaireDoc = await Stagiaire.findById(stagiaire);
            if (stagiaireDoc?.email) {
                sendStageNotificationEmail(stagiaireDoc.email, lang, stagiaireDoc.nom, stagiaireDoc.prenom);
            }
        } else if (type === 'GROUPE') {
            const groupesDocs = await Groupe.find({ stage: stage._id }).populate('stagiaires');
            for (const groupe of groupesDocs) {
                for (const s of groupe.stagiaires) {
                    if (s.email) sendStageNotificationEmail(s.email, lang, s.nom, s.prenom);
                }
            }
        } else if (type === 'BATCH') {
            const stagiaireDocs = await Stagiaire.find({ _id: { $in: stagiaires } });
            for (const s of stagiaireDocs) {
                if (s.email) sendStageNotificationEmail(s.email, lang, s.nom, s.prenom);
            }
        }

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: stage,
        });

    } catch (err) {
        console.error(err);
        logger.error('Create stage exception:', err);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            success: false,
            message: `${t('erreur_serveur', lang)} : ${err.message}`,
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
      .populate('structure', 'nomEn nomFr')
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
      .populate('structure', 'nomEn nomFr')
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

export const updateStage = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const stageId = req.params.stageId;
        const {
            nomFr, nomEn, type,
            stagiaire,
            groupes, rotations,
            stagiaires, etablissement,
            affectationsFinales,
            dateDebut, dateFin, anneeStage, statut
        } = req.body;

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

        // ── Validations par type (identiques à createStage) ─────────────────
        if (type === 'INDIVIDUEL') {
            if (!stagiaire) {
                return res.status(400).json({ success: false, message: t('stagiaire_obligatoire', lang) });
            }
            if (groupes?.length > 0 || stagiaires?.length > 0) {
                return res.status(400).json({ success: false, message: t('groupe_non_autorise', lang) });
            }
        } else if (type === 'GROUPE') {
            if (!groupes || !Array.isArray(groupes) || groupes.length === 0) {
                return res.status(400).json({ success: false, message: t('groupe_obligatoire', lang) });
            }
            if (stagiaire || stagiaires?.length > 0) {
                return res.status(400).json({ success: false, message: t('stagiaire_non_autorise', lang) });
            }
        } else if (type === 'BATCH') {
            if (!stagiaires || !Array.isArray(stagiaires) || stagiaires.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: t('min_2_stagiaires', lang),
                });
            }
            if (!etablissement) {
                return res.status(400).json({
                    success: false,
                    message: t('etablissement_obligatoire', lang),
                });
            }
            if (stagiaire || groupes?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('no_individual_or_group_trainees', lang),
                });
            }
            const uniques = new Set(stagiaires.map(String));
            if (uniques.size !== stagiaires.length) {
                return res.status(400).json({
                    success: false,
                    message: t('duplicate_trainees_detected', lang),
                });
            }
            if (rotations?.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: t('batch_no_rotations_supported',lang),
                });
            }
        }

        // ── Validation groupes ───────────────────────────────────────────────
        if (type === 'GROUPE' && groupes) {
            const stagiaireIds = new Set();
            for (const grp of groupes) {
                if (!grp.numero) {
                    return res.status(400).json({ success: false, message: t('numero_groupe', lang) });
                }
                if (!grp.stagiaires || !Array.isArray(grp.stagiaires)) {
                    return res.status(400).json({ success: false, message: t('groupe_tableau_stagiaire', lang) });
                }
                grp.stagiaires.forEach(id => {
                    if (stagiaireIds.has(id)) {
                        return res.status(400).json({ success: false, message: t('stagiaire_plusieurs_groupes', lang) });
                    }
                    stagiaireIds.add(id);
                });
            }
        }

        // ── Validation rotations ─────────────────────────────────────────────
        if (rotations) {
            if (!Array.isArray(rotations)) {
                return res.status(400).json({ success: false, message: t('rotation_tableau', lang) });
            }
            rotations.forEach((rot, idx) => {
                if (!rot.structure || !rot.dateDebut || !rot.dateFin)
                    throw new Error(`Rotation #${idx + 1}: structure, dateDebut et dateFin obligatoires`);
                if (!isValidDateRange(rot.dateDebut, rot.dateFin))
                    throw new Error(`Rotation #${idx + 1}: dateDebut doit être ≤ dateFin`);
                if (rot.stagiaire && rot.groupe)
                    throw new Error(`Rotation #${idx + 1}: stagiaire OU groupe, pas les deux`);
                if (!rot.stagiaire && !rot.groupe)
                    throw new Error(`Rotation #${idx + 1}: stagiaire ou groupe doit être défini`);
            });
            if (checkOverlaps(rotations, 'stagiaire')) {
                return res.status(400).json({ success: false, message: t('conflit_chevauchement_rotation_stagiaire', lang) });
            }
            if (checkOverlaps(rotations, 'groupe')) {
                return res.status(400).json({ success: false, message: t('conflit_chevauchement_rotation_groupe', lang) });
            }
        }

        // ── Validation affectations ──────────────────────────────────────────
        if (affectationsFinales) {
            if (!Array.isArray(affectationsFinales))
                throw new Error('affectationsFinales doit être un tableau');
            affectationsFinales.forEach((aff, idx) => {
                if (!aff.structure || !aff.dateDebut || !aff.dateFin)
                    throw new Error(`Affectation #${idx + 1}: structure, dateDebut et dateFin obligatoires`);
                if (!isValidDateRange(aff.dateDebut, aff.dateFin))
                    throw new Error(`Affectation #${idx + 1}: dateDebut doit être ≤ dateFin`);
                if (type === 'BATCH') {
                    if (!aff.stagiaire)
                        throw new Error(`Affectation #${idx + 1}: stagiaire obligatoire pour BATCH`);
                    if (!stagiaires.map(String).includes(String(aff.stagiaire)))
                        throw new Error(`Affectation #${idx + 1}: stagiaire absent du stage BATCH`);
                } else {
                    if (aff.stagiaire && aff.groupe)
                        throw new Error(`Affectation #${idx + 1}: stagiaire OU groupe, pas les deux`);
                    if (!aff.stagiaire && !aff.groupe)
                        throw new Error(`Affectation #${idx + 1}: stagiaire ou groupe doit être défini`);
                }
            });
            if (type !== 'BATCH') {
                if (checkOverlaps(affectationsFinales, 'stagiaire'))
                    throw new Error('Conflit de chevauchement (même stagiaire)');
                if (checkOverlaps(affectationsFinales, 'groupe'))
                    throw new Error('Conflit de chevauchement (même groupe)');
            }
        }

        // ── Supprimer les données liées existantes ───────────────────────────
        await Groupe.deleteMany({ stage: stageId }, { session });
        await Rotation.deleteMany({ stage: stageId }, { session });
        await AffectationFinale.deleteMany({ stage: stageId }, { session });

        // ── Mettre à jour le stage ───────────────────────────────────────────
        const updatePayload = {
            nomFr, nomEn, type,
            stagiaire:     type === 'INDIVIDUEL' ? stagiaire : null,
            stagiaires:    type === 'BATCH'      ? stagiaires : [],
            etablissement: type === 'BATCH'      ? etablissement : null,
            groupes: [],
            dateDebut, dateFin, anneeStage, statut
        };

        const updatedStage = await Stage.findByIdAndUpdate(stageId, updatePayload, {
            new: true, session
        });

        // ── Recréer les groupes ──────────────────────────────────────────────
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
                groupeMapping.set(grp.numero, groupeDoc._id);
            }
            updatedStage.groupes = groupesIds;
            await updatedStage.save({ session });
        }

        // ── Recréer les rotations ────────────────────────────────────────────
        if (rotations) {
            for (const rot of rotations) {
                let groupeObjectId = null;
                if (rot.groupe) {
                    groupeObjectId = groupeMapping.get(rot.groupe);
                    if (!groupeObjectId)
                        throw new Error(`Groupe ${rot.groupe} introuvable pour la rotation`);
                }
                await new Rotation({
                    stage: stageId,
                    structure: rot.structure,
                    superviseur: rot.superviseur || null,
                    dateDebut: rot.dateDebut,
                    dateFin: rot.dateFin,
                    stagiaire: rot.stagiaire || null,
                    groupe: groupeObjectId
                }).save({ session });
            }
        }

        // ── Recréer les affectations ─────────────────────────────────────────
        if (affectationsFinales) {
            for (const aff of affectationsFinales) {
                let groupeObjectId = null;
                if (aff.groupe) {
                    groupeObjectId = groupeMapping.get(aff.groupe);
                    if (!groupeObjectId)
                        throw new Error(`Groupe ${aff.groupe} introuvable pour l'affectation`);
                }
                await new AffectationFinale({
                    stage: stageId,
                    structure: aff.structure,
                    superviseur: aff.superviseur || null,
                    stagiaire: aff.stagiaire || null,
                    groupe: groupeObjectId,
                    dateDebut: aff.dateDebut,
                    dateFin: aff.dateFin
                }).save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: updatedStage,
        });

    } catch (err) {
        console.error(err);
        await session.abortTransaction();
        session.endSession();
        logger.error('Updated stage exception:', err);
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
        logger.error('Delete stage exception:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};



const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);


export const changerStatutStage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { stageId } = req.params;
    const { statut } = req.body;
    const session = await mongoose.startSession();
    
    // Fonction helper pour nettoyer le fichier uploadé
    const cleanupUploadedFile = async () => {
        if (req.file?.path) {
            try {
                // Utilisation de unlinkAsync (doit être définie, e.g. promisify(fs.unlink))
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

        // Récupérer le stage avec vérification d'existence
        const stage = await Stage.findById(stageId); // Pas besoin de session pour la lecture initiale
        if (!stage) {
            await cleanupUploadedFile();
            return res.status(404).json({
                success: false,
                message: t('stage_non_trouve', lang)
            });
        }

        let noteServiceRelatif = null;
        let noteServicePath = null;
        let note = null; // Déclarer note ici pour la rendre accessible à la vérification

        // Gestion de la note de service pour ACCEPTE
        if (statut === 'ACCEPTE') {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: t('note_service_obligatoire', lang)
                });
            }
            
            // Récupérer la note de service associée pour obtenir la référence attendue
            note = await NoteService.findOne({ stage: stage._id });
            if (!note || !note.reference) {
                await cleanupUploadedFile();
                return res.status(404).json({
                    success: false,
                    message: t('reference_attendue_manquante', lang) // Message d'erreur spécifique
                });
            }

            // --- ⚠️ SECTION D'AJOUT DE LA VÉRIFICATION PDF ---
            // Le fichier est obligatoirement un PDF ou un format supporté pour ACCEPTE
            // Nous allons vérifier la référence UNIQUEMENT si le fichier est un PDF (pour éviter de parser DOCX/DOC)
            if (req.file.mimetype === 'application/pdf' || path.extname(req.file.originalname).toLowerCase() === '.pdf') {
                
                const resultat = await validerReferencePDF(req.file.path, note.reference, t, lang);

                if (!resultat.valide) {
                    // Supprimer le fichier uploadé si la validation échoue
                    await cleanupUploadedFile();

                    return res.status(400).json({
                        success: false,
                        message: resultat.message, // Utiliser une clé de traduction spécifique
                    });
                }
            }
            // ---------------------------------------------------

            // Validation du type de fichier (après la vérification PDF, car le fichier pourrait être non-PDF mais valide)
            const extensionsAutorisees = ['.pdf', '.doc', '.docx'];
            const extension = path.extname(req.file.originalname).toLowerCase();
            if (!extensionsAutorisees.includes(extension)) {
                await cleanupUploadedFile();
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
                return res.status(400).json({
                    success: false,
                    message: t('fichier_trop_volumineux', lang),
                    tailleMax: '5MB'
                });
            }
            
            // Les validations sont passées, on peut lancer la transaction

            // Démarrer la transaction
            session.startTransaction();

            // Supprimer l'ancienne note si elle existe (DOIT ÊTRE DANS LA TRANSACTION si on veut rollbacker son chemin DB)
            if (stage.noteService) {
                 // Supprimer le fichier physique (on continue même si ça échoue)
                 // NOTE: La suppression physique n'est pas rollbackée, c'est pourquoi on la place souvent hors transaction.
                 // Cependant, pour la propreté, on le laisse avant le reste des opérations DB.
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
                    console.error('Erreur lors de la suppression de l\'ancienne note physique:', error);
                }
            }
            
            // Mise à jour des chemins
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
                // Si le fichier existe physiquement ici, il a survécu au cleanup initial, mais il devrait être supprimé ici
                // car l'erreur est fatale. Cependant, on a déjà appelé cleanupUploadedFile au début du catch.
                return res.status(500).json({
                    success: false,
                    message: t('erreur_upload_fichier', lang)
                });
            }

            stage.noteService = noteServiceRelatif;

        } else {
             // Si statut est REFUSE, lancer la transaction ici
            session.startTransaction();
            // On s'assure que le fichier uploadé est supprimé s'il y en avait un malgré le statut REFUSE
            await cleanupUploadedFile();
        }

        // Mettre à jour le statut
        stage.statut = statut;
        await stage.save({ session });

        // 🔵 SYNCHRONISATION : Mettre à jour la Note de Service liée au stage
        // On récupère la note ici si on ne l'a pas déjà fait pour ACCEPTE, 
        // ou on réutilise la variable 'note' déjà chargée.
        if (!note) {
             note = await NoteService.findOne({ stage: stage._id });
        }
       
        if (note) {
            note.valideParDG = true;
            if (noteServiceRelatif) note.filePath = noteServiceRelatif;
            await note.save({ session });
        }
        
        // ... (Le reste du code reste inchangé, car il est déjà dans la transaction ou après)

        // Récupérer les affectations avec gestion des cas vides
        const affectations = await AffectationFinale.find({ stage: stage._id })
            .populate({
                path: "stagiaire",
                select: "nom prenom email"
            })
            .populate({
                path: "groupe",
                populate: {
                    path: "stagiaires",
                    select: "nom prenom email"
                }
            })
            .session(session)
            .lean();

        // Collecter les stagiaires uniques
        const stagiairesMap = new Map();
        
        for (const aff of affectations) {
            if (aff.stagiaire) {
                const id = aff.stagiaire._id.toString();
                if (!stagiairesMap.has(id)) {
                    stagiairesMap.set(id, aff.stagiaire);
                }
            } else if (aff.groupe?.stagiaires?.length > 0) {
                for (const stagiaire of aff.groupe.stagiaires) {
                    const id = stagiaire._id.toString();
                    if (!stagiairesMap.has(id)) {
                        stagiairesMap.set(id, stagiaire);
                    }
                }
            }
        }

        const stagiaires = Array.from(stagiairesMap.values());

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer les emails (après la transaction pour ne pas bloquer)
        // ... (La suite du code d'envoi d'emails est inchangée)

        const emailPromises = [];
        const emailErrors = [];

        for (const stagiaire of stagiaires) {
            if (!stagiaire?.email) {
                console.warn(`Stagiaire ${stagiaire?.nom || 'inconnu'} sans email`);
                continue;
            }

            // Validation basique de l'email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(stagiaire.email)) {
                console.warn(`Email invalide pour ${stagiaire.nom}: ${stagiaire.email}`);
                continue;
            }

            let subject, text, html;
            const attachments = [];

            if (statut === "ACCEPTE") {
                subject = lang === 'fr' 
                    ? "Votre demande de stage a été acceptée" 
                    : "Your internship request has been accepted";
                
                text = lang === 'fr'
                    ? "Votre demande de stage a été acceptée. Veuillez consulter la note de service jointe."
                    : "Your internship request has been accepted. Please find the service note attached.";
                
                html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">Demande de Stage</h2>
                        <p>Bonjour <strong>${stagiaire.nom} ${stagiaire.prenom || ''}</strong>,</p>
                        <p>Nous avons le plaisir de vous informer que votre demande de stage a été 
                        <strong style="color: #27ae60;">acceptée</strong>.</p>
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
                    ? "Votre demande de stage n'a pas été retenue"
                    : "Your internship request was not accepted";
                
                text = lang === 'fr'
                    ? "Votre demande de stage n'a pas été retenue."
                    : "Your internship request was not accepted.";
                
                html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">Demande de Stage</h2>
                        <p>Bonjour <strong>${stagiaire.nom} ${stagiaire.prenom || ''}</strong>,</p>
                        <p>Nous vous informons que votre demande de stage n'a pas été retenue pour cette session.</p>
                        <p>Nous vous encourageons à postuler lors des prochaines sessions.</p>
                        <p>Cordialement,<br/>Direction Générale des Impôts</p>
                    </div>
                `;
            }

            // Ajouter la promesse d'envoi d'email
            emailPromises.push(
                sendEmail({
                    to: stagiaire.email,
                    subject,
                    text,
                    html,
                    attachments
                }).catch(error => {
                    emailErrors.push({
                        stagiaire: `${stagiaire.nom} ${stagiaire.prenom || ''}`,
                        email: stagiaire.email,
                        error: error.message
                    });
                    console.error(`Erreur envoi email à ${stagiaire.email}:`, error);
                })
            );
        }

        // Attendre tous les envois d'email (sans bloquer la réponse)
        await Promise.allSettled(emailPromises);

        // Construire la réponse
        const response = {
            success: true,
            message: t('modifier_succes', lang),
            data: {
                stage: {
                    _id: stage._id,
                    statut: stage.statut,
                    noteService: stage.noteService
                },
                emailsEnvoyes: stagiaires.length - emailErrors.length,
                totalStagiaires: stagiaires.length
            }
        };

        // Ajouter les erreurs d'email si en mode développement
        if (emailErrors.length > 0 && process.env.NODE_ENV === 'development') {
            response.data.erreursEmail = emailErrors;
        }

        return res.status(200).json(response);

    } catch (error) {
        // Nettoyage en cas d'erreur
        await cleanupUploadedFile();
        logger.error('Update statut stage exception:', error);
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error("Erreur dans changerStatutStage:", error);
        
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      .populate('structure superviseur stagiaire groupe');
    res.json({ success: true, data: rotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRotationById = async (req, res) => {
  try {
    const rotation = await Rotation.findById(req.params.id)
      .populate('structure superviseur stagiaire groupe');
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
      .populate('structure superviseur stagiaire groupe');
    res.json({ success: true, data: affectations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAffectationById = async (req, res) => {
  try {
    const aff = await AffectationFinale.findById(req.params.id)
      .populate('structure superviseur stagiaire groupe');
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

        if (search && search.trim() !== '') {
            matchFilters.$or = [
                { nomFr: { $regex: search, $options: 'i' } },
                { nomEn: { $regex: search, $options: 'i' } }
            ];
        }

        if (type && type !== 'ALL') {
            matchFilters.type = type;
        }

        if (statut && statut !== 'ALL') {
            matchFilters.statut = statut;
        }

        const pipeline = [
            ...(Object.keys(matchFilters).length > 0 ? [{ $match: matchFilters }] : []),

            /** -------------------------------
             *  AJOUT : Lookup Note de Service
             *  ------------------------------- */
            {
                $lookup: {
                    from: 'noteservices',
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'noteService'
                }
            },

            // Stagiaire
            {
                $lookup: {
                    from: 'stagiaires',
                    localField: 'stagiaire',
                    foreignField: '_id',
                    as: 'stagiaireInfo',
                },
            },

            // Groupes
            {
                $lookup: {
                    from: 'groupes',
                    localField: 'groupes',
                    foreignField: '_id',
                    as: 'groupesInfo',
                },
            },

            // Rotations
            {
                $lookup: {
                    from: 'rotations',
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'rotations',
                },
            },

            // Affectations finales
            {
                $lookup: {
                    from: 'affectationfinales',
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

            { $sort: { createdAt: -1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },

            /** -----------------------------------------
             *  PROJECTION : inclure la note de service
             *  ----------------------------------------- */
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

                    /** NOTE DE SERVICE (si elle existe) */
                    noteService: {
                        $cond: [
                            { $gt: [{ $size: '$noteService' }, 0] },
                            { $arrayElemAt: ['$noteService', 0] },
                            null
                        ]
                    }
                },
            },
        ];

        const stages = await Stage.aggregate(pipeline);

        // Total
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
        // Récupérer les rotations avec leurs groupes et structures
        const rotations = await Rotation.find()
            .populate('groupe', 'numero')
            .populate('structure', 'nomFr nomEn')
            .sort({ dateDebut: 1 });

        // Récupérer les stages finaux pour chaque groupe
        const stagesFinaux = await Groupe.find()
            .populate('structureFinal.structure', 'nomFr nomEn')
            .populate('numero', 'numero');

        // Construire le calendrier
        const calendrier = {};

        // Ajouter les rotations
        rotations.forEach((rotation) => {
            const groupe = `Groupe ${rotation.groupe.numero}`;
            const structure = {
                nomFr: rotation.structure.nomFr,
                nomEn: rotation.structure.nomEn,
            };
            const periode = `${rotation.dateDebut.toISOString()} - ${rotation.dateFin.toISOString()}`;

            if (!calendrier[groupe]) calendrier[groupe] = {};
            if (!calendrier[groupe][structure.nomFr]) calendrier[groupe][structure.nomFr] = [];

            calendrier[groupe][structure.nomFr].push(periode);
        });

        // Ajouter les stages finaux
        stagesFinaux.forEach((groupe) => {
            const groupeKey = `Groupe ${groupe.numero}`;
            const structure = groupe.structureFinal.structure;

            if (structure) {
                const structureDetails = {
                    nomFr: structure.nomFr,
                    nomEn: structure.nomEn,
                };
                const periode = 'Stage final';

                if (!calendrier[groupeKey]) calendrier[groupeKey] = {};
                if (!calendrier[groupeKey][structureDetails.nomFr]) calendrier[groupeKey][structureDetails.nomFr] = [];

                calendrier[groupeKey][structureDetails.nomFr].push(periode);
            }
        });

        return res.status(200).json({
            success: true,
            calendrier,
        });
    } catch (error) {
        logger.error('Calendar stage exception:', error);
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
        // Définir les limites de date précises (début du premier jour à fin du dernier jour)
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);

        // --- 1. Stagiaires individuels (AffectationFinale.stagiaire) ---
        const stagiairesIndividuelsResult = await AffectationFinale.aggregate([ 
            {
                $match: {
                    stagiaire: { $exists: true, $ne: null },
                    groupe: null // Assure que c'est bien un stage individuel
                }
            },
            // 💡 AJOUT : Lookup vers Stage pour les dates
            {
                $lookup: {
                    from: 'stages',
                    localField: 'stage', // ASSUMPTION : L'ID du stage est dans AffectationFinale.stage
                    foreignField: '_id',
                    as: 'stageInfo'
                }
            },
            { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
            // 💡 FILTRE : Filtrer sur les VRAIES dates du stage
            {
                $match: {
                    'stageInfo.dateDebut': { $lte: dateFinFilter }, 
                    'stageInfo.dateFin': { $gte: dateDebutFilter } 
                }
            },
            {
                $group: {
                    _id: '$stagiaire'
                }
            }
        ]);
        const stagiairesIndividuelsSet = new Set(stagiairesIndividuelsResult.map(doc => doc._id.toString()));

        // --- 2. Stagiaires de groupe (AffectationFinale.groupe) ---
        const stagiairesGroupesResult = await AffectationFinale.aggregate([
            {
                $match: {
                    groupe: { $exists: true, $ne: null },
                    stagiaire: null // Assure que c'est bien une affectation de groupe
                }
            },
            // 1er lookup vers la collection 'groupes'
            {
                $lookup: {
                    from: 'groupes',
                    localField: 'groupe',
                    foreignField: '_id',
                    as: 'groupeInfo'
                }
            },
            { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },
            
            // 2ème lookup vers la collection 'stages' pour récupérer les dates
            {
                $lookup: {
                    from: 'stages',
                    localField: 'groupeInfo.stage',
                    foreignField: '_id',
                    as: 'stageInfo'
                }
            },
            { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },

            // FILTRE : Filtrer sur les VRAIES dates du stage
            {
                $match: {
                    'stageInfo.dateDebut': { $lte: dateFinFilter }, 
                    'stageInfo.dateFin': { $gte: dateDebutFilter } 
                }
            },
            
            // On continue le processus d'unwind et de groupement des stagiaires
            { $unwind: { path: '$groupeInfo.stagiaires', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: '$groupeInfo.stagiaires'
                }
            }
        ]);
        const stagiairesGroupesSet = new Set(stagiairesGroupesResult.map(doc => doc._id.toString()));

        // --- 3. Fusionner et compter (Unicité globale) ---
        const tousStagiairesSet = new Set([...stagiairesIndividuelsSet, ...stagiairesGroupesSet]);

        // 📢 AFFICHAGE CONSOLE : Détermination des stagiaires en doublon
        const individuelsArray = Array.from(stagiairesIndividuelsSet);
        let doublonsCount = 0;
        
        for (const stagiaireId of individuelsArray) {
            if (stagiairesGroupesSet.has(stagiaireId)) {
                doublonsCount++;
            }
        }

        console.log(`--- Vérification des stagiaires en doublon sur la période ---`);
        console.log(`Nombre de stagiaires présents à la fois dans un stage individuel ET dans un stage de groupe : ${doublonsCount}`);
        console.log(`--------------------------------------------------------------`);
        

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
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);
        
        const now = new Date();

        // --- 1. Stagiaires individuels ---
        const stagiairesIndividuelsResult = await AffectationFinale.aggregate([
            {
                $match: {
                    stagiaire: { $exists: true, $ne: null },
                    groupe: null
                }
            },
            // 💡 AJOUT : Lookup vers Stage pour les dates
            {
                $lookup: {
                    from: 'stages',
                    localField: 'stage', // ASSUMPTION : L'ID du stage est dans AffectationFinale.stage
                    foreignField: '_id',
                    as: 'stageInfo'
                }
            },
            { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
            // 💡 FILTRE : Condition de terminaison sur les VRAIES dates du stage
            {
                $match: {
                    'stageInfo.dateFin': { 
                        $gte: dateDebutFilter, 
                        $lte: dateFinFilter, 
                        $lt: now 
                    }
                }
            },
            {
                $group: {
                    _id: '$stagiaire'
                }
            }
        ]);
        const stagiairesIndividuelsSet = new Set(stagiairesIndividuelsResult.map(doc => doc._id.toString()));

        // --- 2. Stagiaires de groupe ---
        const stagiairesGroupesResult = await AffectationFinale.aggregate([
            {
                $match: {
                    groupe: { $exists: true, $ne: null },
                    stagiaire: null
                }
            },
            // Lookup vers la collection 'groupes'
            {
                $lookup: {
                    from: 'groupes',
                    localField: 'groupe',
                    foreignField: '_id',
                    as: 'groupeInfo'
                }
            },
            { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },
            
            // Lookup vers la collection 'stages' pour obtenir les VRAIES dates
            {
                $lookup: {
                    from: 'stages',
                    localField: 'groupeInfo.stage',
                    foreignField: '_id',
                    as: 'stageInfo'
                }
            },
            { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },

            // 💡 FILTRE : Condition de terminaison sur la date de fin du Stage
            {
                $match: {
                    'stageInfo.dateFin': { 
                        $gte: dateDebutFilter, 
                        $lte: dateFinFilter, 
                        $lt: now 
                    }
                }
            },
            
            // Unwind et groupement des stagiaires
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
        // Définir les limites de date précises (début/fin de journée)
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);

        // Match initial : Seuls les superviseurs sont requis
        const initialMatch = { superviseur: { $exists: true, $ne: null } };

        const pipeline = [
            {
                $facet: {
                    // Stagiaires individuels
                    stagesIndividuels: [
                        { $match: { ...initialMatch, stagiaire: { $exists: true, $ne: null }, groupe: null } },
                        // Lookup Stage
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'stage', // ASSUMPTION : L'ID du stage est dans AffectationFinale.stage
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        // 💡 FILTRE par date de STAGE
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        {
                            $group: {
                                _id: '$superviseur',
                                stagiaires: { $addToSet: '$stagiaire' }
                            }
                        }
                    ],
                    // Affectations de groupes
                    affectationsGroupes: [
                        { $match: { ...initialMatch, groupe: { $exists: true, $ne: null }, stagiaire: null } },
                        // Lookup Groupe
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },
                        // Lookup Stage
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'groupeInfo.stage',
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        // 💡 FILTRE par date de STAGE
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        { $unwind: { path: '$groupeInfo.stagiaires', preserveNullAndEmptyArrays: false } },
                        {
                            $group: {
                                _id: '$superviseur',
                                stagiaires: { $addToSet: '$groupeInfo.stagiaires' }
                            }
                        }
                    ]
                }
            },
            // Fusionner les résultats
            { $project: { combined: { $concatArrays: ['$stagesIndividuels', '$affectationsGroupes'] } } },
            { $unwind: '$combined' },
            // Regrouper par superviseur et combiner les stagiaires
            {
                $group: {
                    _id: '$combined._id',
                    stagiaires: { $push: '$combined.stagiaires' }
                }
            },
            // Aplatir les stagiaires en un ensemble unique (SetUnion)
            {
                $project: {
                    _id: 1,
                    stagiairesUniques: {
                        $reduce: {
                            input: '$stagiaires',
                            initialValue: [],
                            in: { $setUnion: ['$$value', '$$this'] }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    nombreStagiaires: { $size: '$stagiairesUniques' }
                }
            },
            // Calculer la moyenne
            {
                $group: {
                    _id: null,
                    totalStagiaires: { $sum: '$nombreStagiaires' },
                    totalSuperviseurs: { $sum: 1 },
                    details: { $push: { superviseurId: '$_id', nombreStagiaires: '$nombreStagiaires' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    moyenneStagiairesParSuperviseur: {
                        $cond: [{ $eq: ['$totalSuperviseurs', 0] }, 0, { $divide: ['$totalStagiaires', '$totalSuperviseurs'] }]
                    },
                    totalSuperviseurs: 1,
                    totalStagiaires: 1,
                    details: 1
                }
            }
        ];

        const result = await AffectationFinale.aggregate(pipeline);
        
        const data = result[0] || {
            moyenneStagiairesParSuperviseur: 0,
            totalSuperviseurs: 0,
            totalStagiaires: 0,
            details: []
        };

        return res.status(200).json({
            success: true,
            data
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
        // 1. Définir les limites de date précises (début/fin de journée)
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);

        // --- Pipeline d'agrégation unique sur AffectationFinale ---
        const dureesStagesResult = await AffectationFinale.aggregate([
            {
                $facet: {
                    // Stages Individuels (stagiaire: non null, groupe: null)
                    individuels: [
                        { $match: { stagiaire: { $exists: true, $ne: null }, groupe: null } },
                        
                        // 💡 ÉTAPE CRUCIALE : Récupérer le StageID.
                        // On suppose que pour un stage individuel, l'ID du stage est dans un champ 'stage' de AffectationFinale.
                        // Si l'ID du stage n'est pas dans AffectationFinale, il faut le récupérer via une autre collection.
                        // Pour l'instant, on suppose que l'ID est dans un champ 'stageId' ou 'stage' sur AffectationFinale.
                        // Si le champ n'existe pas, nous devons le déduire du stagiaire ou d'une autre rotation/affectation initiale.
                        // Cependant, le cas le plus courant est que AffectationFinale contient l'ID du Stage.
                        // POUR LA CORRECTION, NOUS ALLONS SUPPOSER L'EXISTENCE DU CHAMP 'stage' DANS AFFECTATIONFINALE POUR LES INDIVIDUELS.
                        
                        // 1. Lookup vers la collection 'stages'
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'stage', // 💡 ASSUMPTION: 'stage' est le champ ID du stage dans AffectationFinale
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 2. Filtrer sur les VRAIES dates du Stage
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                // Calcul de la durée en jours basée sur stageInfo
                                dureeEnJours: {
                                    $divide: [{ $subtract: ['$stageInfo.dateFin', '$stageInfo.dateDebut'] }, 1000 * 60 * 60 * 24]
                                }
                            }
                        }
                    ],
                    // Stages de Groupe (groupe: non null, stagiaire: null)
                    groupes: [
                        { $match: { groupe: { $exists: true, $ne: null }, stagiaire: null } },
                        
                        // 1. Lookup vers la collection 'groupes' pour obtenir l'ID du Stage
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },

                        // 2. Lookup vers la collection 'stages' pour obtenir les dates
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'groupeInfo.stage', // stage ID vient du document Groupe
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 3. Filtrer sur les VRAIES dates du Stage
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        
                        {
                            $project: {
                                _id: 1,
                                // Calcul de la durée en jours basée sur stageInfo
                                dureeEnJours: {
                                    $divide: [{ $subtract: ['$stageInfo.dateFin', '$stageInfo.dateDebut'] }, 1000 * 60 * 60 * 24]
                                }
                            }
                        }
                    ]
                }
            },
            // Fusionner les résultats des deux facettes
            {
                $project: {
                    toutesDurees: { $concatArrays: ["$individuels", "$groupes"] }
                }
            },
            { $unwind: "$toutesDurees" },
            
            // Regrouper pour calculer la somme totale des jours et le nombre total de stages
            {
                $group: {
                    _id: null,
                    totalJours: { $sum: '$toutesDurees.dureeEnJours' },
                    totalStages: { $sum: 1 } // Chaque élément unwindé est une affectation valide
                }
            },
            // Calculer la moyenne finale
            {
                $project: {
                    _id: 0,
                    moyenneEnMois: {
                        $cond: [
                            { $eq: ['$totalStages', 0] },
                            0,
                            // (Total Jours / Total Stages) / 30
                            { $divide: [{ $divide: ['$totalJours', '$totalStages'] }, 30] }
                        ]
                    }
                }
            }
        ]);

        const data = dureesStagesResult[0] || { moyenneEnMois: 0 };
        
        return res.status(200).json({
            success: true,
            dureeMoyenneMois: data.moyenneEnMois.toFixed(2)
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
        // 💡 CORRECTION : Définir les limites de date précises (début/fin de journée)
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0); // Début du jour

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999); // Fin du jour

        // Le filtre s'applique directement sur la collection Stage, où les dates sont stockées
        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const result = await Stage.aggregate([
            { $match: matchStage }, // Filtrer les stages par la période définie
            {
                $group: {
                    _id: '$statut', // Regrouper par le champ 'statut' du stage
                    count: { $sum: 1 } // Compter le nombre de stages dans chaque statut
                }
            }
        ]);

        const totalStages = result.reduce((acc, cur) => acc + cur.count, 0);
        
        // Convertir le résultat en map pour faciliter l'accès aux comptes
        const map = result.reduce((acc, cur) => {
            acc[cur._id] = cur.count;
            return acc;
        }, {});

        // Calcul des taux pour chaque statut
        const tauxAccepte = totalStages > 0 ? (map.ACCEPTE || 0) / totalStages : 0;
        const tauxRefuse = totalStages > 0 ? (map.REFUSE || 0) / totalStages : 0;
        const tauxEnAttente = totalStages > 0 ? (map.EN_ATTENTE || 0) / totalStages : 0;
        // Vous pouvez ajouter d'autres statuts si nécessaire (ex: EN_COURS, TERMINE, ANNULE...)

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
        // 1. Définir les limites de date précises
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);

        // 💡 ASSUMPTION: L'ID du structure est dans AffectationFinale.structure
        // 💡 ASSUMPTION: L'ID du stage est dans AffectationFinale.stage pour les individus
        
        const pipeline = [
            {
                $facet: {
                    // Stagiaires individuels
                    individuels: [
                        { $match: { stagiaire: { $exists: true, $ne: null }, groupe: null, structure: { $exists: true, $ne: null } } },
                        
                        // 1. Lookup Stage pour les VRAIES dates et le filtre
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'stage',
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 2. FILTRE par dates réelles du Stage
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        {
                            $project: {
                                structure: '$structure',
                                stagiaires: ['$stagiaire']
                            }
                        }
                    ],
                    // Stagiaires de groupe
                    groupes: [
                        { $match: { groupe: { $exists: true, $ne: null }, stagiaire: null, structure: { $exists: true, $ne: null } } },
                        
                        // 1. Lookup Groupe
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },

                        // 2. Lookup Stage pour les VRAIES dates et le filtre
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'groupeInfo.stage',
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 3. FILTRE par dates réelles du Stage
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        {
                            $project: {
                                structure: '$structure',
                                stagiaires: '$groupeInfo.stagiaires' 
                            }
                        }
                    ]
                }
            },
            // Fusionner les résultats
            {
                $project: {
                    tousLesStages: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStages' },
            
            // Regrouper par structure et consolider TOUS les IDs de stagiaires
            {
                $group: {
                    _id: '$tousLesStages.structure',
                    stagiairesListes: { $push: '$tousLesStages.stagiaires' }
                }
            },
            
            // Calculer le nombre de stagiaires uniques par structure
            {
                $project: {
                    structureId: '$_id',
                    stagiairesUniques: {
                        $setUnion: {
                            $reduce: {
                                input: '$stagiairesListes',
                                initialValue: [],
                                in: { $concatArrays: ['$$value', '$$this'] } 
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    structureId: '$structureId',
                    nombreStagiaires: { $size: '$stagiairesUniques' }
                }
            },
            
            // 💡 CORRECTION : Lookup vers la collection 'structures' pour obtenir les noms
            {
                $lookup: {
                    from: 'structures', // ASSUMPTION : nom de la collection de la structures
                    localField: 'structureId',
                    foreignField: '_id',
                    as: 'structureDetails'
                }
            },
            { 
                $unwind: { 
                    path: '$structureDetails', 
                    preserveNullAndEmptyArrays: true // S'assurer qu'on garde les structures même si le lookup échoue
                } 
            },
            
            // 💡 CORRECTION : Projection finale pour retourner le structureId et les noms
            {
                $project: {
                    _id: 0,
                    structureId: '$structureId',
                    nombreStagiaires: '$nombreStagiaires',
                    // Récupération des noms, avec fallback au cas où le lookup ne trouve rien
                    nomFr: { $ifNull: ['$structureDetails.nomFr', 'Inconnu (FR)'] },
                    nomEn: { $ifNull: ['$structureDetails.nomEn', 'Unknown (EN)'] },
                }
            },
            // Optionnel : Trier par nombre de stagiaires
            { $sort: { nombreStagiaires: -1 } }
        ];

        const repartition = await AffectationFinale.aggregate(pipeline); 

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
        // 1. Définir les limites de date précises et l'heure actuelle
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);
        
        const now = new Date(); 
        
        const initialMatch = { superviseur: { $exists: true, $ne: null } };

        const pipeline = [
            // Étape 1: Traiter les stages individuels et de groupe en parallèle et filtrer par dates de STAGE
            {
                $facet: {
                    // Stagiaires individuels
                    individuels: [
                        { $match: { ...initialMatch, stagiaire: { $exists: true, $ne: null }, groupe: null } },
                        
                        // 1. Lookup Stage pour les VRAIES dates et le filtre
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'stage',
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 2. FILTRE par dates réelles du Stage sur la PÉRIODE
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        // 3. Projection pour le regroupement et le statut du stage
                        {
                            $project: {
                                superviseur: '$superviseur',
                                stagiaires: ['$stagiaire'],
                                isEnCours: { 
                                    $cond: [
                                        { $and: [
                                            { $lte: ['$stageInfo.dateDebut', now] },
                                            { $gt: ['$stageInfo.dateFin', now] }
                                        ]},
                                        1, 0
                                    ]
                                },
                                isTermine: { 
                                    $cond: [
                                        { $lt: ['$stageInfo.dateFin', now] },
                                        1, 0
                                    ]
                                }
                            }
                        }
                    ],
                    // Stagiaires de groupe
                    groupes: [
                        { $match: { ...initialMatch, groupe: { $exists: true, $ne: null }, stagiaire: null } },
                        
                        // 1. Lookup Groupe
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupe',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: { path: '$groupeInfo', preserveNullAndEmptyArrays: false } },

                        // 2. Lookup Stage pour les VRAIES dates et le filtre
                        {
                            $lookup: {
                                from: 'stages',
                                localField: 'groupeInfo.stage',
                                foreignField: '_id',
                                as: 'stageInfo'
                            }
                        },
                        { $unwind: { path: '$stageInfo', preserveNullAndEmptyArrays: false } },
                        
                        // 3. FILTRE par dates réelles du Stage sur la PÉRIODE
                        {
                            $match: {
                                'stageInfo.dateDebut': { $lte: dateFinFilter },
                                'stageInfo.dateFin': { $gte: dateDebutFilter }
                            }
                        },
                        // 4. Projection pour le regroupement et le statut du stage
                        {
                            $project: {
                                superviseur: '$superviseur',
                                stagiaires: '$groupeInfo.stagiaires',
                                isEnCours: { 
                                    $cond: [
                                        { $and: [
                                            { $lte: ['$stageInfo.dateDebut', now] },
                                            { $gt: ['$stageInfo.dateFin', now] }
                                        ]},
                                        1, 0
                                    ]
                                },
                                isTermine: { 
                                    $cond: [
                                        { $lt: ['$stageInfo.dateFin', now] },
                                        1, 0
                                    ]
                                }
                            }
                        }
                    ]
                }
            },
            // Étape 2: Fusionner les résultats des deux pipelines
            {
                $project: {
                    tousLesStages: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStages' },
            
            // Étape 3: Regrouper par superviseur, consolider les IDs de stagiaires et SOMMER les statuts de stages
            {
                $group: {
                    _id: '$tousLesStages.superviseur',
                    stagiairesListes: { $push: '$tousLesStages.stagiaires' },
                    totalStagesEnCours: { $sum: '$tousLesStages.isEnCours' },
                    totalStagesTermines: { $sum: '$tousLesStages.isTermine' }
                }
            },

            // Étape 4: Calculer le nombre de stagiaires UNIQUES
            {
                $project: {
                    superviseurId: '$_id',
                    totalStagesEnCours: 1,
                    totalStagesTermines: 1,
                    nombreStagiairesUniques: {
                        $size: {
                            $setUnion: {
                                $reduce: {
                                    input: '$stagiairesListes',
                                    initialValue: [],
                                    in: { $concatArrays: ['$$value', '$$this'] } 
                                }
                            }
                        }
                    }
                }
            },

            // Étape 5: Joindre les informations des superviseurs
            {
                $lookup: {
                    from: 'utilisateurs', // 💡 CORRECTION : Utilisation de la collection 'utilisateurs'
                    localField: 'superviseurId',
                    foreignField: '_id',
                    as: 'superviseurInfo'
                }
            },
            { 
                $unwind: { 
                    path: '$superviseurInfo', 
                    preserveNullAndEmptyArrays: true
                } 
            },

            // Étape 6: Projetter le résultat final (nom et prénom du superviseur)
            {
                $project: {
                    _id: 0,
                    superviseur: {
                        _id: '$superviseurId',
                        nom: { $ifNull: ['$superviseurInfo.nom', 'Inconnu'] }, // 💡 Utilisation du champ 'nom'
                        prenom: { $ifNull: ['$superviseurInfo.prenom', 'Superviseur'] } // 💡 Utilisation du champ 'prenom'
                    },
                    nombreStagiairesUniques: '$nombreStagiairesUniques',
                    totalStagesEnCours: '$totalStagesEnCours',
                    totalStagesTermines: '$totalStagesTermines'
                }
            },
            { $sort: { nombreStagiairesUniques: -1 } }
        ];

        // ASSUMPTION: AffectationFinale est la collection qui contient l'ID du superviseur
        const repartition = await AffectationFinale.aggregate(pipeline);

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
        // 1. Définir les limites de date précises (début/fin de journée)
        const dateDebutFilter = new Date(dateDebut);
        dateDebutFilter.setHours(0, 0, 0, 0);

        const dateFinFilter = new Date(dateFin);
        dateFinFilter.setHours(23, 59, 59, 999);

        // Le filtre de période s'applique directement sur la collection Stage
        const matchStage = {
            dateDebut: { $lte: dateFinFilter },
            dateFin: { $gte: dateDebutFilter }
        };

        const pipeline = [
            // Étape 1: Filtrer les stages par la période demandée
            { $match: matchStage }, 

            // Étape 2: Identifier tous les stagiaires (individuels et de groupe) impliqués dans ces stages
            {
                $project: {
                    _id: 0,
                    stagiaireId: '$stagiaire', // Stagiaire individuel
                    groupeId: '$groupe',       // Groupe de stagiaires
                }
            },
            
            // Étape 3: Transformer les stages de groupe en IDs de stagiaires individuels (si groupe existe)
            {
                $facet: {
                    individuels: [
                        { $match: { stagiaireId: { $ne: null } } },
                        { $project: { stagiaireId: '$stagiaireId' } }
                    ],
                    groupes: [
                        { $match: { groupeId: { $ne: null } } },
                        {
                            $lookup: {
                                from: 'groupes',
                                localField: 'groupeId',
                                foreignField: '_id',
                                as: 'groupeInfo'
                            }
                        },
                        { $unwind: '$groupeInfo' },
                        { $unwind: '$groupeInfo.stagiaires' },
                        { $project: { stagiaireId: '$groupeInfo.stagiaires' } } // Renvoyer chaque stagiaire du groupe
                    ]
                }
            },

            // Étape 4: Fusionner les résultats individuels et groupes
            {
                $project: {
                    tousLesStagiaires: { $concatArrays: ['$individuels', '$groupes'] }
                }
            },
            { $unwind: '$tousLesStagiaires' },
            { $replaceRoot: { newRoot: '$tousLesStagiaires' } }, // Le document contient maintenant l'ID du stagiaire: { stagiaireId: ObjectId(...) }
            
            // Étape 5: Joindre les informations du Stagiaire (Utilisateur Base)
            {
                $lookup: {
                    from: 'baseutilisateurs', // 💡 CORRECTION: Collection du modèle de base
                    localField: 'stagiaireId',
                    foreignField: '_id',
                    as: 'stagiaireInfo'
                }
            },
            { $unwind: '$stagiaireInfo' },
            
            // Étape 6: Regrouper par ID d'établissement et collecter les IDs UNIQUES des stagiaires
            {
                $unwind: '$stagiaireInfo.parcours', // Déconstruire le tableau des parcours
            },
            {
                // Regrouper par l'ID de l'établissement trouvé dans n'importe quel parcours du stagiaire
                $group: {
                    _id: '$stagiaireInfo.parcours.etablissement', 
                    stagiairesUniques: { $addToSet: '$stagiaireId' } // IDs des stagiaires uniques qui ont cet établissement dans leur parcours
                }
            },

            // Étape 7: Compter les stagiaires uniques et joindre les détails de l'établissement
            {
                $project: {
                    etablissementId: '$_id',
                    nombreStagiaires: { $size: '$stagiairesUniques' }
                }
            },
            {
                $lookup: {
                    from: 'etablissements', 
                    localField: 'etablissementId',
                    foreignField: '_id',
                    as: 'etablissementInfo'
                }
            },
            { 
                $unwind: { 
                    path: '$etablissementInfo', 
                    preserveNullAndEmptyArrays: true
                } 
            },

            // Étape 8: Projection finale
            {
                $project: {
                    _id: 0,
                    etablissement: {
                        _id: '$etablissementId',
                        nom: { $ifNull: ['$etablissementInfo.nom', 'Établissement Inconnu'] }
                    },
                    nombreStagiaires: 1
                }
            },
            { $sort: { nombreStagiaires: -1 } }
        ];

        // Exécuter l'agrégation sur la collection Stage (la source des dates)
        const repartition = await Stage.aggregate(pipeline); 

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
