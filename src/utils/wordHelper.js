/**
 * Helper pour déterminer automatiquement l'article approprié (à la/au) 
 * en fonction du genre grammatical du mot en français
 * Supporte les abréviations courantes de l'administration camerounaise
 */

import abbreviations from "../config/abbreviation.js";

/**
 * Normalise une chaîne pour la recherche d'abréviation
 * @param {string} text - Le texte à normaliser
 * @returns {string} Le texte normalisé
 */
function normalizeForAbbreviation(text) {
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/\s+/g, '');
}

/**
 * Détecte si le texte commence par une abréviation connue
 * @param {string} text - Le texte à analyser
 * @returns {object|null} L'objet abréviation ou null
 */
function detectAbbreviation(text) {
    const normalized = normalizeForAbbreviation(text);
    
    // Vérifier d'abord les abréviations exactes
    if (abbreviations[normalized]) {
        return abbreviations[normalized];
    }
    
    // Vérifier si le texte commence par une abréviation connue
    for (const [abbr, data] of Object.entries(abbreviations)) {
        const normalizedAbbr = normalizeForAbbreviation(abbr);
        if (normalized.startsWith(normalizedAbbr)) {
            return data;
        }
    }
    
    // Vérifier avec le texte original (pour les versions avec majuscules/accents)
    const originalLower = text.toLowerCase().trim();
    const firstWords = originalLower.split(/[\s\/\-]/);
    
    // Vérifier le premier mot
    if (abbreviations[firstWords[0]]) {
        return abbreviations[firstWords[0]];
    }
    
    // Vérifier les 2 premiers mots (pour "centre régional", etc.)
    if (firstWords.length >= 2) {
        const twoWords = firstWords.slice(0, 2).join(' ');
        const normalizedTwoWords = normalizeForAbbreviation(twoWords);
        
        for (const [abbr, data] of Object.entries(abbreviations)) {
            if (normalizeForAbbreviation(data.full).startsWith(normalizedTwoWords)) {
                return data;
            }
        }
    }
    
    return null;
}

/**
 * Détermine le genre grammatical d'un mot français
 * @param {string} word - Le mot à analyser
 * @returns {string} 'm' pour masculin, 'f' pour féminin, null si indéterminé
 */
function getGender(word) {
    const normalizedWord = word.toLowerCase().trim();
    
    // Dictionnaire d'exceptions et mots courants
    const knownWords = {
        // Masculins
        'centre': 'm',
        'service': 'm',
        'pôle': 'm',
        'pole': 'm',
        'guichet': 'm',
        'bureau': 'm',
        'département': 'm',
        'departement': 'm',
        'secrétariat': 'm',
        'secretariat': 'm',
        'cabinet': 'm',
        'secteur': 'm',
        'audit': 'm',
        'contrôle': 'm',
        'controle': 'm',
        'comité': 'm',
        'comite': 'm',
        'conseil': 'm',
        'programme': 'm',
        'ministère': 'm',
        'ministere': 'm',
        
        // Féminins
        'cellule': 'f',
        'division': 'f',
        'direction': 'f',
        'unité': 'f',
        'unite': 'f',
        'brigade': 'f',
        'inspection': 'f',
        'section': 'f',
        'agence': 'f',
        'antenne': 'f',
        'délégation': 'f',
        'delegation': 'f',
        'sous-direction': 'f',
        'administration': 'f'
    };
    
    // Vérifier d'abord le dictionnaire
    if (knownWords[normalizedWord]) {
        return knownWords[normalizedWord];
    }
    
    // Terminaisons féminines
    const femininEndings = [
        'tion', 'sion', 'té', 'te', 'ée', 'ee', 'ance', 'ence', 
        'ure', 'ade', 'ise', 'esse', 'ette', 'elle', 'ière', 'iere',
        'euse', 'trice', 'ine', 'lle', 'que', 'ie'
    ];
    
    // Terminaisons masculines
    const masculinEndings = [
        'ment', 'age', 'isme', 'eau', 'oir', 'et', 'er', 'ier',
        'at', 'eur', 'tre', 'ice', 'in', 'on', 'oir'
    ];
    
    // Vérifier les terminaisons féminines
    for (let ending of femininEndings) {
        if (normalizedWord.endsWith(ending)) {
            return 'f';
        }
    }
    
    // Vérifier les terminaisons masculines
    for (let ending of masculinEndings) {
        if (normalizedWord.endsWith(ending)) {
            return 'm';
        }
    }
    
    return null;
}

