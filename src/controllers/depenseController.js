import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Depense from '../models/Depense.js';
import { t } from '../utils/i18n.js';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ThemeFormation from '../models/ThemeFormation.js';
import { getLogoBase64 } from '../utils/logoBase64.js';
import Utilisateur from '../models/Utilisateur.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajouter une dépense (lié au thème)
export const createDepense = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { themeFormationId } = req.params;
        const { nomFr, nomEn, type, quantite, montantUnitairePrevu, montantUnitaireReel, taxes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(themeFormationId)) {
            return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
        }

        // Vérifier que le thème existe
        const theme = await ThemeFormation.findById(themeFormationId);
        if (!theme) {
            return res.status(404).json({ success: false, message: t('theme_non_trouve', lang) });
        }

        if (!Array.isArray(taxes) || taxes.some(t => !mongoose.Types.ObjectId.isValid(t))) {
            return res.status(400).json({ success: false, message: t('taxe_invalide', lang) });
        }

        if (montantUnitairePrevu === undefined || isNaN(montantUnitairePrevu) || montantUnitairePrevu < 0) {
            return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
        }

        if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
            return res.status(400).json({ success: false, message: t('quantite_nombre_requis', lang) });
        }

        if (montantUnitaireReel !== undefined && (isNaN(montantUnitaireReel) || montantUnitaireReel < 0)) {
            return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
        }

        const depense = new Depense({
            nomFr,
            nomEn,
            type,
            themeFormation: themeFormationId,
            quantite: quantite ?? 1,
            montantUnitairePrevu,
            montantUnitaireReel: montantUnitaireReel ?? null,
            taxes
        });

        const saved = await depense.save();
        
        // Population conditionnelle
        const populateOptions = ['themeFormation'];
        if (saved.taxes && saved.taxes.length > 0) {
            populateOptions.push('taxes');
        }
        await saved.populate(populateOptions);

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            data: saved,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

// Modifier une dépense
export const updateDepense = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { nomFr, nomEn, type, themeFormationId, quantite, montantUnitairePrevu, montantUnitaireReel, taxes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    if (themeFormationId && !mongoose.Types.ObjectId.isValid(themeFormationId)) {
        return res.status(400).json({ success: false, message: t('theme_invalide', lang) });
    }

    if (taxes && (!Array.isArray(taxes) || taxes.some(t => !mongoose.Types.ObjectId.isValid(t)))) {
        return res.status(400).json({ success: false, message: t('taxe_invalide', lang) });
    }

    if (montantUnitairePrevu !== undefined && (isNaN(montantUnitairePrevu) || montantUnitairePrevu < 0)) {
        return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
    }

    if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
        return res.status(400).json({ success: false, message: t('quantite_nombre_requis', lang) });
    }

    if (montantUnitaireReel !== undefined && montantUnitaireReel !== null && (isNaN(montantUnitaireReel) || montantUnitaireReel < 0)) {
        return res.status(400).json({ success: false, message: t('montant_ht_nombre_requis', lang) });
    }

    try {
        const depense = await Depense.findById(id);
        if (!depense) {
            return res.status(404).json({
                success: false,
                message: t('depense_non_trouve', lang),
            });
        }

        depense.nomFr = nomFr ?? depense.nomFr;
        depense.nomEn = nomEn ?? depense.nomEn;
        depense.type = type ?? depense.type;
        depense.themeFormation = themeFormationId ?? depense.themeFormation;
        depense.quantite = quantite ?? depense.quantite ?? 1;
        depense.montantUnitairePrevu = montantUnitairePrevu ?? depense.montantUnitairePrevu;
        depense.montantUnitaireReel = montantUnitaireReel !== undefined ? montantUnitaireReel : depense.montantUnitaireReel;
        depense.taxes = taxes ?? depense.taxes;

        await depense.save();
        
        // Population conditionnelle
        const populateOptions = ['themeFormation'];
        if (depense.taxes && depense.taxes.length > 0) {
            populateOptions.push('taxes');
        }
        await depense.populate(populateOptions);

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data: depense,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

//  Supprimer une dépense
export const deleteDepense = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: t('identifiant_invalide', lang) });
    }

    try {
        const deleted = await Depense.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: t('depense_non_trouvee', lang) });
        }

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

