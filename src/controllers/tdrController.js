// controllers/tdrController.js
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

import ThemeFormation from '../models/ThemeFormation.js';
import { LieuFormation } from '../models/LieuFormation.js';
import { Formateur } from '../models/Formateur.js';
import { Objectif } from '../models/Objectif.js';
import Depense from '../models/Depense.js';
import NoteService from '../models/NoteService.js';
import Utilisateur from '../models/Utilisateur.js';
import { CohorteUtilisateur } from '../models/CohorteUtilisateur.js';
import { t } from '../utils/i18n.js';
import { getLogoBase64 } from '../utils/logoBase64.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

/**
 * Résout les dates du thème :
 * - Utilise ThemeFormation.dateDebut/dateFin si définies
 * - Sinon calcule à partir des LieuFormation (min dateDebut, max dateFin)
 */
const resoudreDates = (theme, lieux) => {
    if (theme.dateDebut && theme.dateFin) {
        return { dateDebut: theme.dateDebut, dateFin: theme.dateFin };
    }

    const lieuxAvecDates = lieux.filter(l => l.dateDebut && l.dateFin);
    if (lieuxAvecDates.length === 0) {
        return { dateDebut: null, dateFin: null };
    }

    const dateDebut = new Date(Math.min(...lieuxAvecDates.map(l => new Date(l.dateDebut))));
    const dateFin = new Date(Math.max(...lieuxAvecDates.map(l => new Date(l.dateFin))));
    return { dateDebut, dateFin };
};

/**
 * Calcule le nombre de participants uniques :
 * publicCible du ThemeFormation + utilisateurs des cohortes des LieuFormation
 * avec déduplication par _id
 */
const compterParticipants = async (theme, lieux) => {
    const userIds = new Set();

    // 1. Participants via publicCible du ThemeFormation
    try {
        const utilisateursPublicCible = await theme.resolveTargetedUsers();
        utilisateursPublicCible.forEach(u => userIds.add(u._id.toString()));
    } catch (e) {
        logger.error('TDR - erreur resolveTargetedUsers:', e);
    }

    // 2. Participants via cohortes des LieuFormation
    const toutesLesCohortes = lieux.flatMap(l => (l.cohortes || []).map(c => c._id || c));

    if (toutesLesCohortes.length > 0) {
        const cohortesUtilisateurs = await CohorteUtilisateur.find({
            cohorte: { $in: toutesLesCohortes }
        }).select('utilisateur').lean();

        cohortesUtilisateurs.forEach(cu => {
            if (cu.utilisateur) userIds.add(cu.utilisateur.toString());
        });
    }

    return userIds.size;
};

/**
 * Calcule le nombre de participants de groupe et de participant par groupe */
const calculerGroupes = async (themeId, lieux) => {
    // Nombre de groupes = nombre de lieux de formation
    const nombreGroupes = lieux.length;

    // Nombre de participants max par groupe =
    // total participants publicCible / nombre de groupes (arrondi au supérieur)
    // Si un seul groupe, c'est le total.
    // On expose les deux valeurs séparément pour que l'utilisateur puisse modifier.

    let nombreParticipantsParGroupe = 0;

    if (nombreGroupes > 0) {
        // Compter les participants du publicCible du thème (sans les cohortes)
        const theme = await ThemeFormation.findById(themeId);
        let totalPublicCible = 0;
        try {
            const users = await theme.resolveTargetedUsers();
            totalPublicCible = users.length;
        } catch (e) {
            logger.error('TDR calculerGroupes - resolveTargetedUsers:', e);
        }

        nombreParticipantsParGroupe = nombreGroupes > 0
            ? Math.ceil(totalPublicCible / nombreGroupes)
            : totalPublicCible;
    }

    return { nombreGroupes, nombreParticipantsParGroupe };
};

/**
 * Calcule le budget prévisionnel TTC à partir des dépenses du thème
 */