/**
 * Formate un texte avec l'article contracté approprié (à la/au)
 * Gère les abréviations et structures administratives automatiquement
 * @param {string} text - Le texte à formater
 * @returns {string} Le texte préfixé par l'article approprié
 * 
 * @example
 * formatWithArticle("Centre Régional des Impôts du Centre 1")  // "au Centre Régional des Impôts du Centre 1"
 * formatWithArticle("Direction des Grandes Entreprises")        // "à la Direction des Grandes Entreprises"
 * formatWithArticle("Division du Contentieux")                  // "à la Division du Contentieux"
 */
export function formatWithArticle(text) {
    if (!text || typeof text !== 'string') {
        return 'à la/au ';
    }
    
    const trimmedText = text.trim();
    
    // Vérifier d'abord si c'est une abréviation
    const abbr = detectAbbreviation(trimmedText);
    if (abbr) {
        return abbr.gender === 'm' ? `au ${trimmedText}` : `à la ${trimmedText}`;
    }
    
    // Sinon, analyser le premier mot normalement
    const firstWord = trimmedText.split(/[\s\/\-]/)[0];
    const gender = getGender(firstWord);
    
    if (gender === 'm') {
        return `au ${trimmedText}`;
    } else if (gender === 'f') {
        return `à la ${trimmedText}`;
    } else {
        return `à la/au ${trimmedText}`;
    }
}

/**
 * Obtient uniquement l'article (sans le texte)
 * @param {string} text - Le texte à analyser
 * @returns {string} L'article approprié ('au', 'à la', ou 'à la/au')
 */
export function getArticle(text) {
    if (!text || typeof text !== 'string') {
        return 'à la/au';
    }
    
    const trimmedText = text.trim();
    
    // Vérifier d'abord si c'est une abréviation
    const abbr = detectAbbreviation(trimmedText);
    if (abbr) {
        return abbr.gender === 'm' ? 'au' : 'à la';
    }
    
    // Sinon, analyser le premier mot
    const firstWord = trimmedText.split(/[\s\/\-]/)[0];
    const gender = getGender(firstWord);
    
    if (gender === 'm') {
        return 'au';
    } else if (gender === 'f') {
        return 'à la';
    } else {
        return 'à la/au';
    }
}

/**
 * Ajoute une nouvelle abréviation au dictionnaire
 * @param {string} abbr - L'abréviation
 * @param {string} full - La forme complète
 * @param {string} gender - Le genre ('m' ou 'f')
 */
export function addAbbreviation(abbr, full, gender) {
    const normalized = normalizeForAbbreviation(abbr);
    abbreviations[normalized] = { full, gender };
}

/**
 * Récupère toutes les abréviations enregistrées
 * @returns {object} Le dictionnaire des abréviations
 */
export function getAbbreviations() {
    return { ...abbreviations };
}


/**
 * Helper pour capitaliser les textes
 * Transforme la première lettre de chaque mot en majuscule et le reste en minuscule
 */

/**
 * Capitalise la première lettre d'un mot et met le reste en minuscule
 * @param {string} word - Le mot à capitaliser
 * @returns {string} Le mot capitalisé
 */
