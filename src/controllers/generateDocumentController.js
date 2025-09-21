import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Stagiaire from '../models/Stagiaire.js';
import Stage from '../models/Stage.js';
import {Groupe} from '../models/Groupe.js';
import { AffectationFinale } from '../models/AffectationFinale.js';
import { t } from '../utils/i18n.js';
import mongoose from 'mongoose';
import Utilisateur from '../models/Utilisateur.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {object} PdfData
 * @property {string} headerLeftText - Texte de l'en-tête gauche.
 * @property {string} headerRightText - Texte de l'en-tête droit.
 * @property {string} logoUrl - URL du logo.
 * @property {string} documentTitle - Titre du document.
 * @property {string} documentBody - Contenu HTML du corps (texte ou tableau).
 */

/**
 * Génère le contenu HTML pour un tableau à partir d'un tableau de données.
 * @param {Array<object>} data - Les données à afficher dans le tableau.
 * @returns {string} Le code HTML du tableau.
 */
const generateTableHtml = (data) => {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]).map(key => `<th>${key}</th>`).join('');
    const rows = data.map(row => {
        const rowCells = Object.values(row).map(value => `<td>${value}</td>`).join('');
        return `<tr>${rowCells}</tr>`;
    }).join('');

    return `
        <table class="document-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

/**
 * Contrôleur pour générer et envoyer un PDF en réponse.
 * @param {object} req - L'objet de la requête Express.
 * @param {object} res - L'objet de la réponse Express.
 */
export const generateDocumentPdf = async (req, res) => {
    let browser;
    try {
        // const { documentOptions="", tableData } = req.body;

        // if (!documentOptions || !documentOptions.documentTitle) {
        //     return res.status(400).json({ success: false, message: 'Le titre du document est requis.' });
        // }

        let documentBody = '<p>Aucun contenu fourni.</p>';
        // if (tableData && Array.isArray(tableData) && tableData.length > 0) {
        //     documentBody = generateTableHtml(tableData);
        // } else {
        //     documentBody = documentOptions.documentBody || '<p>Aucun contenu fourni.</p>';
        // }

        // --- Ligne mise à jour ---
        // Le chemin est maintenant relatif au contrôleur, en remontant d'un niveau pour atteindre src/
        const templatePath = path.join(__dirname, '..', 'templates', 'pdf-template.html');
        // -------------------------

        let templateHtml = await readFile(templatePath, 'utf8');

        const finalHtml = templateHtml
            .replace('{{headerLeftText}}', 'documentOptions.headerLeftText' || '')
            .replace('{{headerRightText}}', 'documentOptions.headerRightText' || '')
            .replace('{{logoUrl}}', 'documentOptions.logoUrl' || '')
            .replace('{{documentTitle}}', 'documentOptions.documentTitle' || '')
            .replace('{{documentBody}}', documentBody);

        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${'documentOptions.documentTitle'.replace(/\s/g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        res.status(500).json({ success: false, message: 'Erreur lors de la génération du document PDF.', error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};





// Fonction utilitaire pour générer le tableau HTML des stagiaires
const generateStagiairesTableHtml = (data, lang) => {
    if (!data || data.length === 0) {
        return `<p>Aucun stagiaire ne correspond à vos critères de recherche.</p>`;
    }

    const headers = [
        t('nom', lang), t('prenom', lang), t('email', lang), t('etablissement', lang),
        t('commune', lang), t('periode_stage', lang), t('statut', lang)
    ].map(key => `<th>${key}</th>`).join('');

    const rows = data.map(stagiaire => {
        const etablissementName = lang === 'fr' 
            ? stagiaire.parcours?.[0]?.etablissement?.nomFr || 'N/A' 
            : stagiaire.parcours?.[0]?.etablissement?.nomEn || 'N/A';
            
        const communeName = lang === 'fr'
            ? stagiaire.commune?.nomFr || 'N/A'
            : stagiaire.commune?.nomEn || 'N/A';

        const stagePeriod = stagiaire.periode
            ? `${new Date(stagiaire.periode.dateDebut).toLocaleDateString()} - ${new Date(stagiaire.periode.dateFin).toLocaleDateString()}`
            : 'N/A';

        const statutText = t(stagiaire.statut.toLowerCase(), lang);

        return `
            <tr>
                <td>${stagiaire.nom}</td>
                <td>${stagiaire.prenom}</td>
                <td>${stagiaire.email}</td>
                <td>${etablissementName}</td>
                <td>${communeName}</td>
                <td>${stagePeriod}</td>
                <td>${statutText}</td>
            </tr>
        `;
    }).join('');

    return `
        <table class="document-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

