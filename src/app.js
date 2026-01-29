import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import authRoutes from './routes/authRoutes.js';
import structureRoutes from './routes/structureRoutes.js';
import axeStrategiqueRoutes from './routes/axeStrategiqueRoutes.js';
import cohorteRoutes from './routes/cohorteRoutes.js';
import competenceRoutes from './routes/competenceRoutes.js';
import etablissementRoutes from './routes/etablissementRoutes.js';
import familleMetierRoutes from './routes/familleMetierRoutes.js';
import posteDeTravailRoutes from './routes/posteDeTravailRoutes.js';
import gradeRoutes from './routes/gradeRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import categorieProfessionnelleRoutes from './routes/categorieProfessionnelleRoutes.js';
import taxeRoutes from './routes/taxeRoutes.js';
import regionRoutes from './routes/regionRoutes.js';
import departementRoutes from './routes/departementRoutes.js';
import communeRoutes from './routes/communeRoutes.js';
import budgetFormationRoutes from './routes/budgetFormationRoutes.js';
import depenseRoutes from './routes/depenseRoutes.js';
import utilisateurRoutes from './routes/utilisateurRoutes.js';
import objectifThemeRoutes from './routes/objectifThemeRoutes.js';
import supportFormationRoutes from './routes/supportFormationRoutes.js';
import themeFormationRoutes from './routes/themeFormationRoutes.js';
import lieuFormationRoutes from './routes/lieuFormationRoutes.js';
import participantFormationRoutes from './routes/participantFormationRoutes.js';
import formateurRoutes from './routes/formateurRoutes.js';
import formationRoutes from './routes/formationRoutes.js';
import tacheGeneriqueRoutes from './routes/tacheGeneriqueRoutes.js';
import tacheThemeFormationRoutes from './routes/tacheThemeFormationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import tableauDeBordRoutes from './routes/tableauDeBordRoutes.js';
import programmeFormationRoutes from './routes/programmeFormationRoutes.js';
import besoinFormationPredefiniRoutes from './routes/besoinFormationPredefiniRoutes.js';
import autoEvaluationBesoinRoutes from './routes/autoEvaluationBesoinRoutes.js';
import besoinAjouteUtilisateurRoutes from './routes/besoinAjouteUtilisateurRoutes.js';
import evaluationAChaudRoutes from './routes/evaluationAChaudRoutes.js';
import evaluationAChaudReponseRoutes from './routes/evaluationAChaudReponseRoutes.js';
import echelleReponseRoutes from './routes/echelleDeReponseRoutes.js';
import typeEchelleReponseRoutes from './routes/typeEchelleDeReponseRoutes.js';
import stagiaireRoutes from './routes/stagiaireRoutes.js';
import stageRoutes from './routes/stageRoutes.js';
import stageRechercheRoutes from './routes/stageRechercheRoutes.js';
import tacheStagiaireRoutes from './routes/tacheStagiaireRoutes.js';
import chercheurRoutes from './routes/chercheurRoutes.js';
import importDataRoutes from './routes/importDataRoutes.js';
import exportDocumentRoutes from './routes/exportRoutes.js';
import generatePDFRoutes from './routes/generatePDFRoutes.js';
import noteServiceRoutes from './routes/noteServiceRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { authentificate } from './middlewares/auth.js';
import { authorize } from './middlewares/role.js';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Server } from 'socket.io';
import http from 'http';
import { initSocket } from './utils/socket.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(helmet());
app.use(morgan('dev'));

//gerer les documents avec ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//middleware pour servir les supports de formations
app.use('/files/supports', express.static(path.join(process.cwd(), 'public/uploads/supports')));
app.use('/files/photos_profil', express.static(path.join(process.cwd(), 'public/uploads/photos_profil')));
app.use('/files/fichiers_tache_executee', express.static(path.join(process.cwd(), 'public/uploads/fichiers_tache_executee')));

connectDB();
// Créer le serveur HTTP
const server = http.createServer(app);

// Initialiser Socket.IO
initSocket(server);
//Route d'autentification
app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/structures', structureRoutes);
app.use('/api/v1/axes-strategiques', axeStrategiqueRoutes);
app.use('/api/v1/cohortes', cohorteRoutes);
app.use('/api/v1/competences', competenceRoutes);
app.use('/api/v1/etablissements', etablissementRoutes);
app.use('/api/v1/familles-de-metier', familleMetierRoutes);
app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/postes-de-travail', posteDeTravailRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/categories-professionnelles', categorieProfessionnelleRoutes);
app.use('/api/v1/taxes', taxeRoutes);
app.use('/api/v1/regions', regionRoutes);
app.use('/api/v1/departements', departementRoutes);
app.use('/api/v1/communes', communeRoutes);
app.use('/api/v1/theme-formation/budgets-formations', budgetFormationRoutes);
app.use('/api/v1/theme-formation/depenses', depenseRoutes);
app.use('/api/v1/utilisateurs', utilisateurRoutes);
app.use('/api/v1/theme-formation/supports-formation', supportFormationRoutes);
app.use('/api/v1/themes-formations', themeFormationRoutes);
app.use('/api/v1/theme-formation/lieux-formation', lieuFormationRoutes);
app.use('/api/v1/theme-formation/participants-formation', participantFormationRoutes);
app.use('/api/v1/theme-formation/formateurs', formateurRoutes);
app.use('/api/v1/theme-formation/objectifs', objectifThemeRoutes);
app.use('/api/v1/formations', formationRoutes);
app.use('/api/v1/taches-generiques', tacheGeneriqueRoutes);
app.use('/api/v1/taches-theme-formation', tacheThemeFormationRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/tableau-de-bord', tableauDeBordRoutes);
app.use('/api/v1/programmes-de-formation', programmeFormationRoutes);
app.use('/api/v1/besoins-formation-predefinis', besoinFormationPredefiniRoutes);
app.use('/api/v1/auto-evaluations', autoEvaluationBesoinRoutes);
app.use('/api/v1/besoins-ajoutes', besoinAjouteUtilisateurRoutes);
app.use('/api/v1/evaluations-a-chaud', evaluationAChaudRoutes);
app.use('/api/v1/evaluations-a-chaud-reponses', evaluationAChaudReponseRoutes);
app.use('/api/v1/type-echelle-reponse/echelles-reponses', echelleReponseRoutes);
app.use('/api/v1/types-echelles-reponses', typeEchelleReponseRoutes);
app.use('/api/v1/stagiaires', stagiaireRoutes);
app.use('/api/v1/stages', stageRoutes);
app.use('/api/v1/stages-recherche', stageRechercheRoutes);
app.use('/api/v1/stagiaire/taches-stagiaire', tacheStagiaireRoutes);
app.use('/api/v1/chercheurs', chercheurRoutes);
app.use('/api/v1/import-export-data', importDataRoutes);
app.use('/api/v1/export-document', exportDocumentRoutes);
app.use('/api/v1/generate-document', generatePDFRoutes)
app.use('/api/v1/notes-service', noteServiceRoutes);
app.use('/api/v1/notifications', notificationRoutes)

// Route racine
app.get('/', (req, res) => {
    res.status(200).json({
      message: 'Bienvenue sur l’API RH360 🎯',
      name: 'RH360 API',
      version: '1.0.0',
      status: '🟢 En ligne',
      timestamp: new Date().toISOString()
    });
  });

export { server }; 
