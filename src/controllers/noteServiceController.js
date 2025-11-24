// controllers/noteServiceController.js
import NoteService from '../models/NoteService.js';
import StageRecherche from '../models/StageRecherche.js'; // Assurez-vous d'avoir ce modèle
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { t } from '../utils/i18n.js';
import mongoose from "mongoose";
import { getLogoBase64 } from '../utils/logoBase64.js';
import { AffectationFinale } from '../models/AffectationFinale.js';
import Stage from '../models/Stage.js';
import Utilisateur from '../models/Utilisateur.js';
import { Rotation } from '../models/Rotation.js';
import { Formateur } from '../models/Formateur.js';
import { LieuFormation } from '../models/LieuFormation.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import ThemeFormation from '../models/ThemeFormation.js';

import { mettreAJourTache } from '../services/tacheThemeFormationService.js';
import PosteDeTravail from '../models/PosteDeTravail.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Génère une référence automatique pour la note de service
 */
const genererReference = async () => {
    const anneeActuelle = new Date().getFullYear();
    const moisActuel = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Compter le nombre de notes de service créées cette année
    const nombreNotes = await NoteService.countDocuments({
        createdAt: {
            $gte: new Date(`${anneeActuelle}-01-01`),
            $lt: new Date(`${anneeActuelle + 1}-01-01`)
        }
    });
    
    const numeroSequentiel = String(nombreNotes + 1).padStart(4, '0');
    return `NS/${numeroSequentiel}/DGI/${moisActuel}/${anneeActuelle}`;
};



/**
 * Crée une nouvelle note de service et génère automatiquement le PDF
 */
