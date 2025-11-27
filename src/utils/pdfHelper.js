import PDFParser from 'pdf2json';
import * as fs from 'fs'; 
// Assurez-vous que unlinkAsync, existsAsync sont importés ici si nécessaire
// (Non pertinent pour ces fonctions, mais important pour le contrôleur)

/**
 * Extrait la référence système d'un fichier PDF
 * @param {string|Buffer} pdfPath - Chemin du fichier PDF ou Buffer
 * @returns {Promise<string|null>}
 * @throws {Error} Avec un message/code d'erreur pour la traduction
 */
export const extraireReferencePDF = async (pdfPath) => {
    return new Promise((resolve, reject) => {
        try {
            let dataBuffer;

            // Chemin de fichier
            if (typeof pdfPath === "string") {
                // Utilisation de fs.readFileSync synchrone comme dans l'original
                dataBuffer = fs.readFileSync(pdfPath);
            }
            // Buffer
            else if (Buffer.isBuffer(pdfPath)) {
                dataBuffer = pdfPath;
            } else {
                // Remplacement du message en dur par un code d'erreur standard
                const error = new Error('pdf_parametre_invalide');
                error.code = 'pdf_parametre_invalide';
                return reject(error);
            }

            const pdfParser = new PDFParser();

            pdfParser.on("pdfParser_dataError", (err) => {
                const error = new Error('pdf_erreur_parsing');
                error.code = 'pdf_erreur_parsing';
                error.details = err?.parserError || err;
                reject(error);
            });

            pdfParser.on("pdfParser_dataReady", (pdfData) => {
                let texte = "";
                
                try {
                    // CONCATÉNER TOUS LES BLOCS DE TEXTE AVEC UN ESPACE
                    pdfData.Pages.forEach((page) => {
                        page.Texts.forEach((txt) => {
                            const decoded = decodeURIComponent(
                                txt.R.map((r) => r.T).join("")
                            );
                            // On remplace '\n' par ' ' pour éviter de séparer la référence
                            texte += decoded.replace(/\s+/g, ' ') + " "; 
                        });
                    });
                    
                    // Remplacer les multiples espaces/sauts de ligne par un seul espace
                    texte = texte.replace(/\s+/g, ' ').trim(); 

                } catch (e) {
                    const error = new Error('pdf_erreur_lecture_contenu');
                    error.code = 'pdf_erreur_lecture_contenu';
                    error.details = e;
                    return reject(error);
                }
                
                // Patterns de recherche (inchangés)
                const patterns = [
                    /Réf\.\s*Système\s*:\s*(NS\/[A-Z0-9\-\/]+\s*[A-Z0-9\-\/]+\d{4})/i,
                    /Réf\.\s*Système\s*:\s*(NS\/[A-Z0-9\-\/]+)\s*(\d{4})/i, 
                    /Réf\s*Système\s*:\s*([A-Z0-9\-\/\s]+)/i,
                ];

                for (const pattern of patterns) {
                    const match = texte.match(pattern);
                    if (match && match[1]) {
                        
                        if (pattern.source.includes('NS\/[A-Z0-9')) {
                            if (match.length > 2 && match[2]) {
                                const refComplete = `${match[1]}/${match[2]}`.trim().replace(/\s+/g, '');
                                return resolve(refComplete);
                            }
                        }
                        
                        let referenceExtraite = match[1].trim();
                        
                        if (referenceExtraite.includes(' ') && referenceExtraite.includes('NS/')) {
                            referenceExtraite = referenceExtraite.replace(/([A-Z0-9])\s(\d{4})/, '$1/$2');
                        }

                        return resolve(referenceExtraite.trim().replace(/\s+/g, ''));
                    }
                }

                resolve(null);
            });
            
            // Lancer le parsing depuis un buffer
            pdfParser.parseBuffer(dataBuffer);
        } catch (error) {
            // Si l'erreur n'a pas de code (ex: fs.readFileSync fail), la traiter comme erreur serveur
            reject(error);
        }
    });
};

/**
 * Valide la référence trouvée dans le PDF
 * @param {string|Buffer} pdfPath
 * @param {string} referenceAttendue
 * @param {function} t - Fonction de traduction (ex: t('clé', 'fr'))
 * @param {string} lang - Langue cible
 * @returns {Promise<{valide: boolean, referenceExtraite: string|null, message: string}>}
 */
export const validerReferencePDF = async (pdfPath, referenceAttendue, t, lang) => {
    try {
        const referenceExtraite = await extraireReferencePDF(pdfPath);
        
        if (!referenceExtraite) {
            return {
                valide: false,
                referenceExtraite: null,
                // Utilisation de la traduction pour l'absence de référence
                message: t('pdf_ref_non_trouvee', lang),
            };
        }

        const refExtraiteNormalisee = referenceExtraite.replace(/\s+/g, "").toUpperCase();
        const refAttendueNormalisee = referenceAttendue.replace(/\s+/g, "").toUpperCase();

        if (refExtraiteNormalisee === refAttendueNormalisee) {
            return {
                valide: true,
                referenceExtraite,
                // Traduction du succès
                message: t('pdf_ref_correspond', lang),
            };
        }

        return {
            valide: false,
            referenceExtraite,
            // Traduction de l'échec de correspondance
            message: t('pdf_ref_non_correspondance', lang, { 
                referenceAttendue: referenceAttendue, 
                referenceExtraite: referenceExtraite 
            }),
        };
    } catch (error) {
        let codeErreur = error.code || 'pdf_erreur_serveur';
        
        // Gérer les erreurs de parsing spécifiques retournées par extraireReferencePDF
        if (['pdf_parametre_invalide', 'pdf_erreur_parsing', 'pdf_erreur_lecture_contenu'].includes(codeErreur)) {
            return {
                valide: false,
                referenceExtraite: null,
                message: t(codeErreur, lang),
            };
        }

        // Erreur inattendue (serveur/code)
        return {
            valide: false,
            referenceExtraite: null,
            message: t('pdf_erreur_validation_generique', lang, { errorDetail: error.message }),
        };
    }
};