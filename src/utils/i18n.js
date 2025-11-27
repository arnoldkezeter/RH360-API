// utils/i18n.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fr = require('../../locales/fr.json');
const en = require('../../locales/en.json');

const messages = {
  fr,
  en,
};

/**
 * Récupère le message traduit et effectue l'interpolation des variables.
 * @param {string} key - Clé de traduction.
 * @param {string} lang - Langue cible ('fr' ou 'en').
 * @param {Object} [variables={}] - Objet contenant les variables à remplacer (ex: { errorDetail: '...' }).
 * @returns {string} Le message traduit et interpolé.
 */
export const getMessage = (key, lang = 'fr', variables = {}) => {
  // 1. Récupérer le message brut (en utilisant la langue spécifiée ou le fallback français)
  let message = messages[lang]?.[key] || messages['fr'][key] || key;

  // 2. Effectuer l'interpolation des variables
  if (variables && typeof variables === 'object') {
    for (const varKey in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, varKey)) {
        // Crée l'expression régulière pour remplacer %{varKey}
        const regex = new RegExp(`%\\{${varKey}\\}`, 'g');
        // Remplace toutes les occurrences dans le message
        message = message.replace(regex, variables[varKey]);
      }
    }
  }

  return message;
};

export const t = getMessage;