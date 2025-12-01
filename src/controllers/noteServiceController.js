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
import QRCode from 'qrcode';
import { promisify } from 'util';
import { validerReferencePDF } from '../utils/pdfHelper.js';
// import { getDocument } from 'pdfjs-dist';




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
 * Crée ou met à jour une note de service et génère automatiquement le PDF
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

        // Vérifier si une note existe déjà pour cette entité
        let critereRecherche = { typeNote };
        if (typeNote === 'mandat') critereRecherche.mandat = mandat;
        if (typeNote === 'acceptation_stage') critereRecherche.stage = stage;
        if (typeNote === 'convocation') critereRecherche.theme = theme;

        let noteExistante = await NoteService.findOne(critereRecherche);
        let noteEnregistree;

        if (noteExistante) {
            // Mettre à jour la note existante (sans modifier la référence)
            noteExistante.titreFr = titreFr;
            noteExistante.titreEn = titreEn;
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.designationTuteur = designationTuteur;
            noteExistante.miseEnOeuvre = miseEnOeuvre;
            noteExistante.valideParDG = false;
            
            noteEnregistree = await noteExistante.save({ session });
        } else {
            // Générer la référence uniquement pour une nouvelle note
            const reference = await genererReference();

            // Créer la nouvelle note de service
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

            noteEnregistree = await nouvelleNote.save({ session });
        }

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
        const nomFichier = `note-service-${typeNote}-${noteEnregistree.reference.replace(/\//g, '-')}.pdf`;

        // Valider la transaction uniquement si le PDF a été généré
        await session.commitTransaction();
        session.endSession();

        // Envoyer le PDF en réponse
        res.set({
            'success': true,
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
 * Crée ou met à jour une note de service pour un stage et génère le PDF
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

        // Vérifier si une note existe déjà pour ce stage
        let noteExistante = await NoteService.findOne({ 
            stage: stage, 
            typeNote: 'acceptation_stage' 
        });
        
        let nouvelleNote;

        if (noteExistante) {
            // Mettre à jour la note existante (sans modifier la référence)
            if(!noteExistante.reference){
                noteExistante.reference = await genererReference();
            }
            noteExistante.titreFr = titreFr || "ACCEPTATION DE STAGE";
            noteExistante.titreEn = titreEn || "INTERNSHIP ACCEPTANCE";
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.designationTuteur = designationTuteur;
            noteExistante.miseEnOeuvre = miseEnOeuvre;
            noteExistante.valideParDG = false;
            
            nouvelleNote = await noteExistante.save({ session });
        } else {
            // Générer la référence uniquement pour une nouvelle note
            const reference = await genererReference();

            // Créer la nouvelle note de service
            nouvelleNote = new NoteService({
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
            
            nouvelleNote = await nouvelleNote.save({ session });
        }
        
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
        } else {
            pdfBuffer = await genererPDFStageRotations(
                nouvelleNote, 
                stageData, 
                affectations, 
                lang,
                createur
            );
        }

        // Définir le nom du fichier
        const nomFichier = `note-service-stage-${nouvelleNote.reference.replace(/\//g, '-')}.pdf`;

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
 * Crée ou met à jour une note de service pour un stage de groupe
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

        // Vérifier si une note existe déjà pour ce stage
        let noteExistante = await NoteService.findOne({ 
            stage: stage, 
            typeNote: 'acceptation_stage' 
        });
        
        let noteEnregistree;

        if (noteExistante) {
            // Mettre à jour la note existante (sans modifier la référence)
            noteExistante.titreFr = titreFr || "ACCEPTATION DE STAGE EN GROUPE";
            noteExistante.titreEn = titreEn || "GROUP INTERNSHIP ACCEPTANCE";
            noteExistante.descriptionFr = descriptionFr;
            noteExistante.descriptionEn = descriptionEn;
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.dispositions = dispositions;
            noteExistante.personnesResponsables = personnesResponsables;
            noteExistante.miseEnOeuvre = miseEnOeuvre;
            noteExistante.valideParDG = false;
            
            noteEnregistree = await noteExistante.save({ session });
        } else {
            // Générer la référence uniquement pour une nouvelle note
            const reference = await genererReference();

            // Créer la nouvelle note de service
            noteEnregistree = new NoteService({
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

            noteEnregistree = await noteEnregistree.save({ session });
        }

        const createur = await Utilisateur.findById(creePar).lean();
        
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
        const nomFichier = `note-service-stage-groupe-${noteEnregistree.reference.replace(/\//g, '-')}.pdf`;

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
        // Générer l'URL de vérification de la note
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        // Générer le QR code en base64
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        // Données communes à tous les types
        const donneesCommunes = {
            documentTitle: `Note de Service - ${note.typeNote}`,
            logoUrl: getLogoBase64(__dirname), // Image en base64
            // Référence système
            referenceSysteme: note.reference || 'REF-XXX',
            
            // QR Code
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
           
            mandatCopie: note.copieA
                    ? note.copieA.split(/[;,]/)     // découpe sur ; ou ,
                        .map(e => e.trim())         // enlève les espaces autour
                        .filter(e => e.length > 0)  // enlève les vides éventuels
                    : [],
             dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
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
                    <div style="text-align: left; flex: 1;">
                        Généré par ${(note.creePar.nom+" "+note.creePar?.prenom ||"") || 'Système'}
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
    try {
        // Récupérer le parcours le plus récent du stagiaire
        const parcoursActuel = stageData.stagiaire.parcours && stageData.stagiaire.parcours.length > 0
            ? stageData.stagiaire.parcours[stageData.stagiaire.parcours.length - 1]
            : null;
        // Générer l'URL de vérification de la note
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        // Générer le QR code en base64
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Acceptation de Stage',
            logoUrl: getLogoBase64(__dirname),
            
            // Référence système
            referenceSysteme: note.reference || 'REF-XXX',
            
            // QR Code
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
            
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

            // Date et heure
            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
        };
        
        
        // Charger le template
        const templatePath = path.join(__dirname, '../views/note-service-stage-individuel-1.ejs');
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
        // Générer l'URL de vérification de la note
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        // Générer le QR code en base64
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

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
            // Référence système
            referenceSysteme: note.reference || 'REF-XXX',
            
            // QR Code
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
            // Titre de la note
            noteTitle: lang === 'fr' 
                ? (note.titreFr || "ACCEPTATION DE STAGE")
                : (note.titreEn || "INTERNSHIP ACCEPTANCE"),
            
            // Informations du stagiaire
            userSexe: stageData.stagiaire.genre === 'M' ? "Monsieur" : "Madame",
            etudiant: stageData.stagiaire.genre === 'M' ? "étudiant" : "étudiante",
            mise: stageData.stagiaire.genre === 'M' ? "mis" : "mise",
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
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',

            // Date et heure
            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
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
        // Générer l'URL de vérification de la note
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        // Générer le QR code en base64
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

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

        const numerosGroupes = [...new Set(stageData.groupes.map(g => g.numero))].sort((a, b) => a - b);

        // Préparer les données pour le template
        const templateData = {
            documentTitle: 'Note de Service - Acceptation de Stage en Groupe',
            logoUrl: getLogoBase64(__dirname),
            
            // QR Code et référence
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
            referenceSysteme: note.reference || 'REF-XXX',
            
            noteTitle: lang === 'fr' 
                ? (note.titreFr || "ACCEPTATION DE STAGE EN GROUPE")
                : (note.titreEn || "GROUP INTERNSHIP ACCEPTANCE"),
            description: lang === 'fr' ? note.descriptionFr : note.descriptionEn,
            
            groupesAvecStagiaires,
            
            dispositions: note.dispositions
                ? note.dispositions.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : [],
            
            personnesResponsables: note.personnesResponsables || "Les Chefs de Service concernés",
            miseEnOeuvre: note.miseEnOeuvre || "Les Directeurs concernés",
            
            chronogrammeRotations,
            servicesIds: Array.from(servicesSet),
            numerosGroupes,
            
            affectationsFinalesParGroupe,
            
            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],
            
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',

            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
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
            landscape: false,
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
 * Crée ou met à jour une note de service pour convoquer les formateurs d'un thème
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

        // Vérifier que le thème existe
        const themeData = await ThemeFormation.findById(theme)
            .select('libelleFr libelleEn dateDebut dateFin lieu')
            .lean();

        if (!themeData) {
            await session.abortTransaction();
            session.endSession();
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
            await session.abortTransaction();
            session.endSession();
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

        // Vérifier si une note existe déjà pour ce thème (convocation formateurs)
        let noteExistante = await NoteService.findOne({ 
            theme: theme, 
            typeNote: 'convocation',
            sousTypeConvocation: 'formateurs' // ✅ Distinction clé
        });
        
        let noteEnregistree;

        if (noteExistante) {
            // Mettre à jour la note existante (sans modifier la référence)
            noteExistante.titreFr = titreFr || "CONVOCATION";
            noteExistante.titreEn = titreEn || "CONVOCATION";
            noteExistante.descriptionFr = descriptionFr;
            noteExistante.descriptionEn = descriptionEn;
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.valideParDG = false;
            
            noteEnregistree = await noteExistante.save({ session });
        } else {
            // Générer la référence uniquement pour une nouvelle note
            const reference = await genererReference();

            // Créer la nouvelle note de service
            noteEnregistree = new NoteService({
                reference,
                theme,
                typeNote: 'convocation',
                sousTypeConvocation: 'formateurs', // ✅ Nouveau champ
                titreFr: titreFr || "CONVOCATION",
                titreEn: titreEn || "CONVOCATION",
                descriptionFr,
                descriptionEn,
                copieA,
                creePar,
                valideParDG: false
            });

            noteEnregistree = await noteEnregistree.save({ session });
        }

        // Mettre à jour la tâche si fournie
        if (tacheFormationId) {
            mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar: creePar,
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
        const nomFichier = `note-service-convocation-formateurs-${noteEnregistree.reference.replace(/\//g, '-')}.pdf`;

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
        // Générer l'URL de vérification
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        // Générer le QR code
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Préparer la liste des formateurs
        const formateursListe = formateurs.map((formateur, index) => {
            const utilisateur = formateur.utilisateur;
            const nomComplet = `${utilisateur.nom} ${utilisateur.prenom || ''}`.trim();
            
            return {
                numero: index + 1,
                nomComplet,
            };
        });

        const templateData = {
            documentTitle: 'Note de Service - Convocation des Formateurs',
            logoUrl: getLogoBase64(__dirname),

            // QR Code et référence
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
            referenceSysteme: note.reference || 'REF-XXX',

            noteTitle: lang === 'fr'
                ? (note.titreFr || "CONVOCATION")
                : (note.titreEn || "CONVOCATION"),
            description: lang === 'fr' ? note.descriptionFr : note.descriptionEn,

            formateurs: formateursListe,

            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],

            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',

            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
        };

        const templatePath = path.join(__dirname, '../views/note-service-convocation-formateurs.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

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
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF de convocation:', error);
        throw error;
    }
};




/**
 * Logique de résolution d'un utilisateur ciblé par le Theme ET un Lieu.
 * Ceci remplace l'ancienne fonction 'resolveUtilisateursCiblesAvecLieux'.
 * @param {object} utilisateur - Document Utilisateur
 * @param {Array<object>} lieuxFormation - Liste des LieuxFormation pour le thème
 * @returns {Promise<object|null>} L'objet participant formaté s'il est ciblé, sinon null.
 */
const checkUserTargeting = async (utilisateur, lieuxFormation) => {
    // Transformer l'objet lean en document Mongoose pour utiliser la méthode d'instance
    // (Ceci suppose que l'utilisateur a été peuplé correctement avant, notamment posteDeTravail)
    const LieuFormationModel = mongoose.model('LieuFormation');
    
    for (const lieuData of lieuxFormation) {
        // Créer une instance Mongoose temporaire pour utiliser la méthode isUserTargeted
        const lieuInstance = new LieuFormationModel(lieuData);
        
        // La méthode isUserTargeted vérifie les restrictions DGI du lieu (Famille/Poste/Structure/Service)
        // Elle prend en compte la nouvelle structure des familles (PosteDeTravail.famillesMetier)
        if (await lieuInstance.isUserTargeted(utilisateur._id)) {
            // Utilisateur ciblé par ce lieu, on retourne les infos pour la convocation
            return {
                utilisateur: utilisateur,
                lieu: lieuData.lieu,
                dateDebut: lieuData.dateDebut,
                dateFin: lieuData.dateFin,
                source: "restriction" // Ciblé par les règles du LieuFormation
            };
        }
    }

    return null; // N'est ciblé par aucun lieu
};


/**
 * Crée ou met à jour une note de service pour convoquer les participants d'un thème
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
        
        // Validation (inchangée)
        if (!theme || !mongoose.Types.ObjectId.isValid(theme)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: t('theme_requis_ou_invalide', lang)
            });
        }

        const themeData = await ThemeFormation.findById(theme)
            .select('titreFr titreEn dateDebut dateFin')
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
                path: 'cohortes',
                select: '_id nomFr nomEn'
            });

        if (!lieuxFormation || lieuxFormation.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: t('aucun_lieu_formation_trouve', lang)
            });
        }

        // --- LOGIQUE DE CONSOLIDATION DES PARTICIPANTS ---

        const participantsMap = new Map();
        
        // 1. RESOLUTION DES UTILISATEURS CIBLÉS PAR LES RESTRICTIONS DGI (LieuxFormation)
        
        // 🚨 MISE À JOUR DU POPULATE POUR ASSURER L'ACCÈS À utilisateur.posteDeTravail.famillesMetier
        const allUsers = await Utilisateur.find({ actif: true }) // Utilisation du champ 'actif' du modèle Utilisateur
            .select('_id nom prenom posteDeTravail structure service')
            .populate({
                path: 'posteDeTravail',
                select: 'famillesMetier nomFr nomEn' // Indispensable pour la vérification du ciblage
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
            participantsMap.set(participant.utilisateur._id.toString(), participant);
        });

        // 2. AJOUT DES UTILISATEURS DES COHORTES (inchangé)
        
        const toutesLesCohortes = lieuxFormation.flatMap(lieu =>
            lieu.cohortes.map(c => c._id)
        );

        if (toutesLesCohortes.length > 0) {
            const cohortesUtilisateurs = await CohorteUtilisateur.find({
                cohorte: { $in: toutesLesCohortes }
            })
            .populate({
                path: 'utilisateur',
                select: '_id nom prenom posteDeTravail service',
                populate: [
                    {
                        path: 'posteDeTravail',
                        select: 'nomFr nomEn' // Peuplement du Poste de Travail
                    },
                    {
                        path: 'service',
                        select: 'nomFr nomEn' // Peuplement du Service
                    }
                ]
            })
            .lean();

            for (const cu of cohortesUtilisateurs) {
                if (!cu.utilisateur) continue;
                const userId = cu.utilisateur._id.toString();

                if (participantsMap.has(userId)) continue;

                const lieuAssocie = lieuxFormation.find(lieu =>
                    lieu.cohortes.some(c => c._id.equals(cu.cohorte))
                );

                if (!lieuAssocie) continue;

                participantsMap.set(userId, {
                    utilisateur: cu.utilisateur,
                    lieu: lieuAssocie.lieu,
                    dateDebut: lieuAssocie.dateDebut,
                    dateFin: lieuAssocie.dateFin,
                    source: "cohorte"
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
        
        // --- FIN DE LA LOGIQUE DE CONSOLIDATION ---
        
        // Le reste de la logique (Créateur, NoteService, Tâche, PDF) est inchangé.

        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }

        let noteExistante = await NoteService.findOne({ 
            theme: theme, 
            typeNote: 'convocation',
            sousTypeConvocation: 'participants'
        });
        
        let noteEnregistree;

        if (noteExistante) {
            noteExistante.titreFr = titreFr || "CONVOCATION À LA FORMATION";
            noteExistante.titreEn = titreEn || "TRAINING CONVOCATION";
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.valideParDG = false;
            noteEnregistree = await noteExistante.save({ session });
        } else {
            const reference = await genererReference();
            noteEnregistree = new NoteService({
                reference,
                theme,
                typeNote: 'convocation',
                sousTypeConvocation: 'participants',
                titreFr: titreFr || "CONVOCATION À LA FORMATION",
                titreEn: titreEn || "TRAINING CONVOCATION",
                copieA,
                creePar,
                valideParDG: false
            });
            noteEnregistree = await noteEnregistree.save({ session });
        }

        if (tacheFormationId) {
             mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar: creePar,
                session
            });
        }

        const pdfBuffer = await genererPDFConvocationParticipants(
            noteEnregistree,
            themeData,
            tousLesParticipants,
            lang,
            createur
        );

        const nomFichier = `note-service-convocation-participants-${noteEnregistree.reference.replace(/\//g, '-')}.pdf`;

        await session.commitTransaction();
        session.endSession();

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
        // Générer l'URL de vérification et le QR code (inchangé)
        const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
        const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
        
        const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // Grouper les participants par service
        const participantsParService = {};

        participants.forEach(participant => {
            const utilisateur = participant.utilisateur;
            
            // ... (Définition serviceId et serviceNom inchangée)
            const serviceId = utilisateur.service?._id?.toString() || 'sans_service';
            let serviceNom;
            if (utilisateur.service) {
                const nom = lang === 'fr' 
                    ? utilisateur.service.nomFr 
                    : utilisateur.service.nomEn;
                serviceNom = nom || 'Nom de Service Manquant'; 
            } else {
                serviceNom = 'Service non spécifié';
            }

            if (!participantsParService[serviceId]) {
                participantsParService[serviceId] = {
                    serviceNom,
                    participants: []
                };
            }
            
            // Formatage des dates avec mois en format numérique (inchangé)
            const dateOptions = { day: '2-digit', month: 'numeric', year: 'numeric' };

            const dateDebut = participant.dateDebut
                ? new Date(participant.dateDebut).toLocaleDateString('fr-FR', dateOptions)
                : '';

            const dateFin = participant.dateFin
                ? new Date(participant.dateFin).toLocaleDateString('fr-FR', dateOptions)
                : '';

            const periode = (dateDebut && dateFin) ? `Du ${dateDebut} au ${dateFin}` : '';
            
            const poste = utilisateur.posteDeTravail
                ? (lang === 'fr' ? utilisateur.posteDeTravail.nomFr : utilisateur.posteDeTravail.nomEn)
                : '';

            participantsParService[serviceId].participants.push({
                nom: utilisateur.nom,
                prenom: utilisateur.prenom || '',
                poste,
                lieu: participant.lieu,
                periode
            });
        });

        // Tri des services (inchangé)
        const servicesOrdonnes = Object.values(participantsParService).sort((a, b) =>
            a.serviceNom.localeCompare(b.serviceNom)
        );

        let numeroGlobal = 1;
        const participantsFormates = [];

        servicesOrdonnes.forEach(service => {
            
            // 🚀 MODIFICATION MAJEURE: Regroupement par Lieu/Période pour le Rowspan
            // Utiliser une structure imbriquée pour garantir l'ordre : 
            // 1. Groupe par Service (déjà fait)
            // 2. Groupe par Lieu/Période
            
            const participantsGroupesParLieuPeriode = {};
            
            service.participants.forEach(p => {
                // Créer une clé normalisée pour le regroupement
                // Enlever les espaces en début/fin et forcer le lieu à être une chaîne.
                const key = `${p.lieu || ''}_${p.periode || ''}`.trim().toLowerCase();
                
                if (!participantsGroupesParLieuPeriode[key]) {
                    participantsGroupesParLieuPeriode[key] = [];
                }
                participantsGroupesParLieuPeriode[key].push(p);
            });
            
            // Formatage final avec calcul du Rowspan
            Object.values(participantsGroupesParLieuPeriode).forEach(groupe => {
                const rowspan = groupe.length;

                groupe.forEach((participant, index) => {
                    const estPremiereLigneDuLieuPeriode = (index === 0);

                    participantsFormates.push({
                        numero: numeroGlobal++,
                        nom: `${participant.nom} ${participant.prenom}`.trim(),
                        fonction: participant.poste,
                        service: service.serviceNom,
                        
                        // Infos Rowspan (pour le template)
                        lieu: participant.lieu,
                        periode: participant.periode,
                        rowspan: estPremiereLigneDuLieuPeriode ? rowspan : 0, 
                        afficherLieuPeriode: estPremiereLigneDuLieuPeriode 
                    });
                });
            });
        });

        // 🚀 MODIFICATION 1 (ThemeData): Formatage des dates du thème avec mois en format numérique
        const dateOptionsTheme = { day: '2-digit', month: 'numeric', year: 'numeric' };

        const dateDebutTheme = themeData.dateDebut
            ? new Date(themeData.dateDebut).toLocaleDateString('fr-FR', dateOptionsTheme)
            : '______________';

        const dateFinTheme = themeData.dateFin
            ? new Date(themeData.dateFin).toLocaleDateString('fr-FR', dateOptionsTheme)
            : '______________';

        const templateData = {
            documentTitle: 'Note de Service - Convocation des Participants',
            logoUrl: getLogoBase64(__dirname),

            // QR Code et référence
            qrCodeUrl: qrCodeDataUrl,
            urlVerification: urlVerification,
            referenceSysteme: note.reference || 'REF-XXX',

            noteTitle: lang === 'fr'
                ? (note.titreFr || "CONVOCATION À LA FORMATION")
                : (note.titreEn || "TRAINING CONVOCATION"),

            themeLibelle: lang === 'fr' ? themeData.titreFr : themeData.titreEn, // Utilisation de titreFr/titreEn
            dateDebut: dateDebutTheme,
            dateFin: dateFinTheme,

            participants: participantsFormates,
            nombreParticipants: participantsFormates.length,

            copies: note.copieA
                ? note.copieA.split(/[;,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
                : ['Intéressé(e)s', 'Chefs de Service concernés', 'Archives/Chrono'],

            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',

            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
        };

        const templatePath = path.join(__dirname, '../views/note-service-convocation-participants.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // ... (Code Puppeteer inchangé)
        const browser = await puppeteer.launch({ /* ... */ });
        const page = await browser.newPage();
        await page.setContent(html, { /* ... */ });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true, // Revert back to true for better table display
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
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF de convocation participants:', error);
        throw error;
    }
};


/**
 * Génère les fiches de présence des participants par lieu.
 *
 * @param {object} req - Objet requête (req.params.lieuId pour un lieu spécifique, req.body.theme pour tous)
 * @param {object} res - Objet réponse
 */
export const genererFichesPresenceParticipants = async (req, res) => {
    // Récupération de l'ID du lieu si présent dans les paramètres
    const lieuId = req.params.lieuId;
    
    const lang = req.headers['accept-language'] || 'fr';
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { titreFr, titreEn, theme, creePar, tacheFormationId, copieA } = req.body;

        let query = {};
        let singleLieu = false;
        // 1. Définition de la requête de base (Lieu(x) ciblé(s))
        if (lieuId && mongoose.Types.ObjectId.isValid(lieuId)) {
            query = { _id: lieuId };
            singleLieu = true;
            
            if (!theme || !mongoose.Types.ObjectId.isValid(theme)) {
                const lieuData = await LieuFormation.findById(lieuId).select('theme').lean();
                if (!lieuData) {
                    return res.status(404).json({
                        success: false,
                        message: t('lieu_formation_non_trouve', lang)
                    });
                }
                req.body.theme = lieuData.theme;
            }
        } else {
            if (!theme || !mongoose.Types.ObjectId.isValid(theme)) {
                return res.status(400).json({
                    success: false,
                    message: t('ref_theme_requis', lang)
                });
            }
            query = { theme: theme };
        }
        
        const finalThemeId = req.body.theme;
        if (!finalThemeId) {
             return res.status(400).json({
                success: false,
                message: t('ref_theme_requis', lang)
            });
        }

        // 2. Récupérer le thème (pour les titres)
        const themeData = await ThemeFormation.findById(finalThemeId)
            .select('titreFr titreEn')
            .lean();

        if (!themeData) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // 3. Récupérer les lieux de formation
        const lieuxFormation = await LieuFormation.find(query)
            .populate({
                path: 'cohortes',
                select: '_id'
            })
            .sort({ lieu: 1 });

        if (!lieuxFormation || lieuxFormation.length === 0) {
            const message = singleLieu 
                ? t('lieu_formation_non_trouve', lang) 
                : t('aucun_lieu_formation_trouve', lang);
                
            return res.status(404).json({
                success: false,
                message: message
            });
        }

        // 4. Résolution des participants pour chaque lieu (Participants ciblés + Cohortes)
        const lieuxAvecParticipants = await Promise.all(
            lieuxFormation.map(async (lieu) => {
                
                // Utiliser une Map pour stocker les utilisateurs et gérer la déduplication
                const participantsMap = new Map();
                
                // A. Résoudre les participants ciblés (nouvelle logique : famille, poste, structure, service)
                const targetedUsers = await lieu.resolveTargetedUsers();
                targetedUsers.forEach(user => {
                    participantsMap.set(user._id.toString(), user);
                });
                
                // B. Récupérer les utilisateurs des cohortes de ce lieu (ancienne logique)
                if (lieu.cohortes && lieu.cohortes.length > 0) {
                    const cohorteIds = lieu.cohortes.map(c => c._id);
                    
                    // Récupérer les CohorteUtilisateur pour ce lieu
                    const cohortesUtilisateurs = await CohorteUtilisateur.find({
                        cohorte: { $in: cohorteIds }
                    })
                    .populate({
                        path: 'utilisateur',
                        select: '_id nom prenom' // Seul l'ID est nécessaire pour la déduplication
                    })
                    .lean();

                    // Ajouter les utilisateurs des cohortes à la Map (la déduplication est gérée)
                    cohortesUtilisateurs.forEach(cu => {
                        if (cu.utilisateur) {
                            participantsMap.set(cu.utilisateur._id.toString(), cu.utilisateur);
                        }
                    });
                }
                
                // C. Récupérer les détails complets (avec population) des participants uniques
                const uniqueUserIds = Array.from(participantsMap.keys());

                const participantsDetails = await Utilisateur.find({ _id: { $in: uniqueUserIds } })
                    .select('nom prenom matricule telephone grade posteDeTravail')
                    .populate({ path: 'posteDeTravail', select: 'nomFr nomEn' })
                    .populate({ path: 'grade', select: 'nomFr nomEn' })
                    .lean(); 

                return {
                    lieu: lieu.lieu,
                    dateDebut: lieu.dateDebut,
                    dateFin: lieu.dateFin,
                    participants: participantsDetails
                };
            })
        );
        // 5. Filtrer les lieux sans participants
        const lieuxValides = lieuxAvecParticipants.filter(lieu => lieu.participants.length > 0);
        if (lieuxValides.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('aucun_participant_trouve', lang)
            });
        }

        // 6. Récupérer les infos du créateur
        let createur = null;
        if (creePar && mongoose.Types.ObjectId.isValid(creePar)) {
            createur = await Utilisateur.findById(creePar)
                .select('nom prenom')
                .lean();
        }

        // 7. Gestion de l'enregistrement de la note de service
        let noteExistante = await NoteService.findOne({ 
            theme: finalThemeId, 
            typeNote: 'fiche_presence',
            sousTypeConvocation: 'participants'
        });
        
        let noteEnregistree;

        if (noteExistante) {
            noteExistante.titreFr = titreFr || "FICHE DE PRESENCE";
            noteExistante.titreEn = titreEn || "PRESENCE FILE";
            noteExistante.copieA = copieA;
            noteExistante.creePar = creePar;
            noteExistante.valideParDG = false;
            
            noteEnregistree = await noteExistante.save({ session });
        } else {
            const reference = await genererReference();

            noteEnregistree = new NoteService({
                reference,
                theme: finalThemeId,
                typeNote: 'fiche_presence',
                sousTypeConvocation:"participants",
                titreFr: titreFr || "FICHE DE PRESENCE - PARTICIPANTS",
                titreEn: titreEn || "PRESENCE FILE - PARTICIPANTS",
                copieA: copieA,
                creePar,
                valideParDG: false
            });

            noteEnregistree = await noteEnregistree.save({ session });
        }

        // 8. Mise à jour de la tâche de formation (si fournie)
        if (tacheFormationId) {
             mettreAJourTache({
                tacheFormationId,
                statut: "EN_ATTENTE",
                donnees: `Note de convocation générée : ${noteEnregistree._id}`,
                lang,
                executePar: creePar,
                session
            });
        }
        
        // 9. Générer le PDF
        const pdfBuffer = await genererPDFFichesPresence(
            themeData,
            lieuxValides,
            lang,
            createur
        );

        const nomFichier = `fiches-presence-${themeData.titreFr.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.pdf`;

        // 10. Valider la transaction et envoyer
        await session.commitTransaction();
        session.endSession();
        
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
 *
 * @param {object} themeData - Données du thème de formation
 * @param {Array<object>} lieuxAvecParticipants - Liste des lieux et de leurs participants
 * @param {string} lang - Langue ('fr' ou 'en')
 * @param {object} createur - Données de l'utilisateur ayant créé la note
 * @returns {Promise<Buffer>} Le buffer du fichier PDF
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
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',
            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
        };

        // Log des données du template final (sans le logo Base64)
        const logData = { ...templateData };
        delete logData.logoUrl;
        
        // Charger le template
        const templatePath = path.join(__dirname, '../views/fiches-presence-participants.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Log de la taille du HTML (pour vérifier si l'EJS a réussi)

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
        return pdfBuffer;

    } catch (error) {
        console.error('!!! ERREUR CRITIQUE lors de la génération du PDF des fiches de présence:', error.message, error.stack);
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

        // Vérifier si une note existe déjà pour ce thème (fiche formateurs)
        let noteExistante = await NoteService.findOne({ 
            theme: theme, 
            typeNote: 'fiche_presence',
            sousTypeConvocation: 'formateurs' // ✅ Distinction clé
        });
        
        let noteEnregistree;

        if (noteExistante) {
            // Mettre à jour la note existante (sans modifier la référence)
            noteExistante.titreFr = titreFr || "FICHE DE PRESENCE";
            noteExistante.titreEn = titreEn || "PRESENCE FILE";
            noteExistante.creePar = creePar;
            noteExistante.valideParDG = false;
            
            noteEnregistree = await noteExistante.save({ session });
        } else {
            // Générer la référence uniquement pour une nouvelle note
            const reference = await genererReference();

            // Créer la nouvelle note de service
            noteEnregistree = new NoteService({
                reference,
                theme,
                typeNote: 'fiche_presence',
                sousTypeConvocation:"formateurs",
                titreFr: titreFr || "FICHE DE PRESENCE - FORMATEURS",
                titreEn: titreEn || "PRESENCE FILE - TRAINERS",
                copieA: "",
                creePar,
                valideParDG: false
            });

            noteEnregistree = await noteEnregistree.save({ session });
        }
        
    

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
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',
            dateTime: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
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
        return pdfBuffer;

    } catch (error) {
        console.error('Erreur lors de la génération du PDF des fiches de présence des formateurs:', error);
        throw error;
    }
};


