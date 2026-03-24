import express from "express";
import multer from "multer";
import path from "path";
import { importerDonnees, importerPersonnelExcel } from "../controllers/importDataController.js";

const router = express.Router();

// ── Configuration Multer ──────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Dossier temporaire (doit exister)
  },
  filename: (req, file, cb) => {
    // Nom unique pour éviter les conflits : timestamp + nom original
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `personnel-${suffix}${path.extname(file.originalname)}`);
  },
});

const filtreExcel = (req, file, cb) => {
  const extensionsAutorisees = [".xlsx", ".xls"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (extensionsAutorisees.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error("Format de fichier non supporté. Seuls les fichiers .xlsx et .xls sont acceptés."),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter: filtreExcel,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo max
  },
});

// ── Middleware de gestion des erreurs Multer ──────────────────────────────────

const gererErreurUpload = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Fichier trop volumineux. La taille maximale est de 10 Mo.",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// ── Route ─────────────────────────────────────────────────────────────────────

// POST /api/import/personnel
// Body : multipart/form-data  →  champ "fichier" = fichier Excel
router.post(
  "/personnel",
  upload.single("fichier"),
  gererErreurUpload,
  importerPersonnelExcel
);

router.post("/import-data", upload.single("fichier"), importerDonnees);


export default router;