function capitalizeWord(word) {
    if (!word || typeof word !== 'string' || word.length === 0) {
        return '';
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Capitalise la première lettre de chaque mot dans une phrase
 * @param {string} text - Le texte à capitaliser (mot ou phrase)
 * @returns {string} Le texte avec chaque mot capitalisé
 * 
 * @example
 * capitalize('bonjour')                           // 'Bonjour'
 * capitalize('DIRECTION GÉNÉRALE')                // 'Direction Générale'
 * capitalize('centre des impôts de douala')       // 'Centre Des Impôts De Douala'
 * capitalize('jean-pierre DUPONT')                // 'Jean-Pierre Dupont'
 */
export function capitalize(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Séparer par espaces
    const words = text.trim().split(/\s+/);
    
    // Capitaliser chaque mot
    const capitalizedWords = words.map(word => {
        // Gérer les mots composés avec trait d'union (ex: Jean-Pierre)
        if (word.includes('-')) {
            return word.split('-')
                .map(part => capitalizeWord(part))
                .join('-');
        }
        
        // Gérer les mots composés avec apostrophe (ex: l'étudiant, d'affaires)
        if (word.includes("'")) {
            const parts = word.split("'");
            return parts[0].toLowerCase() + "'" + capitalizeWord(parts[1]);
        }
        
        return capitalizeWord(word);
    });
    
    return capitalizedWords.join(' ');
}

/**
 * Capitalise uniquement la première lettre du texte complet
 * (utile pour les phrases où seul le premier mot doit être capitalisé)
 * @param {string} text - Le texte à capitaliser
 * @returns {string} Le texte avec seulement la première lettre en majuscule
 * 
 * @example
 * capitalizeFirst('bonjour tout le monde')  // 'Bonjour tout le monde'
 * capitalizeFirst('HELLO WORLD')            // 'Hello world'
 */
export function capitalizeFirst(text) {
    if (!text || typeof text !== 'string' || text.length === 0) {
        return '';
    }
    
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Capitalise chaque mot SAUF les articles et prépositions (style titre)
 * @param {string} text - Le texte à capitaliser
 * @returns {string} Le texte formaté en style titre
 * 
 * @example
 * capitalizeTitle('direction des affaires générales')  
 * // 'Direction des Affaires Générales'
 */
export function capitalizeTitle(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Liste des mots à ne pas capitaliser (sauf en début de phrase)
    const exceptions = [
        'le', 'la', 'les', 'un', 'une', 'des',
        'de', 'du', 'à', 'au', 'aux', 'en', 'dans',
        'sur', 'pour', 'par', 'avec', 'et', 'ou'
    ];
    
    const words = text.trim().split(/\s+/);
    
    const capitalizedWords = words.map((word, index) => {
        const lowerWord = word.toLowerCase();
        
        // Toujours capitaliser le premier mot
        if (index === 0) {
            return capitalizeWord(word);
        }
        
        // Ne pas capitaliser les exceptions
        if (exceptions.includes(lowerWord)) {
            return lowerWord;
        }
        
        return capitalizeWord(word);
    });
    
    return capitalizedWords.join(' ');
}

/**
 * Variante qui préserve certains acronymes en majuscules
 * @param {string} text - Le texte à capitaliser
 * @param {string[]} acronyms - Liste des acronymes à préserver (ex: ['DGI', 'RH', 'IT'])
 * @returns {string} Le texte capitalisé avec acronymes préservés
 * 
 * @example
 * capitalizeWithAcronyms('direction générale des impôts (DGI)', ['DGI'])
 * // 'Direction Générale Des Impôts (DGI)'
 */
export function capitalizeWithAcronyms(text, acronyms = []) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    let result = capitalize(text);
    
    // Remplacer les acronymes par leur version en majuscules
    acronyms.forEach(acronym => {
        const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
        result = result.replace(regex, acronym.toUpperCase());
    });
    
    return result;
}



// Export par défaut
export default {
    formatWithArticle,
    getArticle,
    addAbbreviation,
    getAbbreviations,
    capitalize,
    capitalizeFirst,
    capitalizeTitle,
    capitalizeWithAcronyms
};