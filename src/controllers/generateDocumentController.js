import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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