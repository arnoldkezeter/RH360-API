import jwt from 'jsonwebtoken';
import { t } from '../utils/i18n.js';

export const authenticate = (req, res, next) => {
  const lang = req.headers['accept-language'] || 'fr';
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: t('missing_token', lang) });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: t('invalid_token', lang) });
  }
};