export const creerNoteService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            theme,
            stage,
            mandat,
            typeNote,
            titreFr,
            titreEn,
            copieA,
            creePar,
            designationTuteur,
            miseEnOeuvre
        } = req.body;

        // Validation des données requises
        if (!typeNote || !['convocation', 'acceptation_stage', 'mandat'].includes(typeNote)) {
            return res.status(400).json({
                success: false,
                message: t('type_note_invalide', lang)
            });
        }

        if (typeNote === 'mandat' && !mandat) {
            return res.status(400).json({
                success: false,
                message: t('ref_mandat_requis', lang)
            });
        }

        if (typeNote === 'acceptation_stage' && !stage) {
            return res.status(400).json({
                success: false,
                message: t('ref_stage_requis', lang)
            });
        }

        if (typeNote === 'convocation' && !theme) {
            return res.status(400).json({
                success: false,
                message: t('ref_theme_requis', lang)
            });
        }

        // Générer la référence automatiquement
        const reference = await genererReference();

        // Créer la note de service (mais pas encore validée)
        const nouvelleNote = new NoteService({
            reference,
            theme,
            stage,
            mandat,
            designationTuteur,
            miseEnOeuvre,
            typeNote,
            titreFr,
            titreEn,
            copieA,
            creePar,
            valideParDG: false
        });

        // Sauvegarde dans la transaction
        const noteEnregistree = await nouvelleNote.save({ session });

        // Peupler les références
        if (noteEnregistree.typeNote === 'mandat') {
            await noteEnregistree.populate([
                {
                    path: 'mandat',
                    select: 'chercheur superviseur',
                    populate: [
                        { path: 'superviseur', select: 'nom prenom titre posteDeTravail service',
                            populate:[
                                {path:'posteDeTravail', select:"nomFr nomEn"},
                                {path:'service', select:"nomFr nomEn"}
                            ]
                         },
                        { path: 'chercheur', select: 'nom prenom etablissement doctorat domaineRecherche genre',
                            populate:{
                                path:'etablissement',
                                select:'nomFr nomEn'
                            }
                         }
                    ]
                },
                {
                    path: 'creePar',
                    select: 'nom prenom email'
                }
            ]);
        }
        
        if (noteEnregistree.typeNote === 'stage') {
            await noteEnregistree.populate([
                {
                    path: 'stage',
                    select: 'stagiaire superviseur',
                    populate: [
                        { path: 'superviseur', select: 'nom prenom titre posteDeTravail service',
                            populate:[
                                {path:'posteDeTravail', select:"nomFr nomEn"},
                                {path:'service', select:"nomFr nomEn"}
                            ]
                         },
                        { path: 'chercheur', select: 'nom prenom etablissement doctorat domaineRecherche genre',
                            populate:{
                                path:'etablissement',
                                select:'nomFr nomEn'
                            }
                         }
                    ]
                },
                {
                    path: 'creePar',
                    select: 'nom prenom email'
                }
            ]);
        }

        // Générer automatiquement le PDF selon le type
        const pdfBuffer = await genererPDFSelonType(noteEnregistree, lang);

        // Définir le nom du fichier PDF
        const nomFichier = `note-service-${typeNote}-${reference.replace(/\//g, '-')}.pdf`;

        // Valider la transaction uniquement si le PDF a été généré
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF en réponse
        res.set({
            'success':true,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la création de la note de service:', error);

        // Annuler la transaction si erreur
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};

/**
 * Crée une nouvelle note de service pour un stage et génère le PDF
 */
export const creerNoteServiceStage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            stage,
            titreFr,
            titreEn,
            copieA,
            creePar,
            designationTuteur,
            miseEnOeuvre
        } = req.body;

        // Validation
        if (!stage) {
            return res.status(400).json({
                success: false,
                message: t('ref_stage_requis', lang)
            });
        }

        // Vérifier que le stage existe et est de type INDIVIDUEL
        const stageData = await Stage.findById(stage)
            .populate({
                path: 'stagiaire',
                select: 'nom prenom genre parcours',
                populate: {
                    path: 'parcours.etablissement',
                    select: 'nomFr nomEn'
                }
            })
            .lean();

        if (!stageData) {
        
            return res.status(404).json({
                success: false,
                message: t('stage_non_trouve', lang)
            });
        }
        if (stageData.type !== 'INDIVIDUEL') {
            
            return res.status(400).json({
                success: false,
                message: t('stage_type_invalide', lang)
            });
        }

        // Récupérer l'affectation finale du stagiaire
        const affectations = await AffectationFinale.find({ 
            stage: stage,
            stagiaire: stageData.stagiaire._id
        })
        .populate({
            path: 'service',
            select: 'nomFr nomEn'
        })
        .populate({
            path: 'superviseur',
            select: 'nom prenom titre posteDeTravail',
            populate: {
                path: 'posteDeTravail',
                select: 'nomFr nomEn'
            }
        })
        .lean();

        if (!affectations) {
            return res.status(404).json({
                success: false,
                message: t('affectation_non_trouvee', lang)
            });
        }

        // Générer la référence
        const reference = await genererReference();

        // Créer la note de service
        const nouvelleNote = new NoteService({
            reference,
            stage,
            typeNote: 'acceptation_stage',
            titreFr: titreFr || "ACCEPTATION DE STAGE",
            titreEn: titreEn || "INTERNSHIP ACCEPTANCE",
            copieA,
            creePar,
            designationTuteur,
            miseEnOeuvre,
            valideParDG: false
        });
        
        // const noteEnregistree = await nouvelleNote.save({ session });
        const createur = await Utilisateur.findById(creePar).lean();
        // Générer le PDF
        let pdfBuffer;
         if (affectations.length === 1) {
            pdfBuffer = await genererPDFStageIndividuel(
                nouvelleNote, 
                stageData, 
                affectations[0], 
                lang,
                createur
            );
        }else{
            pdfBuffer = await genererPDFStageRotations(
                nouvelleNote, 
                stageData, 
                affectations, 
                lang,
                createur
            );
        }

        

        // Définir le nom du fichier
        const nomFichier = `note-service-stage-${reference.replace(/\//g, '-')}.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });
        
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la création de la note de service stage:', error);

        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Crée une note de service pour un stage de groupe
 */
export const creerNoteServiceStageGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            stage,
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            copieA,
            creePar,
            dispositions,
            personnesResponsables,
            miseEnOeuvre
        } = req.body;

        // Validation
        if (!stage) {
            return res.status(400).json({
                success: false,
                message: t('ref_stage_requis', lang)
            });
        }

        // Vérifier que le stage existe et est de type GROUPE
        const stageData = await Stage.findById(stage)
            .populate({
                path: 'groupes',
                populate: {
                    path: 'stagiaires',
                    select: 'nom prenom genre parcours',
                    populate: {
                        path: 'parcours.etablissement',
                        select: 'nomFr nomEn'
                    }
                }
            })
            .lean();

        if (!stageData) {
            return res.status(404).json({
                success: false,
                message: t('stage_non_trouve', lang)
            });
        }

        if (stageData.type !== 'GROUPE') {
            return res.status(400).json({
                success: false,
                message: t('stage_type_invalide', lang)
            });
        }

        if (!stageData.groupes || stageData.groupes.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_groupe_trouve', lang)
            });
        }

        // Récupérer toutes les rotations pour tous les groupes
        const rotations = await Rotation.find({ 
            stage: stage,
            groupe: { $in: stageData.groupes.map(g => g._id) }
        })
        .populate({
            path: 'service',
            select: 'nomFr nomEn'
        })
        .populate({
            path: 'groupe',
            select: 'numero'
        })
        .sort({ 'groupe.numero': 1, dateDebut: 1 })
        .lean();

        // Récupérer toutes les affectations finales
        const affectations = await AffectationFinale.find({ 
            stage: stage,
            groupe: { $in: stageData.groupes.map(g => g._id) }
        })
        .populate({
            path: 'service',
            select: 'nomFr nomEn'
        })
        .populate({
            path: 'groupe',
            select: 'numero'
        })
        .sort({ 'groupe.numero': 1 })
        .lean();

        // Générer la référence
        const reference = await genererReference();

        // Créer la note de service
        const nouvelleNote = new NoteService({
            reference,
            stage,
            typeNote: 'acceptation_stage',
            titreFr: titreFr || "ACCEPTATION DE STAGE EN GROUPE",
            titreEn: titreEn || "GROUP INTERNSHIP ACCEPTANCE",
            descriptionFr,
            descriptionEn,
            copieA,
            creePar,
            dispositions,
            personnesResponsables,
            miseEnOeuvre,
            valideParDG: false
        });

        const noteEnregistree = await nouvelleNote.save({ session });
        const createur = await Utilisateur.findById(creePar).lean()
        // Générer le PDF
        const pdfBuffer = await genererPDFStageGroupe(
            noteEnregistree, 
            stageData, 
            rotations,
            affectations,
            lang,
            createur
        );

        // Définir le nom du fichier
        const nomFichier = `note-service-stage-groupe-${reference.replace(/\//g, '-')}.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });
        
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la création de la note de service stage groupe:', error);

        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


/**
 * Génère le PDF selon le type de note de service
 */
const genererPDFSelonType = async (note, lang) => {
    try {
        let templateData = {};
        let templatePath = '';

        // Données communes à tous les types
        const donneesCommunes = {
            documentTitle: `Note de Service - ${note.typeNote}`,
            logoUrl: getLogoBase64(__dirname), // Image en base64
            
           
            mandatCopie: note.copieA
                    ? note.copieA.split(/[;,]/)     // découpe sur ; ou ,
                        .map(e => e.trim())         // enlève les espaces autour
                        .filter(e => e.length > 0)  // enlève les vides éventuels
                    : [],
        };

        // Préparer les données selon le type de note
        switch (note.typeNote) {
            case 'mandat':
                templateData = {
                    ...donneesCommunes,
                   
                    userSexe: note.mandat.chercheur?.genre === 'M'?"Monsieur":"Madame",
                    userFullName: `${note.mandat.chercheur?.nom} ${note.mandat.chercheur?.prenom}`,
                    inscrit: note.mandat.chercheur?.genre === 'M'?"inscrit":"inscrite",
                    userDoctorat: note.mandat.chercheur?.doctorat || "__________",
                    userUniversity: note.mandat.chercheur?.etablissement?.nomFr || "___________",
                    userTheme: note.mandat?.chercheur.domaineRecherche || "______________",
                    userSupervisorSexe: note.mandat.superviseur?.genre === 'M'?"Monsieur":"Madame",
                    userSupervisorFullName: `${note.mandat.superviseur?.nom} ${note.mandat.superviseur?.prenom}`,
                    userSupervisorPoste: note.mandat.superviseur?.posteDeTravail?.nomFr || "______________",
                    userSupervisorStructure: note.mandat.superviseur?.service?.nomFr || "______________"
                };
                templatePath = path.join(__dirname, '../views/note-service-mandat.ejs');
                break;

            case 'acceptation_stage':
                templateData = {
                    ...donneesCommunes,
                    noteTitle: lang==='fr'?note.titreFr || "ACCEPTATION DE STAGE":note.titreEn||"INTERNSHIP ACCEPTANCE",
                    stageTitre: note.stage?.titre || "Stage",
                    userSexe: note.stage?.stagiaire?.genre === 'M'?"Monsieur":"Madame",
                    stagiaire: note.stage?.stagiaire?.genre === 'M'?"le":"la",
                    leditStagiaire: note.stage?.stagiaire?.genre === 'M'?"du dit":"de ladite",
                    userFullName: `${note.stage?.stagiaire?.nom} ${note.stage?.stagiaire?.prenom}`,
                    userUniversity: note.stage?.stagiaire?.etablissement || "_______________",
                    niveau: note.stage?.stagiaire?.niveau || "______________",
                    filiere: note.stage?.stagiaire?.filiere || "______________",
                    dateDebut: note.stage?.dateDebut ? 
                        new Date(note.stage.dateDebut).toLocaleDateString('fr-FR') : '',
                    dateFin: note.stage?.dateFin ? 
                        new Date(note.stage.dateFin).toLocaleDateString('fr-FR') : '',
                    superviseurNom: `${note.stage?.superviseur?.nom} ${note.stage?.superviseur?.prenom}`,
                    superviseurPoste: note.stage?.superviseur?.poste || "Encadreur",
                    userService: "________________",
                    designationTuteur:note?.designationTuteur || "_____________",
                    miseEnOeuvre:note?.miseEnOeuvre || "_____________"
                };
                templatePath = path.join(__dirname, '../views/note-service-stage_individuel_1.ejs');
                break;

            case 'convocation':
                templateData = {
                    ...donneesCommunes,
                    titreFr: note.titreFr || "CONVOCATION",
                    titreEn: note.titreEn || "CONVOCATION",
                    themeLibelle: note.theme?.libelle || "Formation",
                    themeDescription: note.theme?.description || "",
                    dateDebut: note.theme?.dateDebut ? 
                        new Date(note.theme.dateDebut).toLocaleDateString('fr-FR') : '',
                    dateFin: note.theme?.dateFin ? 
                        new Date(note.theme.dateFin).toLocaleDateString('fr-FR') : '',
                    lieu: note.theme?.lieu || "Siège de la DGI"
                };
                templatePath = path.join(__dirname, '../views/note-service-convocation.ejs');
                break;

            default:
                throw new Error(`Type de note non supporté: ${note.typeNote}`);
        }

        // Générer le HTML à partir du template EJS
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF avec Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',     // Marges normales puisque le header est dans le template
                right: '20px',
                bottom: '60px',  // Espace pour le footer seulement
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Header vide - utilise celui du template
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <!-- Partie gauche du footer -->
                    <div style="text-align: left; flex: 1;">
                        Généré par ${(note.creePar.nom+" "+note.creePar?.prenom ||"") || 'Système'}
                    </div>
                    
                    <!-- Partie droite du footer -->
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        throw error;
    }
};

/**
 * Génère le PDF pour un stage individuel avec une seule affectation
 */
const genererPDFStageIndividuel = async (note, stageData, affectations, lang, createur) => {
    console.log("debut de la génration");
    try {
        // Récupérer le parcours le plus récent du stagiaire
        const parcoursActuel = stageData.stagiaire.parcours && stageData.stagiaire.parcours.length > 0
            ? stageData.stagiaire.parcours[stageData.stagiaire.parcours.length - 1]
            : null;

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Acceptation de Stage',
            logoUrl: getLogoBase64(__dirname),
            
            // Titre de la note
            noteTitle: lang === 'fr' 
                ? (note.titreFr || "ACCEPTATION DE STAGE")
                : (note.titreEn || "INTERNSHIP ACCEPTANCE"),
            
            // Informations du stagiaire
            userSexe: stageData.stagiaire.genre === 'M' ? "Monsieur" : "Madame",
            etudiant: stageData.stagiaire.genre === 'M' ? "étudiant" : "étudiante",
            stagiaire: stageData.stagiaire.genre === 'M' ? "le stagiaire" : "la stagiaire",
            leditStagiaire: stageData.stagiaire.genre === 'M' ? "dudit stagiaire" : "de ladite stagiaire",
            userFullName: `${stageData.stagiaire.nom} ${stageData.stagiaire.prenom || ''}`.trim(),
            
            // Informations académiques
            userUniversity: parcoursActuel?.etablissement 
                ? (lang === 'fr' ? parcoursActuel.etablissement.nomFr : parcoursActuel.etablissement.nomEn)
                : "______________",
            niveau: parcoursActuel?.niveau || "______________",
            filiere: parcoursActuel?.filiere || "______________",
            
            // Informations d'affectations
            userService: affectations.service 
                ? (lang === 'fr' ? affectations.service.nomFr : affectations.service.nomEn)
                : "________________",
            dateDebut: affectations.dateDebut 
                ? new Date(affectations.dateDebut).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '______________',
            dateFin: affectations.dateFin 
                ? new Date(affectations.dateFin).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '______________',
            
            // Superviseur (optionnel)
            superviseurNom: affectations.superviseur 
                ? `${affectations.superviseur.nom} ${affectations.superviseur.prenom || ''}`.trim()
                : null,
            superviseurPoste: affectations.superviseur?.posteDeTravail 
                ? (lang === 'fr' ? affectations.superviseur.posteDeTravail.nomFr : affectations.superviseur.posteDeTravail.nomEn)
                : null,
            
            // Autres informations
            designationTuteur: note.designationTuteur || "___________________",
            miseEnOeuvre: note.miseEnOeuvre || "___________________________",
            
            // Copie
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)', 'Archives/Chrono'],
            
            // Créateur
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',

            //Date et heure
            dateTime:new Date().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour:'numeric',
                    minute:'numeric',
                })
        };
        console.log("début du chargement du template")
        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-stage-individuel-1.ejs');
        const html = await ejs.renderFile(templatePath, templateData);
        console.log("fin du chargement du template")
        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        console.log("fin utilisation puppeteer")
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: center; flex: 1;">
                        Le ${templateData.dateTime}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        console.log("fin de la génération")
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF stage individuel:', error);
        throw error;
    }
};