const calculerBudget = async (themeId) => {
    
    const depenses = await Depense.find({ themeFormation: themeId })
            .populate({
                path: 'taxes',
                select: 'natureFr natureEn taux',
                options: { strictPopulate: false }
            })
            .sort({ type: 1, createdAt: 1 })
            .lean();
    let totalPrevuHT = 0;
    let totalPrevuTTC = 0;
    const lignes = [];

    for (const dep of depenses) {
        const quantite = dep.quantite ?? 1;
        const tauxTotal = (dep.taxes || []).reduce((acc, taxe) => acc + (taxe.taux || 0), 0);
        const montantHT = (dep.montantUnitairePrevu || 0) * quantite;
        const montantTTC = montantHT * (1 + tauxTotal / 100);

        totalPrevuHT += montantHT;
        totalPrevuTTC += montantTTC;

        lignes.push({
            nature: dep.nomFr || dep.nomEn || '—',
            type: dep.type || '—',
            quantite,
            prixUnitaireHT: dep.montantUnitairePrevu || 0,
            tauxTaxes: tauxTotal,
            taxes: (dep.taxes || []).map(t => ({       // ← NOUVEAU
                natureFr: t.natureFr || null,
                natureEn: t.natureEn || null,
                taux: t.taux || 0,
            })),
            montantTTC: Math.round(montantTTC * 100) / 100,
        });
    }

    return {
        lignes,
        totalPrevuHT: Math.round(totalPrevuHT * 100) / 100,
        totalPrevuTTC: Math.round(totalPrevuTTC * 100) / 100,
    };
};

// ─────────────────────────────────────────────
// ENDPOINT 1 : PREFILL
// GET /api/tdr/:themeId/prefill
// ─────────────────────────────────────────────

