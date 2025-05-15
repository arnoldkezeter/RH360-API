// utils/i18n.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fr = require('../../locales/fr.json');
const en = require('../../locales/en.json');

const messages = {
  fr,
  en,
};

export const getMessage = (key, lang = 'fr') => {
  return messages[lang]?.[key] || messages['fr'][key] || key;
};

export const t = getMessage;