/**
 * Génère le PDF pour un stage individuel avec plusieurs rotations
 */
const genererPDFStageRotations = async (note, stageData, affectations, lang, createur) => {
    try {
        // Récupérer le parcours le plus récent du stagiaire
        const parcoursActuel = stageData.stagiaire.parcours && stageData.stagiaire.parcours.length > 0
            ? stageData.stagiaire.parcours[stageData.stagiaire.parcours.length - 1]
            : null;

        // Formater les rotations pour le template
        const rotationsFormatees = affectations.map((affectation, index) => {
            const dateDebut = new Date(affectation.dateDebut).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            const dateFin = new Date(affectation.dateFin).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const nomService = affectation.service 
                ? (lang === 'fr' ? affectation.service.nomFr : affectation.service.nomEn)
                : "Service non défini";

            return {
                numero: index + 1,
                periode: `Du ${dateDebut} au ${dateFin}`,
                service: nomService,
                superviseur: affectation.superviseur 
                    ? `${affectation.superviseur.nom} ${affectation.superviseur.prenom || ''}`.trim()
                    : null
            };
        });

        // Calculer la période globale du stage
        const dateDebutStage = new Date(affectations[0].dateDebut).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        const dateFinStage = new Date(affectations[affectations.length - 1].dateFin).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Acceptation de Stage avec Rotations',
            logoUrl: getLogoBase64(__dirname),
            
            // Titre de la note
            noteTitle: lang === 'fr' 
                ? (note.titreFr || "ACCEPTATION DE STAGE")
                : (note.titreEn || "INTERNSHIP ACCEPTANCE"),
            
            // Informations du stagiaire
            userSexe: stageData.stagiaire.genre === 'M' ? "Monsieur" : "Madame",
            stagiaire: stageData.stagiaire.genre === 'M' ? "le stagiaire" : "la stagiaire",
            leditStagiaire: stageData.stagiaire.genre === 'M' ? "dudit stagiaire" : "de ladite stagiaire",
            userFullName: `${stageData.stagiaire.nom} ${stageData.stagiaire.prenom || ''}`.trim(),
            
            // Informations académiques
            userUniversity: parcoursActuel?.etablissement 
                ? (lang === 'fr' ? parcoursActuel.etablissement.nomFr : parcoursActuel.etablissement.nomEn)
                : "______________",
            niveau: parcoursActuel?.niveau || "______________",
            filiere: parcoursActuel?.filiere || "______________",
            
            // Période globale
            dateDebutStage,
            dateFinStage,
            
            // Rotations
            rotations: rotationsFormatees,
            nombreRotations: rotationsFormatees.length,
            
            // Autres informations
            directeursEnCharge: note.miseEnOeuvre || "______________________________",
            
            // Copie
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)', 'Directeurs concernés', 'Archives/Chrono'],
            
            // Créateur
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-stage-individuel-2.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF stage rotations:', error);
        throw error;
    }
};

