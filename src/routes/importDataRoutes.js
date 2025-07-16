import express from "express";
import multer from "multer";
import { importerDonnees } from "../controllers/importDataController.js";

const router = express.Router();

// Si tu veux permettre d'uploader un fichier CSV
const upload = multer({ dest: "uploads/" });

router.post("/import-data", upload.single("fichier"), importerDonnees);

export default router;