// utilitaire pour échapper une chaîne pour RegExp
function escapeRegExp(string = '') {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /notes-service
 * Query params:
 *  - page (default 1)
 *  - limit (default 10)
 *  - search (string)
 *  - sort (e.g. createdAt:desc or titreFr:asc)
 */
export const getNotesService = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const sortQuery = req.query.sort || 'createdAt:desc';

    // parse sort
    const [sortField, sortOrder] = sortQuery.split(':');
    const sortOrderNum = (sortOrder && sortOrder.toLowerCase() === 'asc') ? 1 : -1;
    const sort = { [sortField]: sortOrderNum };

    // Build aggregation pipeline
    const pipeline = [];

    // 1) Lookups (populate-like)
    pipeline.push(
      // theme
      {
        $lookup: {
          from: 'themeformations', // nom de la collection : ThemeFormation -> themeformations
          localField: 'theme',
          foreignField: '_id',
          as: 'themeDoc'
        }
      },
      { $unwind: { path: '$themeDoc', preserveNullAndEmptyArrays: true } },

      // stage
      {
        $lookup: {
          from: 'stages',
          localField: 'stage',
          foreignField: '_id',
          as: 'stageDoc'
        }
      },
      { $unwind: { path: '$stageDoc', preserveNullAndEmptyArrays: true } },

      // mandat (StageRecherche) - collection name guessed 'stagerecherches' or 'stagerecherches'
      {
        $lookup: {
          from: 'stagerecherches',
          localField: 'mandat',
          foreignField: '_id',
          as: 'mandatDoc'
        }
      },
      { $unwind: { path: '$mandatDoc', preserveNullAndEmptyArrays: true } },

      // affectations individuelles (AffectationFinale with stagiaire)
      {
        $lookup: {
          from: 'affectationfinales',
          let: { noteStageId: '$stage' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$stage', '$$noteStageId'] }, { $ne: ['$stagiaire', null] }] } } },
            { $lookup: {
                from: 'baseutilisateurs', // utilisateurs (discriminators stored in same collection)
                localField: 'stagiaire',
                foreignField: '_id',
                as: 'stagiaireDoc'
              }
            },
            { $unwind: { path: '$stagiaireDoc', preserveNullAndEmptyArrays: true } },
            { $project: { 'stagiaireDoc.nom': 1, 'stagiaireDoc.prenom': 1 } }
          ],
          as: 'affectations'
        }
      },

      // groupes pour ce stage (Groupe)
      {
        $lookup: {
          from: 'groupes',
          let: { noteStageId: '$stage' },
          pipeline: [
            { $match: { $expr: { $eq: ['$stage', '$$noteStageId'] } } },
            { $lookup: {
                from: 'baseutilisateurs',
                let: { stagiaireIds: '$stagiaires' },
                pipeline: [
                  { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$stagiaireIds', []] }] } } },
                  { $project: { nom: 1, prenom: 1 } }
                ],
                as: 'stagiairesDocs'
            } },
            { $project: { 'stagiairesDocs': 1 } }
          ],
          as: 'groupes'
        }
      },

      // chercheurs referenced in mandatDoc (if mandatDoc.chercheurs exists)
      // we'll attempt a lookup using let so it's robust if mandatDoc.chercheurs is an array of ObjectId
      {
        $lookup: {
          from: 'baseutilisateurs', // Chercheur is a discriminator in BaseUtilisateur
          let: { mandatChercheurs: '$mandatDoc.chercheurs' },
          pipeline: [
            { $match: { $expr: { $and: [ { $gt: [ { $size: { $ifNull: ['$$mandatChercheurs', []] } }, 0 ] }, { $in: ['$_id', { $ifNull: ['$$mandatChercheurs', []] }] } ] } } },
            { $project: { nom: 1, prenom: 1 } }
          ],
          as: 'chercheursFromMandat'
        }
      },

      // créateur (creePar) - populate basic fields (nom, prenom, email)
      {
        $lookup: {
          from: 'utilisateurs',
          localField: 'creePar',
          foreignField: '_id',
          as: 'creeParDoc'
        }
      },
      { $unwind: { path: '$creeParDoc', preserveNullAndEmptyArrays: true } }
    );

    // 2) Add fields that are convenient for searching (arrays of strings)
    pipeline.push({
      $addFields: {
        // theme titles
        themeTitles: [
          { $ifNull: ['$themeDoc.titreFr', ''] },
          { $ifNull: ['$themeDoc.titreEn', ''] }
        ],
        // stage titles - assume stageDoc.titreFr/titreEn (si différents, adapte)
        stageTitles: [
          { $ifNull: ['$stageDoc.titreFr', ''] },
          { $ifNull: ['$stageDoc.titreEn', ''] }
        ],
        // mandat titles (if any)
        mandatTitles: [
          { $ifNull: ['$mandatDoc.titreFr', ''] },
          { $ifNull: ['$mandatDoc.titreEn', ''] }
        ],
        // stagiaires names from affectations
        stagiaireNames: {
          $map: {
            input: { $ifNull: ['$affectations', []] },
            as: 'a',
            in: {
              $concat: [
                { $ifNull: ['$$a.stagiaireDoc.nom', ''] },
                ' ',
                { $ifNull: ['$$a.stagiaireDoc.prenom', ''] }
              ]
            }
          }
        },
        // stagiaires from groups
        groupeStagiaireNames: {
          $reduce: {
            input: { $ifNull: ['$groupes', []] },
            initialValue: [],
            in: { $concatArrays: ['$$value', { $map: { input: { $ifNull: ['$$this.stagiairesDocs', []] }, as: 's', in: { $concat: [{ $ifNull: ['$$s.nom', ''] }, ' ', { $ifNull: ['$$s.prenom', ''] }] } } } ] }
          }
        },
        // chercheurs names (from mandat)
        chercheurNames: {
          $map: {
            input: { $ifNull: ['$chercheursFromMandat', []] },
            as: 'c',
            in: { $concat: [{ $ifNull: ['$$c.nom', ''] }, ' ', { $ifNull: ['$$c.prenom', ''] }] }
          }
        }
      }
    });

    // 3) If there's a search string -> add $match with $or on many text fields
    if (search) {
      const escaped = escapeRegExp(search);
      const regex = new RegExp(escaped, 'i');

      // Because we are in aggregation, we cannot use JS RegExp directly inside $match for fields in arrays of strings.
      // Use $or with $regex on multiple scalar fields and $elemMatch for arrays.

      pipeline.push({
        $match: {
          $or: [
            // note itself
            { titreFr: { $regex: regex } },
            { titreEn: { $regex: regex } },
            { reference: { $regex: regex } },

            // theme titles
            { 'themeDoc.titreFr': { $regex: regex } },
            { 'themeDoc.titreEn': { $regex: regex } },

            // stage titles
            { 'stageDoc.titreFr': { $regex: regex } },
            { 'stageDoc.titreEn': { $regex: regex } },

            // mandat titles
            { 'mandatDoc.titreFr': { $regex: regex } },
            { 'mandatDoc.titreEn': { $regex: regex } },

            // stagiaires from affectations (array of strings)
            { stagiaireNames: { $elemMatch: { $regex: regex } } },

            // stagiaires from groupes
            { groupeStagiaireNames: { $elemMatch: { $regex: regex } } },

            // chercheurs
            { chercheurNames: { $elemMatch: { $regex: regex } } }
          ]
        }
      });
    }

    // 4) Project fields we want to return (keep originals + some populated docs)
    pipeline.push({
      $project: {
        reference: 1,
        typeNote: 1,
        sousTypeConvocation: 1,
        titreFr: 1,
        titreEn: 1,
        descriptionFr: 1,
        descriptionEn: 1,
        fichierJoint: 1,
        filePath: 1,
        createdAt: 1,
        updatedAt: 1,
        valideParDG:1,

        // populated small docs
        theme: { _id: '$themeDoc._id', titreFr: '$themeDoc.titreFr', titreEn: '$themeDoc.titreEn' },
        stage: { _id: '$stageDoc._id', nomFr: '$stageDoc.nomFr', nomEn: '$stageDoc.nomEn' },
        mandat: { _id: '$mandatDoc._id', nomFr: '$mandatDoc.titreFr', nomEn: '$mandatDoc.titreEn' },

        // stagiaires aggregated (concat affectations + groupes)
        stagiaires: { $setUnion: ['$stagiaireNames', '$groupeStagiaireNames'] },

        // chercheurs
        chercheurs: '$chercheursFromMandat',

        creePar: { _id: '$creeParDoc._id', nom: '$creeParDoc.nom', prenom: '$creeParDoc.prenom', email: '$creeParDoc.email' }
      }
    });

    // 5) Facet for pagination + total
    const skip = (page - 1) * limit;
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit }
        ]
      }
    });

    // run aggregation
    const aggResult = await NoteService.aggregate(pipeline).exec();

    const metadata = (aggResult[0] && aggResult[0].metadata && aggResult[0].metadata[0]) || { total: 0 };
    const total = metadata.total || 0;
    const data = (aggResult[0] && aggResult[0].data) || [];
    const pages = Math.ceil(total / limit) || 1;

    return res.json({
        success: true,
        data: {
            noteServices: data,
            currentPage: page,
            totalPages: pages,
            totalItems: total,
            pageSize: limit
        }
    });
  } catch (err) {
    console.error('getNotesService error:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};


/**
 * Vérifie l'authenticité d'une note de service via son ID et retourne le PDF
 * GÈRE TOUS LES TYPES DE NOTES : stages, mandats, convocations, fiches de présence
 */
export const verifierNoteService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const { id } = req.params;

        // Validation de l'ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // Récupérer la note avec toutes les informations nécessaires
        const note = await NoteService.findById(id)
            .populate({
                path: 'stage',
                select: 'type dateDebut dateFin',
                populate: {
                    path: 'stagiaire groupes',
                    select: 'nom prenom genre parcours stagiaires',
                    options: { strictPopulate: false },
                    populate: {
                        path: 'parcours.etablissement stagiaires',
                        select: 'nomFr nomEn nom prenom',
                        options: { strictPopulate: false }
                    }
                }
            })
            .populate({
                path: 'mandat',
                select: 'chercheur superviseur',
                populate: [
                    { 
                        path: 'superviseur', 
                        select: 'nom prenom titre posteDeTravail service',
                        populate: [
                            { path: 'posteDeTravail', select: 'nomFr nomEn' },
                            { path: 'service', select: 'nomFr nomEn' }
                        ]
                    },
                    { 
                        path: 'chercheur', 
                        select: 'nom prenom etablissement doctorat domaineRecherche genre',
                        populate: {
                            path: 'etablissement',
                            select: 'nomFr nomEn'
                        }
                    }
                ]
            })
            .populate({
                path: 'theme',
                select: 'titreFr titreEn dateDebut dateFin'
            })
            .populate({
                path: 'creePar',
                select: 'nom prenom email'
            })
            .lean();

        if (!note) {
            return res.status(404).json({
                success: false,
                authentique: false,
                message: t('note_non_trouvee', lang)
            });
        }

        let pdfBuffer;
        let nomFichier;

        // Router vers la bonne fonction de génération selon le type de note
        switch (note.typeNote) {
            case 'acceptation_stage':
                pdfBuffer = await genererPDFStage(note, lang);
                nomFichier = `note-service-stage-${note.reference.replace(/\//g, '-')}.pdf`;
                break;

            case 'mandat':
                pdfBuffer = await genererPDFMandat(note, lang);
                nomFichier = `note-service-mandat-${note.reference.replace(/\//g, '-')}.pdf`;
                break;

            case 'convocation':
                pdfBuffer = await genererPDFConvocation(note, lang);
                nomFichier = `note-service-convocation-${note.sousTypeConvocation || 'general'}-${note.reference.replace(/\//g, '-')}.pdf`;
                break;

            case 'fiche_presence':
                pdfBuffer = await genererPDFFichePresence(note, lang);
                nomFichier = `fiche-presence-${note.sousTypeConvocation || 'general'}-${note.reference.replace(/\//g, '-')}.pdf`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: `Type de note non supporté: ${note.typeNote}`
                });
        }

        // Envoyer le PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length
        });
        
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur lors de la vérification de la note:', error);
        
        return res.status(500).json({
            success: false,
            authentique: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Génère le PDF pour une note de STAGE (individuel ou groupe)
 */
const genererPDFStage = async (note, lang) => {
    const stageData = await Stage.findById(note.stage._id)
        .populate({
            path: 'stagiaire',
            select: 'nom prenom genre parcours',
            options: { strictPopulate: false },
            populate: {
                path: 'parcours.etablissement',
                select: 'nomFr nomEn',
                options: { strictPopulate: false }
            }
        })
        .populate({
            path: 'groupes',
            populate: {
                path: 'stagiaires',
                select: 'nom prenom genre parcours',
                options: { strictPopulate: false },
                populate: {
                    path: 'parcours.etablissement',
                    select: 'nomFr nomEn',
                    options: { strictPopulate: false }
                }
            }
        })
        .lean();

    const createur = await Utilisateur.findById(note.creePar).lean();

    // STAGE INDIVIDUEL
    if (stageData.type === 'INDIVIDUEL') {
        const affectations = await AffectationFinale.find({ 
            stage: note.stage._id,
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

        if (!affectations || affectations.length === 0) {
            throw new Error('Affectations non trouvées pour ce stage');
        }

        // 1 affectation = stage simple
        if (affectations.length === 1) {
            return await genererPDFStageIndividuel(
                note, 
                stageData, 
                affectations[0], 
                lang,
                createur
            );
        }
        // Plusieurs affectations = stage avec rotations
        else {
            return await genererPDFStageRotations(
                note, 
                stageData, 
                affectations, 
                lang,
                createur
            );
        }
    }
    // STAGE DE GROUPE
    else if (stageData.type === 'GROUPE') {
        const rotations = await Rotation.find({ 
            stage: note.stage._id,
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

        const affectations = await AffectationFinale.find({ 
            stage: note.stage._id,
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

        return await genererPDFStageGroupe(
            note, 
            stageData, 
            rotations,
            affectations,
            lang,
            createur
        );
    }
    else {
        throw new Error(`Type de stage non supporté: ${stageData.type}`);
    }
};

/**
 * Génère le PDF pour une note de MANDAT
 */
const genererPDFMandat = async (note, lang) => {
    // Générer l'URL de vérification
    const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
    const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;
    
    // Générer le QR code
    const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 100,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    });

    const templateData = {
        documentTitle: 'Note de Service - Mandat de Recherche',
        logoUrl: getLogoBase64(__dirname),
        
        // QR Code et référence
        qrCodeUrl: qrCodeDataUrl,
        urlVerification: urlVerification,
        referenceSysteme: note.reference || 'REF-XXX',
        
        userSexe: note.mandat.chercheur?.genre === 'M' ? "Monsieur" : "Madame",
        userFullName: `${note.mandat.chercheur?.nom} ${note.mandat.chercheur?.prenom}`,
        inscrit: note.mandat.chercheur?.genre === 'M' ? "inscrit" : "inscrite",
        userDoctorat: note.mandat.chercheur?.doctorat || "__________",
        userUniversity: note.mandat.chercheur?.etablissement?.nomFr || "___________",
        userTheme: note.mandat?.chercheur.domaineRecherche || "______________",
        userSupervisorSexe: note.mandat.superviseur?.genre === 'M' ? "Monsieur" : "Madame",
        userSupervisorFullName: `${note.mandat.superviseur?.nom} ${note.mandat.superviseur?.prenom}`,
        userSupervisorPoste: note.mandat.superviseur?.posteDeTravail?.nomFr || "______________",
        userSupervisorStructure: note.mandat.superviseur?.service?.nomFr || "______________",
        
        mandatCopie: note.copieA
            ? note.copieA.split(/[;,]/)
                .map(e => e.trim())
                .filter(e => e.length > 0)
            : ['Intéressé(e)', 'Archives/Chrono'],
        
        createurNom: note.creePar ? `${note.creePar.nom} ${note.creePar.prenom || ''}`.trim() : 'Système',
        
        dateTime: new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
        })
    };

    const templatePath = path.join(__dirname, '../views/note-service-mandat.ejs');
    const html = await ejs.renderFile(templatePath, templateData);

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
    return pdfBuffer;
};

/**
 * Génère le PDF pour une note de CONVOCATION (formateurs ou participants)
 */
const genererPDFConvocation = async (note, lang) => {
    const createur = await Utilisateur.findById(note.creePar)
        .select('nom prenom')
        .lean();

    // CONVOCATION FORMATEURS
    if (note.sousTypeConvocation === 'formateurs') {
        const formateurs = await Formateur.find({ theme: note.theme._id })
            .populate({
                path: 'utilisateur',
                select: 'nom prenom',
            })
            .lean();

        const themeData = await ThemeFormation.findById(note.theme._id)
            .select('libelleFr libelleEn dateDebut dateFin lieu')
            .lean();

        return await genererPDFConvocationFormateurs(
            note,
            themeData,
            formateurs,
            lang,
            createur
        );
    }
    // CONVOCATION PARTICIPANTS
    else if (note.sousTypeConvocation === 'participants') {
        const themeData = await ThemeFormation.findById(note.theme._id)
            .select('titreFr titreEn dateDebut dateFin')
            .lean();

        // Récupérer les lieux de formation
        const lieuxFormation = await LieuFormation.find({ theme: note.theme._id })
            .populate({
                path: 'cohortes',
                select: '_id'
            });

        // Résoudre les participants
        const participantsMap = new Map();

        // Participants ciblés
        const allUsers = await Utilisateur.find({ actif: true })
            .select('_id nom prenom posteDeTravail structure service')
            .populate({
                path: 'posteDeTravail',
                select: 'famillesMetier nomFr nomEn'
            })
            .populate({
                path: 'service',
                select: 'nomFr nomEn'
            })
            .lean();

        const checkPromises = allUsers.map(user => checkUserTargeting(user, lieuxFormation));
        const targetedParticipantsResults = await Promise.all(checkPromises);

        targetedParticipantsResults.filter(p => p !== null).forEach(participant => {
            participantsMap.set(participant.utilisateur._id.toString(), participant);
        });

        // Participants des cohortes
        const toutesLesCohortes = lieuxFormation.flatMap(lieu =>
            lieu.cohortes.map(c => c._id)
        );

        if (toutesLesCohortes.length > 0) {
            const cohortesUtilisateurs = await CohorteUtilisateur.find({
                cohorte: { $in: toutesLesCohortes }
            })
            .populate({
                path: 'utilisateur',
                select: '_id nom prenom posteDeTravail service',
                populate: [
                    { path: 'posteDeTravail', select: 'nomFr nomEn' },
                    { path: 'service', select: 'nomFr nomEn' }
                ]
            })
            .lean();

            for (const cu of cohortesUtilisateurs) {
                if (!cu.utilisateur) continue;
                const userId = cu.utilisateur._id.toString();

                if (participantsMap.has(userId)) continue;

                const lieuAssocie = lieuxFormation.find(lieu =>
                    lieu.cohortes.some(c => c._id.equals(cu.cohorte))
                );

                if (!lieuAssocie) continue;

                participantsMap.set(userId, {
                    utilisateur: cu.utilisateur,
                    lieu: lieuAssocie.lieu,
                    dateDebut: lieuAssocie.dateDebut,
                    dateFin: lieuAssocie.dateFin,
                    source: "cohorte"
                });
            }
        }

        const tousLesParticipants = Array.from(participantsMap.values());

        return await genererPDFConvocationParticipants(
            note,
            themeData,
            tousLesParticipants,
            lang,
            createur
        );
    }
    else {
        throw new Error(`Sous-type de convocation non supporté: ${note.sousTypeConvocation}`);
    }
};

/**
 * Génère le PDF pour une FICHE DE PRÉSENCE (formateurs ou participants)
 */
const genererPDFFichePresence = async (note, lang) => {
    const createur = await Utilisateur.findById(note.creePar)
        .select('nom prenom')
        .lean();

    const themeData = await ThemeFormation.findById(note.theme._id)
        .select('titreFr titreEn')
        .lean();

    // FICHE FORMATEURS
    if (note.sousTypeConvocation === 'formateurs') {
        const formateursData = await Formateur.find({ theme: note.theme._id })
            .populate({
                path: 'utilisateur',
                select: 'nom prenom matricule telephone grade posteDeTravail',
                populate: [
                    { path: 'posteDeTravail', select: 'nomFr nomEn' },
                    { path: 'grade', select: 'nomFr nomEn' }
                ]
            })
            .lean();

        const lieuxFormation = await LieuFormation.find({ theme: note.theme._id })
            .select('dateDebut dateFin')
            .sort({ dateDebut: 1 })
            .lean();

        let dateDebut = null;
        let dateFin = null;

        if (lieuxFormation && lieuxFormation.length > 0) {
            dateDebut = lieuxFormation[0].dateDebut;
            dateFin = lieuxFormation[lieuxFormation.length - 1].dateFin;
        }

        return await genererPDFFichesPresenceFormateurs(
            themeData,
            formateursData,
            dateDebut,
            dateFin,
            lang,
            createur
        );
    }
    // FICHE PARTICIPANTS
    else if (note.sousTypeConvocation === 'participants') {
        const lieuxFormation = await LieuFormation.find({ theme: note.theme._id })
            .populate({
                path: 'cohortes',
                select: '_id'
            })
            .sort({ lieu: 1 });

        const lieuxAvecParticipants = await Promise.all(
            lieuxFormation.map(async (lieu) => {
                const participantsMap = new Map();
                
                const targetedUsers = await lieu.resolveTargetedUsers();
                targetedUsers.forEach(user => {
                    participantsMap.set(user._id.toString(), user);
                });
                
                if (lieu.cohortes && lieu.cohortes.length > 0) {
                    const cohorteIds = lieu.cohortes.map(c => c._id);
                    
                    const cohortesUtilisateurs = await CohorteUtilisateur.find({
                        cohorte: { $in: cohorteIds }
                    })
                    .populate({
                        path: 'utilisateur',
                        select: '_id nom prenom'
                    })
                    .lean();

                    cohortesUtilisateurs.forEach(cu => {
                        if (cu.utilisateur) {
                            participantsMap.set(cu.utilisateur._id.toString(), cu.utilisateur);
                        }
                    });
                }
                
                const uniqueUserIds = Array.from(participantsMap.keys());

                const participantsDetails = await Utilisateur.find({ _id: { $in: uniqueUserIds } })
                    .select('nom prenom matricule telephone grade posteDeTravail')
                    .populate({ path: 'posteDeTravail', select: 'nomFr nomEn' })
                    .populate({ path: 'grade', select: 'nomFr nomEn' })
                    .lean();

                return {
                    lieu: lieu.lieu,
                    dateDebut: lieu.dateDebut,
                    dateFin: lieu.dateFin,
                    participants: participantsDetails
                };
            })
        );

        const lieuxValides = lieuxAvecParticipants.filter(lieu => lieu.participants.length > 0);

        return await genererPDFFichesPresence(
            themeData,
            lieuxValides,
            lang,
            createur
        );
    }
    else {
        throw new Error(`Sous-type de fiche non supporté: ${note.sousTypeConvocation}`);
    }
};

/**
 * Génère une page HTML de vérification (pour affichage dans le navigateur)
 * Cette fonction reste disponible si vous voulez un aperçu HTML
 */
export const afficherVerificationNote = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vérification - Erreur</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            max-width: 600px; 
                            margin: 50px auto; 
                            padding: 20px;
                            text-align: center;
                        }
                        .error { 
                            color: #d32f2f; 
                            font-size: 18px;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <h1>❌ Erreur de vérification</h1>
                    <p class="error">Identifiant invalide</p>
                </body>
                </html>
            `);
        }

        const note = await NoteService.findById(id)
            .populate('stage.stagiaire', 'nom prenom')
            .populate('mandat.chercheur', 'nom prenom')
            .populate('theme', 'titreFr titreEn')
            .populate('creePar', 'nom prenom')
            .lean();

        if (!note) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vérification - Non trouvée</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            max-width: 600px; 
                            margin: 50px auto; 
                            padding: 20px;
                            text-align: center;
                        }
                        .warning { 
                            color: #f57c00; 
                            font-size: 18px;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <h1>⚠️ Note non trouvée</h1>
                    <p class="warning">Cette note de service n'existe pas dans notre système</p>
                </body>
                </html>
            `);
        }

        // Générer la page HTML de vérification
        const html = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vérification Note de Service</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    
                    .container {
                        max-width: 600px;
                        margin: 50px auto;
                        background: white;
                        border-radius: 15px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        overflow: hidden;
                    }
                    
                    .header {
                        background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                    }
                    
                    .header h1 {
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    
                    .badge {
                        display: inline-block;
                        background: rgba(255,255,255,0.2);
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        margin-top: 10px;
                    }
                    
                    .content {
                        padding: 30px;
                    }
                    
                    .info-row {
                        margin-bottom: 20px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    
                    .info-row:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    
                    .label {
                        font-weight: bold;
                        color: #666;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 5px;
                    }
                    
                    .value {
                        font-size: 16px;
                        color: #333;
                        margin-top: 5px;
                    }
                    
                    .status {
                        display: inline-block;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: bold;
                    }
                    
                    .status.valide {
                        background: #d4edda;
                        color: #155724;
                    }
                    
                    .status.en-attente {
                        background: #fff3cd;
                        color: #856404;
                    }
                    
                    .footer {
                        background: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                    
                    .btn-download {
                        display: inline-block;
                        margin-top: 20px;
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 25px;
                        font-weight: bold;
                        transition: transform 0.2s;
                    }
                    
                    .btn-download:hover {
                        transform: translateY(-2px);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Note de Service Authentique</h1>
                        <div class="badge">Document Vérifié</div>
                    </div>
                    
                    <div class="content">
                        <div class="info-row">
                            <div class="label">Référence Système</div>
                            <div class="value">${note.reference}</div>
                        </div>
                        
                        <div class="info-row">
                            <div class="label">Type de Note</div>
                            <div class="value">${note.typeNote.toUpperCase()}${note.sousTypeConvocation ? ' - ' + note.sousTypeConvocation.toUpperCase() : ''}</div>
                        </div>
                        
                        <div class="info-row">
                            <div class="label">Titre</div>
                            <div class="value">${lang === 'fr' ? note.titreFr : note.titreEn}</div>
                        </div>
                        
                        <div class="info-row">
                            <div class="label">Date de création</div>
                            <div class="value">${new Date(note.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                        
                        <div class="info-row">
                            <div class="label">Statut de validation</div>
                            <div class="value">
                                <span class="status ${note.valideParDG ? 'valide' : 'en-attente'}">
                                    ${note.valideParDG ? 'Validée par le DG' : 'En attente de validation'}
                                </span>
                            </div>
                        </div>
                        
                        ${note.creePar ? `
                        <div class="info-row">
                            <div class="label">Créé par</div>
                            <div class="value">${note.creePar.nom} ${note.creePar.prenom || ''}</div>
                        </div>
                        ` : ''}
                        
                        <div style="text-align: center;">
                            <a href="/api/notes-service/verifier/${id}" class="btn-download" target="_blank">
                                📄 Télécharger le PDF
                            </a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>🔒 Ce document a été vérifié via le système de gestion des notes de service</p>
                        <p style="margin-top: 10px;">Direction Générale des Impôts - Cameroun</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return res.send(html);

    } catch (error) {
        console.error('Erreur lors de l\'affichage de la vérification:', error);
        
        return res.status(500).send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Erreur</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        max-width: 600px; 
                        margin: 50px auto; 
                        padding: 20px;
                        text-align: center;
                    }
                    .error { 
                        color: #d32f2f; 
                        font-size: 18px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <h1>❌ Erreur serveur</h1>
                <p class="error">Une erreur est survenue lors de la vérification</p>
            </body>
            </html>
        `);
    }
};


const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

export const validerNoteService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { noteId } = req.params;
    const session = await mongoose.startSession();

    // Helper pour supprimer le fichier uploadé en cas d'erreur
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
        // Validation de l'ID
        if (!mongoose.Types.ObjectId.isValid(noteId)) {
            await cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // Vérifie si la note existe
        const note = await NoteService.findById(noteId).session(session);
        if (!note) {
            await cleanupUploadedFile();
            return res.status(404).json({
                success: false,
                message: t('note_non_trouve', lang)
            });
        }

        // Vérifie qu'un fichier est uploadé
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: t('fichier_obligatoire', lang)
            });
        }

        // Validation du type de fichier
        const allowedExtensions = ['.pdf'];
        const extension = path.extname(req.file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            await cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: t('format_fichier_invalide', lang),
                formatsAcceptes: allowedExtensions
            });
        }

        // Lecture du PDF
        const resultat = await validerReferencePDF(req.file.path, note.reference, t, lang);

        if (!resultat.valide) {
            // Supprimer le fichier uploadé si la validation échoue
            await cleanupUploadedFile();

            return res.status(400).json({
                success: false,
                message: resultat.message,
                details: {
                    referenceAttendue: note.reference,
                    referenceExtraite: resultat.referenceExtraite
                }
            });
        }

        // Dossier de stockage
        
        
        const uploadsDir = path.join(process.cwd(), 'public/uploads/notes_service');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Supprime l'ancien fichier si existant
        if (note.filePath) {
            const oldFile = path.join(process.cwd(), note.filePath);
            if (await existsAsync(oldFile)) {
                await unlinkAsync(oldFile);
            }
        }

        // Déplace le nouveau fichier
        const fileRelatif = `/uploads/notes_service/${req.file.filename}`;
        const fileDest = path.join(uploadsDir, req.file.filename);
        fs.renameSync(req.file.path, fileDest);

        // Mise à jour de la note
        note.filePath = fileRelatif;
        note.valideParDG = true;
         // 🔵 SYNCHRONISATION : Si la note concerne un STAGE → mettre à jour le stage
        if (note.typeNote === "acceptation_stage" || note.typeNote === "mandat") {
            if (note.stage) {
                await Stage.findByIdAndUpdate(note.stage, {
                    statut: "ACCEPTE",
                    noteService: fileRelatif,
                });
            }
        }
        await note.save({ session });

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: note
        });

    } catch (error) {
        await cleanupUploadedFile();
        console.error('Erreur validerNoteService:', error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};



export const deleteNoteService = async (req, res) => {
  try {
    const { id } = req.params;
    const lang = req.headers['accept-language'] || 'fr';

    // Vérifie si la note existe
    const note = await NoteService.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: t('note_service_non_trouvee', lang)
      });
    }

    // Vérifie si la note est déjà validée par le DG
    if (note.valideParDG === true) {
      return res.status(400).json({
        success: false,
        message: t('note_service_deja_validee_DG', lang)  // <-- Ajoute cette clé dans tes traductions
      });
    }

    // Supprime le fichier si filePath existe
    const uploadsDir = path.join(process.cwd(), 'public/uploads/notes_service');
    if (note.filePath) {
      const nomFichier = path.basename(note.filePath);
      const fichierPhysique = path.join(uploadsDir, nomFichier);
      fs.unlink(fichierPhysique, (err) => {
        if (err) console.error('Erreur suppression fichier:', err);
      });
    }

    // Supprime la note de service en base
    await note.deleteOne();

    return res.json({
      success: true,
      message: t('supprimer_succes', lang)
    });

  } catch (err) {
    console.error('deleteNoteService error:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });
  }
};



export const telechargerNoteDeService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: t('identifiant_invalide', lang),
        });
    }

    try {
        const note = await NoteService.findById(id);
        if (!note || !note.filePath) {
            return res.status(404).json({
                success: false,
                message: t('note_service_non_trouvee', lang),
            });
        }

        const nomFichier = path.basename(note.filePath);
        const cheminFichier = path.join(process.cwd(), 'public/uploads', 'notes_service', nomFichier);
        
        if (!fs.existsSync(cheminFichier)) {
            return res.status(404).json({
                success: false,
                message: t('fichier_introuvable', lang),
            });
        }

        return res.download(cheminFichier, nomFichier);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