/**
 * Génère le PDF pour un stage de groupe avec chronogramme
 */
const genererPDFStageGroupe = async (note, stageData, rotations, affectations, lang, createur) => {
    try {
        // Préparer le tableau des stagiaires par groupe
        const groupesAvecStagiaires = stageData.groupes.map(groupe => {
            return {
                numero: groupe.numero,
                stagiaires: groupe.stagiaires.map((stagiaire, index) => ({
                    nom: stagiaire.nom,
                    prenom: stagiaire.prenom || '',
                    numero: index + 1
                })),
                nombreStagiaires: groupe.stagiaires.length
            };
        }).sort((a, b) => a.numero - b.numero);

        // Construire le chronogramme des rotations
        // Structure: { serviceId: { groupeNumero: { dateDebut, dateFin } } }
        const chronogrammeRotations = {};
        const servicesSet = new Set();

        rotations.forEach(rotation => {
            const serviceId = rotation.service._id.toString();
            const serviceNom = lang === 'fr' ? rotation.service.nomFr : rotation.service.nomEn;
            const groupeNumero = rotation.groupe.numero;

            if (!chronogrammeRotations[serviceId]) {
                chronogrammeRotations[serviceId] = {
                    serviceNom,
                    groupes: {}
                };
            }

            chronogrammeRotations[serviceId].groupes[groupeNumero] = {
                dateDebut: new Date(rotation.dateDebut).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }),
                dateFin: new Date(rotation.dateFin).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
            };

            servicesSet.add(serviceId);
        });

        // Construire le tableau des affectations finales
        const affectationsFinalesParGroupe = {};
        affectations.forEach(affectation => {
            const groupeNumero = affectation.groupe.numero;
            const serviceNom = lang === 'fr' ? affectation.service.nomFr : affectation.service.nomEn;
            
            if (!affectationsFinalesParGroupe[groupeNumero]) {
                affectationsFinalesParGroupe[groupeNumero] = [];
            }

            affectationsFinalesParGroupe[groupeNumero].push({
                service: serviceNom,
                dateDebut: new Date(affectation.dateDebut).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }),
                dateFin: new Date(affectation.dateFin).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
            });
        });

        // Obtenir la liste des numéros de groupe
        const numerosGroupes = [...new Set(stageData.groupes.map(g => g.numero))].sort((a, b) => a - b);

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Acceptation de Stage en Groupe',
            logoUrl: getLogoBase64(__dirname),
            
            // Titre et description
            noteTitle: lang === 'fr' 
                ? (note.titreFr || "ACCEPTATION DE STAGE EN GROUPE")
                : (note.titreEn || "GROUP INTERNSHIP ACCEPTANCE"),
            description: lang === 'fr' ? note.descriptionFr : note.descriptionEn,
            
            // Tableau des stagiaires
            groupesAvecStagiaires,
            
            // Dispositions
            dispositions: note.dispositions
                ? note.dispositions.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : [],
            
            // Responsables
            personnesResponsables: note.personnesResponsables || "Les Chefs de Service concernés",
            miseEnOeuvre: note.miseEnOeuvre || "Les Directeurs concernés",
            
            // Chronogramme
            chronogrammeRotations,
            servicesIds: Array.from(servicesSet),
            numerosGroupes,
            
            // Affectations finales
            affectationsFinalesParGroupe,
            
            // Copie
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],
            
            // Créateur
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-stage-groupe.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true, // Format paysage pour les tableaux larges
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF stage groupe:', error);
        throw error;
    }
};
    /**
 * Génère le PDF d'une note de service existante (endpoint séparé si besoin)
 */
export const genererPDFNote = async (req, res) => {
    try {
        const { noteId } = req.params;

        // Récupérer la note de service avec toutes les relations
        const note = await NoteService.findById(noteId)
            .populate([
                { 
                    path: 'theme', 
                    select: 'libelle description dateDebut dateFin lieu' 
                },
                { 
                    path: 'stage', 
                    select: 'titre dateDebut dateFin stagiaire superviseur structure',
                    populate: [
                        { path: 'stagiaire', select: 'nom prenom email etablissement niveau' },
                        { path: 'superviseur', select: 'nom prenom titre poste structure' }
                    ]
                },
                { 
                    path: 'mandat', 
                    select: 'theme directeur superviseur chercheur',
                    populate: [
                        { path: 'theme', select: 'libelle description' },
                        { path: 'directeur', select: 'nom prenom titre' },
                        { path: 'superviseur', select: 'nom prenom titre poste structure' },
                        { path: 'chercheur', select: 'nom prenom etablissement doctorat genre' }
                    ]
                },
                { path: 'creePar', select: 'nom prenom email' }
            ]);

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note de service non trouvée'
            });
        }

        // Générer le PDF
        const pdfBuffer = await genererPDFSelonType(note);

        // Définir le nom du fichier PDF
        const nomFichier = `note-service-${note.typeNote}-${note.reference.replace(/\//g, '-')}.pdf`;
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du PDF',
                error: error.message
            });
        }
    }
};

/**
 * Crée une note de service pour convoquer les formateurs d'un thème
 */