//  Lister les dépenses (pagination + filtres)
export const getFilteredDepenses = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeFormationId } = req.params;
    const {
        type,
        search,
        page = 1,
        limit = 10,
    } = req.query;

    const filters = {};

    if (themeFormationId && mongoose.Types.ObjectId.isValid(themeFormationId)) {
        filters.themeFormation = themeFormationId;
    }

    if (type) {
        filters.type = type;
    }

    if (search) {
        filters.$or = [
            { nomFr: { $regex: search, $options: 'i' } },
            { nomEn: { $regex: search, $options: 'i' } },
        ];
    }

    try {
        const [total, depenses] = await Promise.all([
            Depense.countDocuments(filters),
            Depense.find(filters)
                .populate({
                    path: 'taxes',
                    select: 'natureFr natureEn taux',
                    options: { strictPopulate: false }
                })
                .populate({
                    path: 'themeFormation',
                    select: 'titreFr titreEn'
                })
                .skip((page - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            data: {
                depenses: depenses,
                totalItems: total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                pageSize: parseInt(limit)
            }
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};

//  Générer le PDF du budget d'un thème
export const generateBudgetPDF = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeFormationId, userId } = req.params;
    const { budgetNomFr, budgetNomEn } = req.query;

    try {
        // 1. Vérifier que le themeFormationId est valide
        if (!mongoose.Types.ObjectId.isValid(themeFormationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        // 2. Vérifier que le thème existe
        const theme = await ThemeFormation.findById(themeFormationId).lean();
        
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        const creePar = await Utilisateur.findById(userId).select('nom prenom').lean();
        
        if (!creePar) {
            return res.status(404).json({
                success: false,
                message: t('utilisateur_non_trouve', lang)
            });
        }

        // 3. Récupérer toutes les dépenses du thème avec les taxes
        const depenses = await Depense.find({ themeFormation: themeFormationId })
            .populate({
                path: 'taxes',
                select: 'natureFr natureEn taux',
                options: { strictPopulate: false }
            })
            .sort({ type: 1, createdAt: 1 })
            .lean();

        if (!depenses || depenses.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('depense_non_trouvee', lang)
            });
        }

        // 4. Préparer les données pour le template
        // Utiliser les paramètres budgetNomFr et budgetNomEn si fournis, sinon le titre du thème
        const nomBudget = lang === 'fr'? budgetNomFr : budgetNomEn;

        const templateData = {
            documentTitle: nomBudget,
            budgetDescription: lang === 'fr' 
                ? `Budget du thème: ${theme.titreFr || theme.titreEn}`
                : `Budget for theme: ${theme.titreEn || theme.titreFr}`,
            depenses: depenses,
            logoUrl: getLogoBase64(__dirname) || null,
            dateDocument: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            })
        };

        // 5. Charger et compiler le template EJS
        const templatePath = path.join(__dirname, '../views/budget_template.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // 6. Générer le PDF avec Puppeteer
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
        
        // Définir le contenu HTML
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // 7. Générer le PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '2cm',
                right: '2cm',
                bottom: '2cm',
                left: '2cm'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; margin: 0 20px; display: flex; justify-content: space-between; align-items: center; color: #666;">
                    <div style="text-align: left; flex: 1;">
                        Généré par ${(creePar.nom + " " + (creePar?.prenom || "")) || 'Système'}
                    </div>
                    <div style="text-align: right; flex: 1;">
                        Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
                    </div>
                </div>
            `
        });

        await browser.close();

        // 8. Définir les en-têtes de réponse
        const sanitizedThemeName = (theme.titreFr || theme.titreEn || 'Theme')
            .replace(/[^a-z0-9]/gi, '_')
            .substring(0, 50);
        const fileName = `Budget_${sanitizedThemeName}_${Date.now()}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // 9. Envoyer le PDF
        return res.send(pdfBuffer);

    } catch (err) {
        console.error('Erreur lors de la génération du PDF du budget:', err);
        return res.status(500).json({
            success: false,
            message: t('erreur_generation_pdf', lang),
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// ✅ NOUVEAU: Obtenir le résumé budgétaire d'un thème
export const getThemeBudgetSummary = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { themeFormationId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(themeFormationId)) {
            return res.status(400).json({
                success: false,
                message: t('identifiant_invalide', lang)
            });
        }

        const theme = await ThemeFormation.findById(themeFormationId);
        
        if (!theme) {
            return res.status(404).json({
                success: false,
                message: t('theme_non_trouve', lang)
            });
        }

        // Obtenir les totaux
        const budgetPrevu = await theme.getBudgetTotalPrevu();
        const budgetReel = await theme.getBudgetTotalReel();
        const tauxExecution = await theme.getTauxExecutionBudgetaire();

        // Obtenir les dépenses par type
        const depensesAcquisition = await theme.getDepensesParType('ACQUISITION_BIENS_SERVICES');
        const depensesAdministratif = await theme.getDepensesParType('FRAIS_ADMINISTRATIF');

        return res.status(200).json({
            success: true,
            data: {
                budgetPrevu,
                budgetReel,
                tauxExecution,
                depensesParType: {
                    acquisitionBiensServices: {
                        count: depensesAcquisition.length,
                        total: depensesAcquisition.reduce((sum, d) => {
                            let montant = d.montantUnitairePrevu * d.quantite;
                            if (d.taxes) {
                                d.taxes.forEach(t => montant += montant * (t.taux / 100));
                            }
                            return sum + montant;
                        }, 0)
                    },
                    fraisAdministratif: {
                        count: depensesAdministratif.length,
                        total: depensesAdministratif.reduce((sum, d) => {
                            let montant = d.montantUnitairePrevu * d.quantite;
                            if (d.taxes) {
                                d.taxes.forEach(t => montant += montant * (t.taux / 100));
                            }
                            return sum + montant;
                        }, 0)
                    }
                }
            }
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message
        });
    }
};