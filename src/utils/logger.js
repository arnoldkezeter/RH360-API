// src/utils/logger.js - Version améliorée
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const logDir = process.env.LOG_DIR || 'logs';

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format des logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format console (développement)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Afficher metadata seulement si présente
    const metaKeys = Object.keys(meta).filter(k => k !== 'timestamp' && k !== 'level');
    if (metaKeys.length > 0) {
      const cleanMeta = {};
      metaKeys.forEach(k => cleanMeta[k] = meta[k]);
      msg += ` ${JSON.stringify(cleanMeta)}`;
    }
    
    return msg;
  })
);

// Transports
const transports = [
  // Console
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  }),
  
  // Fichier - Tous les logs avec rotation
  new DailyRotateFile({
    filename: path.join(logDir, 'rh360-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Garder 14 jours
    format: logFormat,
    level: 'info'
  }),
  
  // Fichier - Erreurs uniquement
  new DailyRotateFile({
    filename: path.join(logDir, 'rh360-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // Garder 30 jours pour les erreurs
    format: logFormat
  })
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// Stream pour Morgan (HTTP logs)
logger.stream = {
  write: (message) => logger.info(message.trim())
};

export default logger;