export const creerNoteServiceConvocationFormateurs = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            theme,
            titreFr,
            titreEn,
            descriptionFr,
            descriptionEn,
            copieA,
            creePar,
            tacheFormationId 
        } = req.body;

        // Validation du thème
        if (!theme) {
            return res.status(400).json({
                success: false,
                message: t('theme_requis', lang)
            });
        }

        if (!mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // Vérifier que le thème existe
        const themeData = await ThemeFormation.findById(theme)
            .select('libelleFr libelleEn dateDebut dateFin lieu')
            .lean();

        if (!themeData) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Récupérer les formateurs du thème
        const formateurs = await Formateur.find({ theme: theme })
            .populate({
                path: 'utilisateur',
                select: 'nom prenom',
            }).lean();

        if (!formateurs || formateurs.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('formateur_non_trouve', lang)
            });
        }

        // Récupérer les infos du créateur
        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }


        // Créer la note de service
        const nouvelleNote = new NoteService({
            theme,
            typeNote: 'convocation',
            titreFr: titreFr || "CONVOCATION",
            titreEn: titreEn || "CONVOCATION",
            descriptionFr,
            descriptionEn,
            copieA,
            creePar,
            valideParDG: false
        });

        const noteEnregistree = await nouvelleNote.save({ session });

        if (tacheFormationId) {
            mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar:creePar,
                session
            });
        }

        // Générer le PDF
        const pdfBuffer = await genererPDFConvocationFormateurs(
            noteEnregistree,
            themeData,
            formateurs,
            lang,
            createur
        );

        // Nom du fichier
        const nomFichier = `note-service-convocation.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la création de la note de convocation:', error);

        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


/**
 * Génère le PDF pour la convocation des formateurs
 */
const genererPDFConvocationFormateurs = async (note, themeData, formateurs, lang, createur) => {
    try {
        // Préparer la liste des formateurs
        const formateursListe = formateurs.map((formateur, index) => {
            const utilisateur = formateur.utilisateur;
            
            
            // Construire le nom complet
            const nomComplet = `${utilisateur.nom} ${utilisateur.prenom || ''}`.trim();
            
            
            return {
                numero: index + 1,
                nomComplet,
            };
        });
        

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Convocation des Formateurs',
            logoUrl: getLogoBase64(__dirname),

            // Titre et description
            noteTitle: lang === 'fr'
                ? (note.titreFr || "CONVOCATION")
                : (note.titreEn || "CONVOCATION"),
            description: lang === 'fr' ? note.descriptionFr : note.descriptionEn,

           

            // Liste des formateurs
            formateurs: formateursListe,

            // Copie
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],

            // Créateur
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-convocation-formateurs.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF de convocation:', error);
        throw error;
    }
};


/**
 * Résout tous les utilisateurs ciblés par le public cible d'un thème
 * en tenant compte des restrictions des lieux de formation
 * @param {Object} theme - Le thème de formation avec publicCible peuplé
 * @param {Array} lieuxFormation - Les lieux de formation avec leurs familles participantes
 * @returns {Map} - Map avec userId comme clé et {utilisateur, lieu, dates} comme valeur
 */
const resolveUtilisateursCiblesAvecLieux = async (theme, lieuxFormation) => {
    const participantsMap = new Map();

    if (!theme.publicCible || theme.publicCible.length === 0) {
        return participantsMap;
    }

    // Créer un index des familles par lieu pour optimiser les recherches
    const famillesByLieu = new Map();
    lieuxFormation.forEach(lieu => {
        if (lieu.participants && lieu.participants.length > 0) {
            const familleIds = lieu.participants.map(fam => fam._id.toString());
            famillesByLieu.set(lieu._id.toString(), {
                familleIds,
                lieuInfo: {
                    lieu: lieu.lieu,
                    dateDebut: lieu.dateDebut,
                    dateFin: lieu.dateFin
                }
            });
        }
    });

    // Parcourir le public cible du thème
    for (const familleCible of theme.publicCible) {
        const familleId = familleCible.familleMetier._id || familleCible.familleMetier;
        
        // Vérifier si cette famille est présente dans au moins un lieu
        let lieuConcerne = null;
        for (const [lieuId, lieuData] of famillesByLieu) {
            if (lieuData.familleIds.includes(familleId.toString())) {
                lieuConcerne = lieuData.lieuInfo;
                break;
            }
        }

        // Si la famille n'est pas dans les lieux, passer à la suivante
        if (!lieuConcerne) continue;

        // Cas 1: Toute la famille (pas de restrictions de postes)
        if (!familleCible.postes || familleCible.postes.length === 0) {
            // Récupérer tous les postes de cette famille
            const postes = await PosteDeTravail.find({
                famillesMetier: familleId
            }).select('_id');

            const posteIds = postes.map(p => p._id);

            // Récupérer tous les utilisateurs de ces postes
            const users = await Utilisateur.find({
                posteDeTravail: { $in: posteIds }
            })
            .populate({
                path: 'posteDeTravail',
                select: 'nomFr nomEn famillesMetier'
            })
            .populate('service', 'nomFr nomEn')
            .populate('structure', 'nomFr nomEn')
            .lean();

            users.forEach(u => {
                const userId = u._id.toString();
                if (!participantsMap.has(userId)) {
                    participantsMap.set(userId, {
                        utilisateur: u,
                        lieu: lieuConcerne.lieu,
                        dateDebut: lieuConcerne.dateDebut,
                        dateFin: lieuConcerne.dateFin
                    });
                }
            });
        }
        // Cas 2: Restrictions par postes
        else {
            for (const posteRestriction of familleCible.postes) {
                const posteId = posteRestriction.poste._id || posteRestriction.poste;
                
                // Cas 2a: Toutes les structures du poste
                if (!posteRestriction.structures || posteRestriction.structures.length === 0) {
                    const users = await Utilisateur.find({
                        posteDeTravail: posteId
                    })
                    .populate({
                        path: 'posteDeTravail',
                        select: 'nomFr nomEn famillesMetier'
                    })
                    .populate('service', 'nomFr nomEn')
                    .populate('structure', 'nomFr nomEn')
                    .lean();

                    users.forEach(u => {
                        const userId = u._id.toString();
                        if (!participantsMap.has(userId)) {
                            participantsMap.set(userId, {
                                utilisateur: u,
                                lieu: lieuConcerne.lieu,
                                dateDebut: lieuConcerne.dateDebut,
                                dateFin: lieuConcerne.dateFin
                            });
                        }
                    });
                }
                // Cas 2b: Restrictions par structures
                else {
                    for (const structureRestriction of posteRestriction.structures) {
                        const structureId = structureRestriction.structure._id || structureRestriction.structure;
                        
                        // Cas 2b-i: Tous les services de la structure
                        if (!structureRestriction.services || structureRestriction.services.length === 0) {
                            const users = await Utilisateur.find({
                                posteDeTravail: posteId,
                                structure: structureId
                            })
                            .populate({
                                path: 'posteDeTravail',
                                select: 'nomFr nomEn famillesMetier'
                            })
                            .populate('service', 'nomFr nomEn')
                            .populate('structure', 'nomFr nomEn')
                            .lean();

                            users.forEach(u => {
                                const userId = u._id.toString();
                                if (!participantsMap.has(userId)) {
                                    participantsMap.set(userId, {
                                        utilisateur: u,
                                        lieu: lieuConcerne.lieu,
                                        dateDebut: lieuConcerne.dateDebut,
                                        dateFin: lieuConcerne.dateFin
                                    });
                                }
                            });
                        }
                        // Cas 2b-ii: Services spécifiques
                        else {
                            const serviceIds = structureRestriction.services.map(s => s.service._id || s.service);
                            const users = await Utilisateur.find({
                                posteDeTravail: posteId,
                                structure: structureId,
                                service: { $in: serviceIds }
                            })
                            .populate({
                                path: 'posteDeTravail',
                                select: 'nomFr nomEn famillesMetier'
                            })
                            .populate('service', 'nomFr nomEn')
                            .populate('structure', 'nomFr nomEn')
                            .lean();

                            users.forEach(u => {
                                const userId = u._id.toString();
                                if (!participantsMap.has(userId)) {
                                    participantsMap.set(userId, {
                                        utilisateur: u,
                                        lieu: lieuConcerne.lieu,
                                        dateDebut: lieuConcerne.dateDebut,
                                        dateFin: lieuConcerne.dateFin
                                    });
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    return participantsMap;
};

/**
 * Crée une note de service pour convoquer les participants d'un thème
 */
export const creerNoteServiceConvocationParticipants = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            theme,
            titreFr,
            titreEn,
            copieA,
            creePar,
            tacheFormationId
        } = req.body;

        // Validation
        if (!theme) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: t('theme_requis', lang)
            });
        }

        if (!mongoose.Types.ObjectId.isValid(theme)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // Récupérer le thème avec son public cible peuplé
        const themeData = await ThemeFormation.findById(theme)
            .populate('publicCible.familleMetier')
            .populate('publicCible.postes.poste')
            .populate('publicCible.postes.structures.structure')
            .populate('publicCible.postes.structures.services.service')
            .select('titreFr titreEn dateDebut dateFin publicCible')
            .lean();

        if (!themeData) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Récupérer tous les lieux de formation pour ce thème
        const lieuxFormation = await LieuFormation.find({ theme: theme })
            .populate({
                path: 'participants', // Ce sont maintenant des FamilleMetier
                select: 'nomFr nomEn'
            })
            .populate({
                path: 'cohortes',
                select: '_id nomFr nomEn'
            })
            .lean();

        if (!lieuxFormation || lieuxFormation.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: t('aucun_lieu_formation_trouve', lang)
            });
        }

        // ✅ NOUVELLE LOGIQUE: Résoudre les utilisateurs avec restrictions du thème ET des lieux
        const participantsMap = await resolveUtilisateursCiblesAvecLieux(themeData, lieuxFormation);
        console.log(participantsMap)
        // Récupérer tous les IDs de cohortes
        const toutesLesCohortes = lieuxFormation.flatMap(lieu =>
            lieu.cohortes.map(c => c._id)
        );

        // ✅ Ajouter les utilisateurs des cohortes (également filtrés par public cible et lieux)
        if (toutesLesCohortes.length > 0) {
            const cohortesUtilisateurs = await CohorteUtilisateur.find({
                cohorte: { $in: toutesLesCohortes }
            })
                .populate({
                    path: 'utilisateur',
                    select: 'nom prenom posteDeTravail service',
                    populate: [
                        {
                            path: 'posteDeTravail',
                            select: 'nomFr nomEn famillesMetier'
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

                // ❌ Ne pas dupliquer un utilisateur déjà ajouté
                if (participantsMap.has(userId)) continue;

                // Trouver le lieu associé à la cohorte
                const lieuAssocie = lieuxFormation.find(lieu =>
                    lieu.cohortes.some(c => c._id.toString() === cu.cohorte.toString())
                );

                // ❌ Si aucun lieu n’est rattaché à la cohorte, on ignore
                if (!lieuAssocie) continue;

                // ✅ Ajouter TELS QUELS sans restrictions
                participantsMap.set(userId, {
                    utilisateur: cu.utilisateur,
                    lieu: lieuAssocie.lieu,
                    dateDebut: lieuAssocie.dateDebut,
                    dateFin: lieuAssocie.dateFin,
                    source: "cohorte" // utile pour debugging
                });
            }
        }


        const tousLesParticipants = Array.from(participantsMap.values());

        if (tousLesParticipants.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: t('aucun_participant_trouve', lang)
            });
        }

        // Récupérer les infos du créateur
        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }

        // Créer la note de service
        const nouvelleNote = new NoteService({
            theme,
            typeNote: 'convocation',
            titreFr: titreFr || "CONVOCATION À LA FORMATION",
            titreEn: titreEn || "TRAINING CONVOCATION",
            copieA,
            creePar,
            valideParDG: false
        });

        const noteEnregistree = await nouvelleNote.save({ session });

        // Mettre à jour la tâche si fournie
        if (tacheFormationId) {
            await mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar: creePar,
                session
            });
        }

        // Générer le PDF
        const pdfBuffer = await genererPDFConvocationParticipants(
            noteEnregistree,
            themeData,
            tousLesParticipants,
            lang,
            createur
        );

        // Définir le nom du fichier
        const nomFichier = `note-service-convocation-participants-${noteEnregistree._id}.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la création de la convocation participants:', error);

        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