/**
 * Contrôleur pour générer un PDF de la liste des stagiaires.
 * Utilise les mêmes filtres que le contrôleur de pagination.
 * @param {object} req - L'objet de la requête Express.
 * @param {object} res - L'objet de la réponse Express.
 */
export const generateStagiairesPdf = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin, serviceId, etablissement, statut, search } = req.query;

    let browser;
    try {
        // --- REPRISE DE LA LOGIQUE DE FILTRAGE DU CONTRÔLEUR PAGINÉ ---
        // (Copiez ici le pipeline d'agrégation complet de votre contrôleur existant, sans la pagination)
        const pipeline = [];
        const stageFilters = {};
        const affectationFilters = {};

        // 1. Filtrer par date et service dans AffectationFinale
        if (dateDebut && dateFin) {
            affectationFilters.dateDebut = { $gte: new Date(dateDebut) };
            affectationFilters.dateFin = { $lte: new Date(dateFin) };
        }
        if (serviceId) {
            affectationFilters.service = new mongoose.Types.ObjectId(serviceId);
        }

        if (Object.keys(affectationFilters).length > 0) {
            const affectedStages = await AffectationFinale.find(affectationFilters).distinct('stage').lean();
            stageFilters._id = { $in: affectedStages };
        }

        if (statut) {
            stageFilters.statut = statut;
        }

        const stagiaireFilters = {};
        if (search) {
            stagiaireFilters.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { prenom: { $regex: search, $options: 'i' } },
            ];
        }
        if (etablissement) {
            stagiaireFilters['parcours.etablissement'] = new mongoose.Types.ObjectId(etablissement);
        }
        pipeline.push({ $match: stagiaireFilters });

        pipeline.push({
            $lookup: { from: 'stages', localField: 'stages', foreignField: '_id', as: 'individualStages' }
        });
        pipeline.push({
            $lookup: { from: 'groupes', localField: '_id', foreignField: 'stagiaires', as: 'groups' }
        });
        pipeline.push({
            $unwind: { path: '$groups', preserveNullAndEmptyArrays: true }
        });
        pipeline.push({
            $lookup: { from: 'stages', localField: 'groups.stage', foreignField: '_id', as: 'groupStage' }
        });
        pipeline.push({
            $unwind: { path: '$groupStage', preserveNullAndEmptyArrays: true }
        });

        pipeline.push({
            $addFields: {
                allStages: {
                    $filter: {
                        input: { $concatArrays: ['$individualStages', ['$groupStage']] },
                        as: 'stage',
                        cond: { $ne: ['$$stage', null] }
                    }
                }
            }
        });
        pipeline.push({ $match: { 'allStages._id': { $exists: true } } });
        
        if (Object.keys(stageFilters).length > 0) {
            pipeline.push({ $match: { 'allStages': { $elemMatch: stageFilters } } });
        }
        
        pipeline.push({
            $project: {
                _id: 1, nom: 1, prenom: 1, email: 1, genre: 1,
                commune: 1, parcours: 1,
                dernierStage: {
                    $first: {
                        $sortArray: { input: '$allStages', sortBy: { dateDebut: -1 } }
                    }
                }
            }
        });

        pipeline.push({
            $lookup: { from: 'etablissements', localField: 'parcours.etablissement', foreignField: '_id', as: 'parcoursEtablissement' }
        });
        pipeline.push({
            $addFields: {
                'parcours.etablissement': { $arrayElemAt: ['$parcoursEtablissement', 0] }
            }
        });
        pipeline.push({
            $lookup: { from: 'communes', localField: 'commune', foreignField: '_id', as: 'communeDetails' }
        });
        pipeline.push({
            $addFields: {
                commune: { $arrayElemAt: ['$communeDetails', 0] }
            }
        });

        const allStagiaires = await Stagiaire.aggregate(pipeline);
        const formattedStagiaires = allStagiaires.map(stagiaire => ({
            ...stagiaire,
            statut: stagiaire.dernierStage?.statut || 'EN_ATTENTE',
            periode: stagiaire.dernierStage?.dateDebut && stagiaire.dernierStage?.dateFin
                ? { dateDebut: stagiaire.dernierStage.dateDebut, dateFin: stagiaire.dernierStage.dateFin }
                : null
        }));

        // --- GÉNÉRATION DU PDF ---
        const bodyContent = generateStagiairesTableHtml(formattedStagiaires, lang);
        const documentTitle = t('rapport_stagiaires', lang);
        
        const templatePath = path.join(__dirname, '..', 'templates', 'pdf-template.html');
        let templateHtml = await readFile(templatePath, 'utf8');

        const finalHtml = templateHtml
            .replace('{{headerLeftText}}', `${t('genere_le', lang)}: ${'new Date().toLocaleDateString(lang)'}`)
            .replace('{{headerRightText}}', t('liste_stagiaires', lang))
            .replace('{{logoUrl}}', 'https://via.placeholder.com/120x60.png?text=Logo')
            .replace('{{documentTitle}}', documentTitle)
            .replace('{{documentBody}}', bodyContent);

        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            landscape: true // Option pour l'orientation paysage si le tableau est large
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${documentTitle.replace(/\s/g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Erreur lors de la génération du PDF des stagiaires:", error);
        res.status(500).json({
            success: false,
            message: `Une erreur est survenue lors de la génération du rapport (${lang})`,
            error: error.message,
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};



/**
 * Fonction utilitaire pour générer le tableau HTML des utilisateurs
 * @param {Array<object>} data - Les données des utilisateurs
 * @param {string} lang - La langue pour les traductions
 * @returns {string} Le code HTML du tableau
 */
const generateUsersTableHtml = (data, lang) => {
    if (!data || data.length === 0) {
        return `<p>Aucun utilisateur ne correspond à vos critères de recherche.</p>`;
    }

    const headers = [
        t('matricule', lang), t('nom', lang), t('prenom', lang), t('email', lang),
        t('service', lang), t('grade', lang), t('famille_metier', lang), t('poste_de_travail', lang), 
        t('categorie_professionnelle', lang), t('region', lang), t('departement', lang), t('commune', lang)
    ].map(key => `<th>${key}</th>`).join('');

    const rows = data.map(user => {
        const getLocalizedName = (obj) => {
            if (!obj) return 'N/A';
            return lang === 'fr' ? obj.nomFr || obj.nomEn : obj.nomEn || obj.nomFr;
        };
        
        const commune = getLocalizedName(user.commune);
        const departement = getLocalizedName(user.commune?.departement);
        const region = getLocalizedName(user.commune?.departement?.region);
        
        return `
            <tr>
                <td>${user.matricule || 'N/A'}</td>
                <td>${user.nom}</td>
                <td>${user.prenom || 'N/A'}</td>
                <td>${user.email}</td>
                <td>${getLocalizedName(user.service)}</td>
                <td>${getLocalizedName(user.grade)}</td>
                <td>${getLocalizedName(user.familleMetier)}</td>
                <td>${getLocalizedName(user.posteDeTravail)}</td>
                <td>${getLocalizedName(user.categorieProfessionnelle)}</td>
                <td>${region}</td>
                <td>${departement}</td>
                <td>${commune}</td>
            </tr>
        `;
    }).join('');

    return `
        <table class="document-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

/**
 * Contrôleur pour générer un PDF de la liste des utilisateurs.
 * @param {object} req - L'objet de la requête Express.
 * @param {object} res - L'objet de la réponse Express.
 */
export const generateUsersPdf = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { service, region, departement, commune, categorieProfessionnelle, familleMetier, posteDeTravail, grade } = req.query;

    const query = {};
    if (service && mongoose.Types.ObjectId.isValid(service)) query.service = service;
    if (grade && mongoose.Types.ObjectId.isValid(grade)) query.grade = grade;
    if (categorieProfessionnelle && mongoose.Types.ObjectId.isValid(categorieProfessionnelle)) query.categorieProfessionnelle = categorieProfessionnelle;
    if (familleMetier && mongoose.Types.ObjectId.isValid(familleMetier)) query.familleMetier = familleMetier;
    if (posteDeTravail && mongoose.Types.ObjectId.isValid(posteDeTravail)) query.posteDeTravail = posteDeTravail;
    
    let browser;
    try {
        // Gérer les filtres de localisation qui sont plus complexes
        if (commune && mongoose.Types.ObjectId.isValid(commune)) {
            query.commune = commune;
        } else if (departement && mongoose.Types.ObjectId.isValid(departement)) {
            const communesInDepartement = await mongoose.model('Commune').find({ departement: departement }).select('_id');
            query.commune = { $in: communesInDepartement.map(c => c._id) };
        } else if (region && mongoose.Types.ObjectId.isValid(region)) {
            const departementsInRegion = await mongoose.model('Departement').find({ region: region }).select('_id');
            const communesInRegion = await mongoose.model('Commune').find({ departement: { $in: departementsInRegion.map(d => d._id) } }).select('_id');
            query.commune = { $in: communesInRegion.map(c => c._id) };
        }

        const utilisateurs = await Utilisateur.find(query)
            .sort({ nom: 1, prenom: 1 })
            .populate([
                { path: 'service', select: 'nomFr nomEn' },
                { path: 'grade', select: 'nomFr nomEn' },
                { path: 'categorieProfessionnelle', select: 'nomFr nomEn' },
                { path: 'familleMetier', select: 'nomFr nomEn' },
                { path: 'posteDeTravail', select: 'nomFr nomEn' },
                { 
                    path: 'commune', 
                    select: 'nomFr nomEn departement',
                    options: { strictPopulate: false },
                    populate: {
                        path: 'departement',
                        select: 'nomFr nomEn region',
                        options: { strictPopulate: false },
                        populate: {
                            path: 'region',
                            select: 'nomFr nomEn',
                            options: { strictPopulate: false }
                        }
                    }
                }
            ])
            .lean();

        if (utilisateurs.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun utilisateur trouvé.' });
        }

        const bodyContent = generateUsersTableHtml(utilisateurs, lang);
        const documentTitle = t('rapport_utilisateurs', lang);
        
        const templatePath = path.join(__dirname, '..', 'templates', 'pdf-template.html');
        let templateHtml = await readFile(templatePath, 'utf8');

        const finalHtml = templateHtml
            .replace('{{headerLeftText}}', `${t('genere_le', lang)}: ${'new Date().toLocaleDateString(lang)'}`)
            .replace('{{headerRightText}}', t('liste_utilisateurs', lang))
            .replace('{{logoUrl}}', 'https://via.placeholder.com/120x60.png?text=Logo')
            .replace('{{documentTitle}}', documentTitle)
            .replace('{{documentBody}}', bodyContent);

        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            landscape: true
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${documentTitle.replace(/\s/g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Erreur lors de la génération du PDF des utilisateurs:", error);
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la génération du rapport.',
            error: error.message,
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};