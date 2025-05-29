import multer from 'multer';
import path from 'path';
import fs from 'fs';

const createUploader = (folderName, allowedMimeTypes = []) => {
    // Assurer que le dossier existe, sinon le créer
    const uploadPath = path.join(process.cwd(), 'uploads', folderName);
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
        cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        },
    });

    // Filtrage MIME générique
    const fileFilter = (req, file, cb) => {
        if (allowedMimeTypes.length === 0) {
        // Si pas de restriction, accepter tous les fichiers
        cb(null, true);
        } else {
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'), false);
        }
        }
    };

    return multer({
        storage,
        fileFilter,
        limits: { fileSize: 2 * 1024 * 1024 }, // max 50 Mo par défaut, à ajuster
    });
};

export default createUploader;