/**
 * Génère le PDF pour la convocation des participants
 */
const genererPDFConvocationParticipants = async (note, themeData, participants, lang, createur) => {
    try {
        // Grouper les participants par service
        const participantsParService = {};

        participants.forEach(participant => {
            const utilisateur = participant.utilisateur;
            const serviceId = utilisateur.service?._id?.toString() || 'sans_service';
            const serviceNom = utilisateur.service
                ? (lang === 'fr' ? utilisateur.service.nomFr : utilisateur.service.nomEn)
                : 'Service non spécifié';

            if (!participantsParService[serviceId]) {
                participantsParService[serviceId] = {
                    serviceNom,
                    participants: []
                };
            }

            const poste = utilisateur.posteDeTravail
                ? (lang === 'fr' ? utilisateur.posteDeTravail.nomFr : utilisateur.posteDeTravail.nomEn)
                : '';

            // Formater les dates spécifiques à ce participant (selon son lieu)
            const dateDebut = participant.dateDebut
                ? new Date(participant.dateDebut).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '';

            const dateFin = participant.dateFin
                ? new Date(participant.dateFin).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '';

            const periode = (dateDebut && dateFin) ? `Du ${dateDebut} au ${dateFin}` : '';

            participantsParService[serviceId].participants.push({
                nom: utilisateur.nom,
                prenom: utilisateur.prenom || '',
                poste,
                lieu: participant.lieu,
                periode
            });
        });

        // Convertir en tableau trié par nom de service
        const servicesOrdonnes = Object.values(participantsParService).sort((a, b) =>
            a.serviceNom.localeCompare(b.serviceNom)
        );

        // Créer la liste numérotée globale
        let numeroGlobal = 1;
        const participantsFormates = [];

        servicesOrdonnes.forEach(service => {
            service.participants.forEach(participant => {
                participantsFormates.push({
                    numero: numeroGlobal++,
                    nom: `${participant.nom} ${participant.prenom}`.trim(),
                    fonction: participant.poste,
                    service: service.serviceNom,
                    dateLieu: `${participant.periode}\n${participant.lieu}`
                });
            });
        });

        // Formater les dates globales du thème
        const dateDebutTheme = themeData.dateDebut
            ? new Date(themeData.dateDebut).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            })
            : '______________';

        const dateFinTheme = themeData.dateFin
            ? new Date(themeData.dateFin).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            })
            : '______________';

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Convocation des Participants',
            logoUrl: getLogoBase64(__dirname),

            // Titre
            noteTitle: lang === 'fr'
                ? (note.titreFr || "CONVOCATION À LA FORMATION")
                : (note.titreEn || "TRAINING CONVOCATION"),

            // Informations du thème
            themeLibelle: lang === 'fr' ? themeData.libelleFr : themeData.libelleEn,
            dateDebut: dateDebutTheme,
            dateFin: dateFinTheme,

            // Participants groupés par service
            participants: participantsFormates,
            nombreParticipants: participantsFormates.length,

            // Copie
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],

            // Créateur
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-convocation-participants.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF de convocation participants:', error);
        throw error;
    }
};


