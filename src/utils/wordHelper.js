/**
 * Helper pour déterminer automatiquement l'article approprié (à la/au) 
 * en fonction du genre grammatical du mot en français
 * Supporte les abréviations courantes de l'administration camerounaise
 */

/**
 * Dictionnaire des abréviations et structures administratives
 * Basé sur les structures réelles de la DGI du Cameroun
 * Mis à jour avec toutes les structures identifiées
 */
const abbreviations = {
    // === CENTRES RÉGIONAUX DES IMPÔTS (Masculins) ===
    'cri': { full: 'Centre Régional des Impôts', gender: 'm' },
    'cri centre 1': { full: 'Centre Régional des Impôts du Centre 1', gender: 'm' },
    'cri centre 2': { full: 'Centre Régional des Impôts du Centre 2', gender: 'm' },
    'cri centre ext': { full: 'Centre Régional des Impôts du Centre Extérieur', gender: 'm' },
    'cri littoral 1': { full: 'Centre Régional des Impôts du Littoral 1', gender: 'm' },
    'cri littoral 2': { full: 'Centre Régional des Impôts du Littoral 2', gender: 'm' },
    'cri littoral ext': { full: 'Centre Régional des Impôts du Littoral Extérieur', gender: 'm' },
    'cri sud': { full: 'Centre Régional des Impôts du Sud', gender: 'm' },
    'cri sud ouest': { full: 'Centre Régional des Impôts du Sud Ouest', gender: 'm' },
    'cri nord': { full: 'Centre Régional des Impôts du Nord', gender: 'm' },
    'cri nord ouest': { full: 'Centre Régional des Impôts du Nord Ouest', gender: 'm' },
    'cri ouest': { full: 'Centre Régional des Impôts de l\'Ouest', gender: 'm' },
    'cri est': { full: 'Centre Régional des Impôts de l\'Est', gender: 'm' },
    'cri adamaoua': { full: 'Centre Régional des Impôts de l\'Adamaoua', gender: 'm' },
    'cri extreme nord': { full: 'Centre Régional des Impôts de l\'Extrême Nord', gender: 'm' },
    'centre': { full: 'Centre', gender: 'm' },
    
    // === DIRECTIONS (Féminines) ===
    'dge': { full: 'Direction des Grandes Entreprises', gender: 'f' },
    'dag': { full: 'Direction des Affaires Générales', gender: 'f' },
    'drvfc': { full: 'Direction du Recouvrement, des Valeurs Fiscales et de la Curatelle', gender: 'f' },
    'direction': { full: 'Direction', gender: 'f' },
    'dir': { full: 'Direction', gender: 'f' },
    
    // === DIVISIONS (Féminines) ===
    'depscf': { full: 'Division des Enquêtes, de la Programmation et du Suivi du Contrôle Fiscal', gender: 'f' },
    'deprf': { full: 'Division des Études de la Planification et des Réformes Fiscales', gender: 'f' },
    'dc': { full: 'Division du Contentieux', gender: 'f' },
    'dcont': { full: 'Division du Contentieux', gender: 'f' },
    'di': { full: 'Division de l\'Informatique', gender: 'f' },
    'dinf': { full: 'Division de l\'Informatique', gender: 'f' },
    'dlrfi': { full: 'Division de la Législation et des Relations Fiscales Internationales', gender: 'f' },
    'dssi': { full: 'Division des Statistiques, des Simulations et de l\'Immatriculation', gender: 'f' },
    'div': { full: 'Division', gender: 'f' },
    'division': { full: 'Division', gender: 'f' },
    
    // === CELLULES (Féminines) ===
    'cic': { full: 'Cellule de l\'Information et de la Communication', gender: 'f' },
    'cell': { full: 'Cellule', gender: 'f' },
    'cellule': { full: 'Cellule', gender: 'f' },
    
    // === PROGRAMMES DE SÉCURISATION (Masculins) ===
    'psr': { full: 'Programme de Sécurisation des Recettes', gender: 'm' },
    'psrr': { full: 'Programme de Sécurisation des Recettes Routières', gender: 'm' },
    'psrf': { full: 'Programme de Sécurisation des Recettes Forestières', gender: 'm' },
    'psrep': { full: 'Programme de Sécurisation des Recettes de l\'Élevage et des Pêches', gender: 'm' },
    'psrmee': { full: 'Programme de Sécurisation des Recettes Minières, de l\'Eau et de l\'Énergie', gender: 'm' },
    'psrdcf': { full: 'Programme de Sécurisation des Recettes Domaniales, Cadastrales et Foncières', gender: 'm' },
    'programme': { full: 'Programme', gender: 'm' },
    
    // === INSPECTION (Féminine) ===
    'isi': { full: 'Inspection des Services des Impôts', gender: 'f' },
    'insp': { full: 'Inspection', gender: 'f' },
    'inspection': { full: 'Inspection', gender: 'f' },
    
    // === CABINET (Masculin) ===
    'cab': { full: 'Cabinet', gender: 'm' },
    'cabinet': { full: 'Cabinet', gender: 'm' },
    
    // === SERVICES (Masculins) ===
    'so': { full: 'Service d\'Ordre', gender: 'm' },
    'spm': { full: 'Services du Premier Ministre', gender: 'm' },
    'srv': { full: 'Service', gender: 'm' },
    'service': { full: 'Service', gender: 'm' },
    
    // === CONTRÔLE (Masculin) ===
    'cse': { full: 'Contrôle Supérieur de l\'État', gender: 'm' },
    'controle': { full: 'Contrôle', gender: 'm' },
    'contrôle': { full: 'Contrôle', gender: 'm' },
    
    // === SECRÉTARIAT (Masculin) ===
    'sg/prc': { full: 'Secrétariat Général/PRC', gender: 'm' },
    'sg': { full: 'Secrétariat Général', gender: 'm' },
    'secr': { full: 'Secrétariat', gender: 'm' },
    'secrétariat': { full: 'Secrétariat', gender: 'm' },
    
    // === DÉLÉGATION (Féminine) ===
    'dgsn': { full: 'Délégation Générale à la Sûreté Nationale', gender: 'f' },
    'deleg': { full: 'Délégation', gender: 'f' },
    'délégation': { full: 'Délégation', gender: 'f' },
    
    // === MINISTÈRES (Masculins) ===
    'minfi': { full: 'Ministère des Finances', gender: 'm' },
    'minat': { full: 'Ministère de l\'Administration Territoriale', gender: 'm' },
    'minsante': { full: 'Ministère de la Santé Publique', gender: 'm' },
    'minepat': { full: 'Ministère de l\'Économie, de la Planification et de l\'Aménagement du Territoire', gender: 'm' },
    'mindcaf': { full: 'Ministère des Domaines, du Cadastre et des Affaires Foncières', gender: 'm' },
    'minddevel': { full: 'Ministère de la Décentralisation et du Développement Local', gender: 'm' },
    'mincommerce': { full: 'Ministère du Commerce', gender: 'm' },
    'minminidt': { full: 'Ministère de l\'Industrie, des Mines et du Développement Technologique', gender: 'm' },
    'minee': { full: 'Ministère de l\'Eau et de l\'Énergie', gender: 'm' },
    'mintransport': { full: 'Ministère des Transports', gender: 'm' },
    'minpostel': { full: 'Ministère des Postes et Télécommunications', gender: 'm' },
    'minefop': { full: 'Ministère de l\'Emploi et de la Formation Professionnelle', gender: 'm' },
    'minesup': { full: 'Ministère de l\'Enseignement Supérieur et de la Recherche', gender: 'm' },
    'minproff': { full: 'Ministère de la Promotion de la Femme et de la Famille', gender: 'm' },
    'minader': { full: 'Ministère de l\'Agriculture et du Développement Rural', gender: 'm' },
    'minfof': { full: 'Ministère des Forêts et de la Faune', gender: 'm' },
    'mincom': { full: 'Ministère de la Communication', gender: 'm' },
    'minpmeesa': { full: 'Ministère des Petites et Moyennes Entreprises, de l\'Économie Sociale et de l\'Artisanat', gender: 'm' },
    'minmap': { full: 'Ministère Délégué à la Présidence chargé des Marchés Publics', gender: 'm' },
    'ministere': { full: 'Ministère', gender: 'm' },
    'ministère': { full: 'Ministère', gender: 'm' },
    
    // === DIRECTION GÉNÉRALE DES IMPÔTS (Féminine) ===
    'dgi': { full: 'Direction Générale des Impôts', gender: 'f' },
    
    // === ORGANISMES ET ENTREPRISES ===
    'elecam': { full: 'Elections Cameroon', gender: 'f' },
    'sonara': { full: 'Société Nationale de Raffinage', gender: 'f' },
    'cf': { full: 'Crédit Foncier', gender: 'm' },
    
    // === AUTRES TERMES ADMINISTRATIFS ===
    // Masculins
    'bur': { full: 'Bureau', gender: 'm' },
    'bureau': { full: 'Bureau', gender: 'm' },
    'dept': { full: 'Département', gender: 'm' },
    'dpt': { full: 'Département', gender: 'm' },
    'département': { full: 'Département', gender: 'm' },
    'sect': { full: 'Secteur', gender: 'm' },
    'secteur': { full: 'Secteur', gender: 'm' },
    'pole': { full: 'Pôle', gender: 'm' },
    'pôle': { full: 'Pôle', gender: 'm' },
    'comite': { full: 'Comité', gender: 'm' },
    'comité': { full: 'Comité', gender: 'm' },
    'conseil': { full: 'Conseil', gender: 'm' },
    'guichet': { full: 'Guichet', gender: 'm' },
    'audit': { full: 'Audit', gender: 'm' },
    
    // Féminins
    'unite': { full: 'Unité', gender: 'f' },
    'unité': { full: 'Unité', gender: 'f' },
    'brig': { full: 'Brigade', gender: 'f' },
    'brigade': { full: 'Brigade', gender: 'f' },
    'sect.': { full: 'Section', gender: 'f' },
    'section': { full: 'Section', gender: 'f' },
    'ag': { full: 'Agence', gender: 'f' },
    'agence': { full: 'Agence', gender: 'f' },
    'ant': { full: 'Antenne', gender: 'f' },
    'antenne': { full: 'Antenne', gender: 'f' },
    's/dir': { full: 'Sous-Direction', gender: 'f' },
    'sdir': { full: 'Sous-Direction', gender: 'f' },
    'sous-direction': { full: 'Sous-Direction', gender: 'f' },
    
    // === AVEC POINTS (FORMAT ADMINISTRATIF) ===
    'd.g.i': { full: 'Direction Générale des Impôts', gender: 'f' },
    'd.g.i.': { full: 'Direction Générale des Impôts', gender: 'f' },
    'd.a.g': { full: 'Direction des Affaires Générales', gender: 'f' },
    'd.a.g.': { full: 'Direction des Affaires Générales', gender: 'f' },
    'c.r.i': { full: 'Centre Régional des Impôts', gender: 'm' },
    'c.r.i.': { full: 'Centre Régional des Impôts', gender: 'm' },
    'd.g.e': { full: 'Direction des Grandes Entreprises', gender: 'f' },
    'd.g.e.': { full: 'Direction des Grandes Entreprises', gender: 'f' },
    'd.r.h': { full: 'Direction des Ressources Humaines', gender: 'f' },
    'd.r.h.': { full: 'Direction des Ressources Humaines', gender: 'f' },
    's.r.h': { full: 'Service des Ressources Humaines', gender: 'm' },
    's.r.h.': { full: 'Service des Ressources Humaines', gender: 'm' },
    'c.i': { full: 'Centre des Impôts', gender: 'm' },
    'c.i.': { full: 'Centre des Impôts', gender: 'm' },
    'd.r.v.f.c': { full: 'Direction du Recouvrement, des Valeurs Fiscales et de la Curatelle', gender: 'f' },
    'd.r.v.f.c.': { full: 'Direction du Recouvrement, des Valeurs Fiscales et de la Curatelle', gender: 'f' },
    'i.s.i': { full: 'Inspection des Services des Impôts', gender: 'f' },
    'i.s.i.': { full: 'Inspection des Services des Impôts', gender: 'f' },
    'c.s.e': { full: 'Contrôle Supérieur de l\'État', gender: 'm' },
    'c.s.e.': { full: 'Contrôle Supérieur de l\'État', gender: 'm' },
    's.o': { full: 'Service d\'Ordre', gender: 'm' },
    's.o.': { full: 'Service d\'Ordre', gender: 'm' },
    'c.i.c': { full: 'Cellule de l\'Information et de la Communication', gender: 'f' },
    'c.i.c.': { full: 'Cellule de l\'Information et de la Communication', gender: 'f' },
    
    // === VARIANTES AVEC CASSE DIFFÉRENTE ===
    'CRI': { full: 'Centre Régional des Impôts', gender: 'm' },
    'DGE': { full: 'Direction des Grandes Entreprises', gender: 'f' },
    'DAG': { full: 'Direction des Affaires Générales', gender: 'f' },
    'DGI': { full: 'Direction Générale des Impôts', gender: 'f' },
    'MINFI': { full: 'Ministère des Finances', gender: 'm' },
    'CAB': { full: 'Cabinet', gender: 'm' },
    'ISI': { full: 'Inspection des Services des Impôts', gender: 'f' },
    'CSE': { full: 'Contrôle Supérieur de l\'État', gender: 'm' },
    'CIC': { full: 'Cellule de l\'Information et de la Communication', gender: 'f' },
    'DRVFC': { full: 'Direction du Recouvrement, des Valeurs Fiscales et de la Curatelle', gender: 'f' },
    'DEPSCF': { full: 'Division des Enquêtes, de la Programmation et du Suivi du Contrôle Fiscal', gender: 'f' },
    'DEPRF': { full: 'Division des Études de la Planification et des Réformes Fiscales', gender: 'f' },
    'DINF': { full: 'Division de l\'Informatique', gender: 'f' },
    'DCONT': { full: 'Division du Contentieux', gender: 'f' },
    'DLRFI': { full: 'Division de la Législation et des Relations Fiscales Internationales', gender: 'f' },
    'DSSI': { full: 'Division des Statistiques, des Simulations et de l\'Immatriculation', gender: 'f' },
    'PSRR': { full: 'Programme de Sécurisation des Recettes Routières', gender: 'm' },
    'PSRF': { full: 'Programme de Sécurisation des Recettes Forestières', gender: 'm' },
    'PSREP': { full: 'Programme de Sécurisation des Recettes de l\'Élevage et des Pêches', gender: 'm' },
    'PSRMEE': { full: 'Programme de Sécurisation des Recettes Minières, de l\'Eau et de l\'Énergie', gender: 'm' },
    'PSRDCF': { full: 'Programme de Sécurisation des Recettes Domaniales, Cadastrales et Foncières', gender: 'm' },
    'SO': { full: 'Service d\'Ordre', gender: 'm' },
    'SPM': { full: 'Services du Premier Ministre', gender: 'm' },
    'DGSN': { full: 'Délégation Générale à la Sûreté Nationale', gender: 'f' },
    'ELECAM': { full: 'Elections Cameroon', gender: 'f' },
    'SONARA': { full: 'Société Nationale de Raffinage', gender: 'f' }
};




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