export const getTdrPrefill = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        // Charger le thème complet
        const theme = await ThemeFormation.findById(themeId)
            .populate('responsable', 'nom prenom email matricule')
            .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.poste', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.structure', options: { strictPopulate: false } })
            .populate({ path: 'publicCible.postes.structures.services.service', options: { strictPopulate: false } })
            .populate({
                path: 'formation',
                populate: { path: 'programmeFormation axeStrategique', options: { strictPopulate: false } }
            });

        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // Charger les lieux de formation
        const lieux = await LieuFormation.find({ theme: themeId })
            .populate({ path: 'cohortes', select: 'nomFr nomEn' })
            .lean();

        // Charger les formateurs
        const formateurs = await Formateur.find({ theme: themeId })
            .populate('utilisateur', 'nom prenom email matricule posteDeTravail')
            .lean();

        // Charger les objectifs spécifiques
        const objectifs = await Objectif.find({ theme: themeId })
            .select('nomFr nomEn')
            .lean();

        // Résoudre les dates
        const { dateDebut, dateFin } = resoudreDates(theme, lieux);

        // Compter les participants
        const nombreParticipants = await compterParticipants(theme, lieux);

        // Calculer le budget
        const budget = await calculerBudget(themeId);
        // Vérifier si un TDR existe déjà (pour pré-remplir les champs libres)
        const noteExistante = await NoteService.findOne({
            theme: themeId,
            typeNote: 'tdr_formation'
        }).lean();

        const { nombreGroupes, nombreParticipantsParGroupe } = await calculerGroupes(themeId, lieux);

        const prefill = {
            themeId,
            titreFr: theme.titreFr,
            titreEn: theme.titreEn,
            dateDebut: dateDebut || null,
            dateFin: dateFin || null,
            duree: theme.duree || null,
            responsable: theme.responsable || null,

            lieu: lieux.length > 0 ? lieux[0].lieu : null,
            lieux: lieux.map(l => ({
                _id: l._id,
                lieu: l.lieu,
                dateDebut: l.dateDebut,
                dateFin: l.dateFin,
            })),

            formateurs: formateurs.map(f => ({
                _id: f._id,
                utilisateur: f.utilisateur,
                interne: f.interne,
            })),

            objectifsSpecifiques: objectifs.map(o => ({
                _id: o._id,
                nomFr: o.nomFr,
                nomEn: o.nomEn,
            })),

            nombreParticipants,
            nombreGroupes,                    // ← NOUVEAU
            nombreParticipantsParGroupe,       // ← NOUVEAU

            budget,

            objectifGeneral: noteExistante?.objectifGeneral || '',
            contexte: noteExistante?.contexte || '',
            modules: noteExistante?.modules || [],
            responsabilitesDGI: noteExistante?.responsabilitesDGI || '',
            responsabilitesPartieExterne: noteExistante?.responsabilitesPartieExterne || '',
            nomPartieExterne: noteExistante?.nomPartieExterne || '',
            resultatsAttendus: noteExistante?.resultatsAttendus || '',
            methodologie: noteExistante?.methodologie || '',
            decoupageHoraire: noteExistante?.decoupageHoraire || '',   // string sérialisée
            organisationGroupes: noteExistante?.organisationGroupes || '',
        };

        return res.status(200).json({ success: true, data: prefill });

    } catch (err) {
        logger.error('TDR prefill error:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ─────────────────────────────────────────────
// ENDPOINT 2 : GÉNÉRATION TDR
// POST /api/tdr/:themeId
// ─────────────────────────────────────────────

export const genererTdr = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            // Données thème modifiables
            titreFr,
            titreEn,
            dateDebut,
            dateFin,
            duree,
            responsable,
            lieu, // lieu principal (string)

            // Formateurs modifiés (tableau d'objets { utilisateur, interne })
            formateurs,

            // Objectifs spécifiques modifiés (tableau d'objets { nomFr, nomEn, _id? })
            objectifsSpecifiques,

            // Nombre de participants (peut être modifié par l'utilisateur)
            nombreParticipants,
            nombreGroupes,
            nombreParticipantsParGroupe,

            // Champs libres
            objectifGeneral,
            contexte,
            modules, // tableau de strings
            responsabilitesDGI,
            responsabilitesPartieExterne,
            nomPartieExterne,
            resultatsAttendus,
            methodologie,
            decoupageHoraire,
            organisationGroupes,

            // Créateur
            creePar,
        } = req.body;

        // ── 1. Charger le thème ──────────────────────────────────────────
        const theme = await ThemeFormation.findById(themeId).session(session);
        if (!theme) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        // ── 2. Mettre à jour ThemeFormation si modifications ─────────────
        let themeModifie = false;

        if (titreFr !== undefined && titreFr !== theme.titreFr) { theme.titreFr = titreFr; themeModifie = true; }
        if (titreEn !== undefined && titreEn !== theme.titreEn) { theme.titreEn = titreEn; themeModifie = true; }
        if (duree !== undefined && duree !== theme.duree) { theme.duree = duree; themeModifie = true; }
        if (dateDebut !== undefined) { theme.dateDebut = dateDebut ? new Date(dateDebut) : null; themeModifie = true; }
        if (dateFin !== undefined) { theme.dateFin = dateFin ? new Date(dateFin) : null; themeModifie = true; }
        if (responsable !== undefined) {
            const respId = responsable?._id || responsable || null;
            if (respId !== (theme.responsable?.toString() || null)) {
                theme.responsable = respId;
                themeModifie = true;
            }
        }

        if (themeModifie) {
            await theme.save({ session });
        }

        // ── 3. Mettre à jour le lieu principal ───────────────────────────
        if (lieu !== undefined) {
            const premierLieu = await LieuFormation.findOne({ theme: themeId }).session(session);
            if (premierLieu && premierLieu.lieu !== lieu) {
                premierLieu.lieu = lieu;
                await premierLieu.save({ session });
            }
        }

        // ── 4. Mettre à jour les formateurs ──────────────────────────────
        if (Array.isArray(formateurs)) {
            // Supprimer tous les formateurs existants et recréer
            await Formateur.deleteMany({ theme: themeId }).session(session);
            if (formateurs.length > 0) {
                const formateursDocs = formateurs.map(f => ({
                    utilisateur: f.utilisateur?._id || f.utilisateur,
                    interne: f.interne ?? true,
                    theme: themeId,
                }));
                await Formateur.insertMany(formateursDocs, { session });
            }
        }

        // ── 5. Mettre à jour les objectifs spécifiques ───────────────────
        if (Array.isArray(objectifsSpecifiques)) {
            // Supprimer les anciens et recréer
            await Objectif.deleteMany({ theme: themeId }).session(session);
            if (objectifsSpecifiques.length > 0) {
                const objectifsDocs = objectifsSpecifiques.map(o => ({
                    nomFr: o.nomFr,
                    nomEn: o.nomEn || o.nomFr,
                    theme: themeId,
                }));
                await Objectif.insertMany(objectifsDocs, { session });
            }
        }

        // ── 6. Créer / mettre à jour NoteService ─────────────────────────
        const referenceNote = await genererReferenceNote();

        let note = await NoteService.findOne({ theme: themeId, typeNote: 'tdr_formation' }).session(session);

        const champsLibres = {
            objectifGeneral: objectifGeneral || '',
            contexte: contexte || '',
            modules: Array.isArray(modules) ? modules : [],
            responsabilitesDGI: responsabilitesDGI || '',
            responsabilitesPartieExterne: responsabilitesPartieExterne || '',
            nomPartieExterne: nomPartieExterne || '',
            resultatsAttendus: resultatsAttendus || '',
            methodologie: methodologie || '',
            decoupageHoraire: decoupageHoraire || '',
            organisationGroupes: organisationGroupes || '',
        };

        if (note) {
            Object.assign(note, champsLibres);
            note.titreFr = titreFr || theme.titreFr;
            note.titreEn = titreEn || theme.titreEn;
            note.creePar = creePar;
            note.valideParDG = false;
            await note.save({ session });
        } else {
            note = new NoteService({
                reference: referenceNote,
                theme: themeId,
                typeNote: 'tdr_formation',
                titreFr: titreFr || theme.titreFr,
                titreEn: titreEn || theme.titreEn,
                creePar,
                valideParDG: false,
                ...champsLibres,
            });
            await note.save({ session });
        }

        // ── 7. Recharger les données à jour pour le PDF ──────────────────
        const themePopule = await ThemeFormation.findById(themeId)
            .populate('responsable', 'nom prenom email matricule')
            .populate({ path: 'publicCible.familleMetier', options: { strictPopulate: false } })
            .lean();

        const lieuxPopules = await LieuFormation.find({ theme: themeId })
            .populate({ path: 'cohortes', select: 'nomFr nomEn' })
            .lean();

        const formateursPopules = await Formateur.find({ theme: themeId })
            .populate('utilisateur', 'nom prenom email matricule')
            .lean();

        const objectifsPopules = await Objectif.find({ theme: themeId })
            .select('nomFr nomEn')
            .lean();

        const { dateDebut: dateDeb, dateFin: dateFin_ } = resoudreDates(themePopule, lieuxPopules);
        const nParticipants = nombreParticipants ?? await compterParticipants(theme, lieuxPopules);
        const budget = await calculerBudget(themeId);

        const createur = creePar && mongoose.Types.ObjectId.isValid(creePar)
            ? await Utilisateur.findById(creePar).select('nom prenom abreviationNoteServie').lean()
            : null;

        // ── 8. Générer le PDF ─────────────────────────────────────────────
        const pdfBuffer = await genererPDFTdr({
            note,
            theme: themePopule,
            lieux: lieuxPopules,
            formateurs: formateursPopules,
            objectifsSpecifiques: objectifsPopules,
            nombreParticipants: nParticipants,
            budget,
            dateDeb,
            dateFin: dateFin_,
            champsLibres,
            lang,
            createur,
        });

        // ── 9. Valider la transaction ─────────────────────────────────────
        await session.commitTransaction();
        session.endSession();

        const nomFichier = `TDR-${(themePopule.titreFr || 'formation').replace(/[^a-z0-9]/gi, '_').substring(0, 40)}-${note.reference.replace(/\//g, '-')}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Content-Length': pdfBuffer.length,
        });
        return res.send(pdfBuffer);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error('TDR génération error:', err);
        return res.status(500).json({ success: false, message: t('erreur_serveur', lang), error: err.message });
    }
};

// ─────────────────────────────────────────────
// GÉNÉRATION DE RÉFÉRENCE (réutilise la logique existante)
// ─────────────────────────────────────────────

const genererReferenceNote = async () => {
    const annee = new Date().getFullYear();
    const mois = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await NoteService.countDocuments({
        createdAt: {
            $gte: new Date(`${annee}-01-01`),
            $lt: new Date(`${annee + 1}-01-01`),
        },
    });
    return `TDR/${String(count + 1).padStart(4, '0')}/DGI/${mois}/${annee}`;
};

// ─────────────────────────────────────────────
// GÉNÉRATION PDF TDR
// ─────────────────────────────────────────────

const genererPDFTdr = async ({
    note,
    theme,
    lieux,
    formateurs,
    objectifsSpecifiques,
    nombreParticipants,
    budget,
    dateDeb,
    dateFin,
    champsLibres,
    lang,
    createur,
}) => {
    const baseUrl = process.env.BASE_URL || 'https://votredomaine.com';
    const urlVerification = `${baseUrl}/notes-service/verifier/${note._id}`;

    const qrCodeDataUrl = await QRCode.toDataURL(urlVerification, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 100,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
    });

    const formatDate = (date) => date
        ? new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : '___________';

    const templateData = {
        documentTitle: `TDR - ${lang === 'fr' ? theme.titreFr : theme.titreEn}`,
        logoUrl: getLogoBase64(__dirname),
        referenceSysteme: note.reference,
        qrCodeUrl: qrCodeDataUrl,
        urlVerification,

        // Identification
        titreFr: theme.titreFr,
        titreEn: theme.titreEn,
        dateDebut: formatDate(dateDeb),
        dateFin: formatDate(dateFin),
        duree: theme.duree || null,
        lieu: lieux.length > 0 ? lieux[0].lieu : '___________',
        lieux,
        

        // Sections du TDR
        contexte: champsLibres.contexte,
        objectifGeneral: champsLibres.objectifGeneral,
        objectifsSpecifiques,
        modules: champsLibres.modules,
        methodologie: champsLibres.methodologie,
        decoupageHoraire: champsLibres.decoupageHoraire,
        organisationGroupes: champsLibres.organisationGroupes,
        responsabilitesDGI: champsLibres.responsabilitesDGI,
        responsabilitesPartieExterne: champsLibres.responsabilitesPartieExterne,
        nomPartieExterne: champsLibres.nomPartieExterne || 'Partenaire',
        resultatsAttendus: champsLibres.resultatsAttendus,

        // Budget
        budget,

        // Méta
        createurNom: createur ? `${createur.nom} ${createur.prenom || ''}`.trim() : 'Système',
        dateTime: new Date().toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: 'numeric', minute: 'numeric',
        }),
        lang,
    };

    const templatePath = path.join(__dirname, '../views/tdr-formation.ejs');
    const html = await ejs.renderFile(templatePath, templateData);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
            '--no-first-run', '--no-zygote', '--disable-gpu',
        ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '60px', left: '20px' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex;
                        justify-content: space-between; align-items: center; color: #666;">
                <div style="flex:1; text-align:left;">Généré par ${templateData.createurNom}</div>
                <div style="flex:1; text-align:center;">Le ${templateData.dateTime}</div>
                <div style="flex:1; text-align:right;">
                    Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                </div>
            </div>`,
    });

    await browser.close();
    return pdfBuffer;
};