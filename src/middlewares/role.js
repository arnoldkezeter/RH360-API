import { t } from '../utils/i18n.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    const lang = req.headers['accept-language'] || 'fr';
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: t('access_denied', lang) });
    }
    next();
  };
};
