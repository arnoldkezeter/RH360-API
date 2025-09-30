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
        
        const noteEnregistree = await nouvelleNote.save({ session });
        const createur = Utilisateur.findById(creePar);
        // Générer le PDF
        let pdfBuffer;
         if (affectations.length === 1) {
            pdfBuffer = await genererPDFStageIndividuel(
                noteEnregistree, 
                stageData, 
                affectations[0], 
                lang,
                createur
            );
        }else{
            pdfBuffer = await genererPDFStageRotations(
                noteEnregistree, 
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
            createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système'
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