/**
 * Génère les fiches de présence des participants par lieu
 */
export const genererFichesPresenceParticipants = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {titreFr, titreEn, theme, creePar, tacheFormationId } = req.body;

        // Validation
        if (!theme || !mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({
                success: false,
                message: t('ref_theme_requis', lang)
            });
        }

        // Récupérer le thème
        const themeData = await ThemeFormation.findById(theme)
            .select('titreFr titreEn')
            .lean();

        if (!themeData) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Récupérer tous les lieux de formation pour ce thème
        const lieuxFormation = await LieuFormation.find({ theme: theme })
            .populate({
                path: 'participants',
                populate: {
                    path: 'utilisateur',
                    select: 'nom prenom matricule telephone grade posteDeTravail',
                    populate: {
                        path: 'posteDeTravail',
                        select: 'nomFr nomEn'
                    },
                    populate: {
                        path: 'grade',
                        select: 'nomFr nomEn'
                    }
                }
            })
            .populate({
                path: 'cohortes',
                select: '_id'
            })
            .sort({ lieu: 1 })
            .lean();

        if (!lieuxFormation || lieuxFormation.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_lieu_formation_trouve', lang)
            });
        }

        // Pour chaque lieu, récupérer aussi les utilisateurs des cohortes
        const lieuxAvecParticipants = await Promise.all(
            lieuxFormation.map(async (lieu) => {
                const participantsMap = new Map();

                // Ajouter les participants directs
                if (lieu.participants) {
                    lieu.participants.forEach(participant => {
                        if (participant.utilisateur) {
                            const userId = participant.utilisateur._id.toString();
                            participantsMap.set(userId, participant.utilisateur);
                        }
                    });
                }

                // Récupérer les utilisateurs des cohortes de ce lieu
                if (lieu.cohortes && lieu.cohortes.length > 0) {
                    const cohortesUtilisateurs = await CohorteUtilisateur.find({
                        cohorte: { $in: lieu.cohortes.map(c => c._id) }
                    })
                    .populate({
                        path: 'utilisateur',
                        select: 'nom prenom matricule telephone grade posteDeTravail',
                        populate: {
                            path: 'posteDeTravail',
                            select: 'nomFr nomEn'
                        },
                        populate: {
                            path: 'grade',
                            select: 'nomFr nomEn'
                        }
                        
                    })
                    .lean();

                    cohortesUtilisateurs.forEach(cu => {
                        if (cu.utilisateur) {
                            const userId = cu.utilisateur._id.toString();
                            if (!participantsMap.has(userId)) {
                                participantsMap.set(userId, cu.utilisateur);
                            }
                        }
                    });
                }

                return {
                    lieu: lieu.lieu,
                    dateDebut: lieu.dateDebut,
                    dateFin: lieu.dateFin,
                    participants: Array.from(participantsMap.values())
                };
            })
        );

        // Filtrer les lieux sans participants
        const lieuxValides = lieuxAvecParticipants.filter(lieu => lieu.participants.length > 0);

        if (lieuxValides.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_participant_trouve', lang)
            });
        }

        // Récupérer les infos du créateur
        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }

        // Créer la note de service
        const nouvelleNote = new NoteService({
            theme,
            typeNote: 'convocation',
            titreFr: titreFr || "CONVOCATION À LA FORMATION",
            titreEn: titreEn || "TRAINING CONVOCATION",
            copieA:"",
            creePar,
            valideParDG: false
        });

        const noteEnregistree = await nouvelleNote.save({ session });
        if (tacheFormationId) {
            mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar:creePar,
                session
            });
        }
        // Générer le PDF
        const pdfBuffer = await genererPDFFichesPresence(
            themeData,
            lieuxValides,
            lang,
            createur
        );

        // Définir le nom du fichier
        const nomFichier = `fiches-presence-${Date.now()}.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();
        
        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });

        return res.send(pdfBuffer);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        console.error('Erreur lors de la génération des fiches de présence:', error);

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Génère le PDF des fiches de présence par lieu
 */
const genererPDFFichesPresence = async (themeData, lieuxAvecParticipants, lang, createur) => {
    try {
        // Date actuelle pour la journée
        const journee = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // Préparer les données pour chaque lieu
        const lieuxFormates = lieuxAvecParticipants.map(lieu => {
            // Trier les participants par nom
            const participantsTries = lieu.participants.sort((a, b) => 
                a.nom.localeCompare(b.nom)
            );

            // Formater les participants
            const participantsFormates = participantsTries.map((participant, index) => ({
                numero: index + 1,
                matricule: participant.matricule || '-',
                nomComplet: `${participant.nom} ${participant.prenom || ''}`.trim(),
                grade: participant.grade
                    ? (lang === 'fr' ? participant.grade.nomFr : participant.grade.nomEn)
                    : '-',
                fonction: participant.posteDeTravail
                    ? (lang === 'fr' ? participant.posteDeTravail.nomFr : participant.posteDeTravail.nomEn)
                    : '-',
                telephone: participant.telephone || '-'
            }));

            // Formater les dates
            const dateDebut = lieu.dateDebut
                ? new Date(lieu.dateDebut).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '';

            const dateFin = lieu.dateFin
                ? new Date(lieu.dateFin).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })
                : '';

            const periode = (dateDebut && dateFin) ? `Du ${dateDebut} au ${dateFin}` : '';

            return {
                lieu: lieu.lieu,
                periode,
                participants: participantsFormates,
                nombreParticipants: participantsFormates.length
            };
        });

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Fiches de Présence - Formation',
            logoUrl: getLogoBase64(__dirname),
            journee: journee,
            themeLibelle: lang === 'fr' ? themeData.titreFr : themeData.titreEn,
            lieux: lieuxFormates,
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/fiches-presence-participants.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF des fiches de présence:', error);
        throw error;
    }
};

/**
 * Génère les fiches de présence des formateurs
 */
export const genererFichesPresenceFormateurs = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { titreFr, titreEn, theme, creePar, tacheFormationId } = req.body;

        // Validation
        if (!theme || !mongoose.Types.ObjectId.isValid(theme)) {
            return res.status(400).json({
                success: false,
                message: t('ref_theme_requis', lang)
            });
        }

        // Récupérer le thème
        const themeData = await ThemeFormation.findById(theme)
            .select('titreFr titreEn')
            .lean();

        if (!themeData) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Récupérer tous les formateurs pour ce thème
        const formateursData = await Formateur.find({ theme: theme })
            .populate({
                path: 'utilisateur',
                select: 'nom prenom matricule telephone grade posteDeTravail',
                populate: {
                    path: 'posteDeTravail',
                    select: 'nomFr nomEn'
                },
                populate: {
                    path: 'grade',
                    select: 'nomFr nomEn'
                }
            })
            .lean();

        if (!formateursData || formateursData.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('formateur_non_trouve', lang)
            });
        }

        // Récupérer les infos du créateur
        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }

        // Créer la note de service
        const nouvelleNote = new NoteService({
            theme,
            typeNote: 'convocation',
            titreFr: titreFr || "CONVOCATION À LA FORMATION - FORMATEURS",
            titreEn: titreEn || "TRAINING CONVOCATION - TRAINERS",
            copieA: "",
            creePar,
            valideParDG: false
        });

        const noteEnregistree = await nouvelleNote.save({ session });
        if (tacheFormationId) {
            mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar:creePar,
                session
            });
        }
        // Récupérer les dates de formation (optionnel)
        const lieuxFormation = await LieuFormation.find({ theme: theme })
            .select('dateDebut dateFin')
            .sort({ dateDebut: 1 })
            .lean();

        let dateDebut = null;
        let dateFin = null;

        if (lieuxFormation && lieuxFormation.length > 0) {
            // Prendre la date de début la plus ancienne
            dateDebut = lieuxFormation[0].dateDebut;
            // Prendre la date de fin la plus récente
            dateFin = lieuxFormation[lieuxFormation.length - 1].dateFin;
        }

        // Générer le PDF
        const pdfBuffer = await genererPDFFichesPresenceFormateurs(
            themeData,
            formateursData,
            dateDebut,
            dateFin,
            lang,
            createur
        );

        // Définir le nom du fichier
        const nomFichier = `fiches-presence-formateurs-${Date.now()}.pdf`;

        // Valider la transaction
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });

        return res.send(pdfBuffer);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Erreur lors de la génération des fiches de présence des formateurs:', error);

        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Génère le PDF des fiches de présence des formateurs
 */
const genererPDFFichesPresenceFormateurs = async (
    themeData,
    formateursData,
    dateDebut,
    dateFin,
    lang,
    createur
) => {
    try {
        // Date actuelle pour la journée
        const journee = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // Trier les formateurs par nom
        const formateursTries = formateursData.sort((a, b) => {
            const nomA = a.utilisateur?.nom || '';
            const nomB = b.utilisateur?.nom || '';
            return nomA.localeCompare(nomB);
        });

        // Formater les formateurs
        const formateursFormates = formateursTries.map((formateur, index) => ({
            numero: index + 1,
            nomComplet: formateur.utilisateur
                ? `${formateur.utilisateur.nom} ${formateur.utilisateur.prenom || ''}`.trim()
                : '-',
            grade: formateur.grade
                    ? (lang === 'fr' ? formateur.grade.nomFr : formateur.grade.nomEn)
                    : '-',
            fonction: formateur.posteDeTravail
                ? (lang === 'fr' ? formateur.posteDeTravail.nomFr : formateur.posteDeTravail.nomEn)
                : '-',
            telephone: formateur.utilisateur?.telephone || '-',
            email: formateur.utilisateur?.email || '-'
        }));

        // Formater la période si les dates existent
        let periode = '';
        if (dateDebut && dateFin) {
            const dateDebutFormatee = new Date(dateDebut).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const dateFinFormatee = new Date(dateFin).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            periode = `Du ${dateDebutFormatee} au ${dateFinFormatee}`;
        }

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Fiches de Présence - Formateurs',
            logoUrl: getLogoBase64(__dirname),
            journee: journee,
            themeLibelle: lang === 'fr' ? themeData.titreFr : themeData.titreEn,
            periode: periode,
            formateurs: formateursFormates,
            nombreFormateurs: formateursFormates.length,
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
        };

        // Charger le template
        const templatePath = path.join(__dirname, '../views/fiches-presence-formateurs.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Générer le PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '60px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${templateData.createurNom}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF des fiches de présence des formateurs:', error);
        throw error;
    }
};

/**
 * Récupère toutes les notes de service avec pagination
 */
export const obtenirNotesService = async (req, res) => {
    try {
        const { page = 1, limit = 10, typeNote, valideParDG } = req.query;
        
        // Construire le filtre
        const filtre = {};
        if (typeNote) filtre.typeNote = typeNote;
        if (valideParDG !== undefined) filtre.valideParDG = valideParDG === 'true';

        // Options de pagination
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            populate: [
                { path: 'theme', select: 'libelle description' },
                { path: 'stage', select: 'titre dateDebut dateFin' },
                { path: 'mandat', select: 'theme directeur superviseur' },
                { path: 'creePar', select: 'nom prenom email' }
            ],
            sort: { createdAt: -1 }
        };

        const notes = await NoteService.find(filtre)
            .populate(options.populate)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await NoteService.countDocuments(filtre);

        res.json({
            success: true,
            data: notes,
            pagination: {
                page: options.page,
                pages: Math.ceil(total / options.limit),
                limit: options.limit,
                total
            }
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des notes:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            error: error.message
        });
    }
};

/**
 * Valide une note de service par le DG
 */
export const validerNoteService = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { valideParDG = true } = req.body;

        const note = await NoteService.findByIdAndUpdate(
            noteId,
            { valideParDG },
            { new: true }
        ).populate([
            { path: 'theme', select: 'libelle description' },
            { path: 'stage', select: 'titre dateDebut dateFin' },
            { path: 'mandat', select: 'theme directeur superviseur' },
            { path: 'creePar', select: 'nom prenom email' }
        ]);

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note de service non trouvée'
            });
        }

        res.json({
            success: true,
            message: `Note de service ${valideParDG ? 'validée' : 'invalidée'} avec succès`,
            data: note
        });

    } catch (error) {
        console.error('Erreur lors de la validation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            error: error.message
        });
    }
};