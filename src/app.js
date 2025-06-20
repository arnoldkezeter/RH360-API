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
import utilisateurRoutes from './routes/utilisateurRoutes.js';
import objectifThemeRoutes from './routes/objectifThemeRoutes.js';
import supportFormationRoutes from './routes/supportFormationRoutes.js';
import themeFormationRoutes from './routes/themeFormationRoutes.js';
import lieuFormationRoutes from './routes/lieuFormationRoutes.js';
import formationRoutes from './routes/formationRoutes.js';
import tacheGeneriqueRoutes from './routes/tacheGeneriqueRoutes.js';
import tacheThemeFormationRoutes from './routes/tacheThemeFormationRoutes.js';
import tableauDeBordRoutes from './routes/tableauDeBordRoutes.js';
import programmeFormationRoutes from './routes/programmeFormationRoutes.js';
import besoinFormationPredefiniRoutes from './routes/besoinFormationPredefiniRoutes.js';
import besoinFormationExprimeRoutes from './routes/besoinFormationExprimeRoutes.js';
import evaluationAChaudRoutes from './routes/evaluationAChaudRoutes.js';
import evaluationAChaudReponseRoutes from './routes/evaluationAChaudReponseRoutes.js';
import stagiaireRoutes from './routes/stagiaireRoutes.js';
import stageRoutes from './routes/stageRoutes.js';
import tacheStagiaireRoutes from './routes/tacheStagiaireRoutes.js';
import chercheurRoutes from './routes/chercheurRoutes.js';
import mandatRechercheRoutes from './routes/mandatRechercheRoutes.js';
import { authentificate } from './middlewares/auth.js';
import { authorize } from './middlewares/role.js';
import connectDB from './config/db.js';
import path from 'path';



const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

//middleware pour servir les supports de formations
app.use('/files/supports', express.static(path.join(process.cwd(), 'uploads/supports')));

connectDB();

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
app.use('/api/v1/budgets-formations', budgetFormationRoutes);
app.use('/api/v1/utilisateurs', utilisateurRoutes);
app.use('/api/v1/objectifs-themes', objectifThemeRoutes);
app.use('/api/v1/support-formation', supportFormationRoutes);
app.use('/api/v1/themes-formations', themeFormationRoutes);
app.use('/api/v1/theme-formation/lieux-formation', lieuFormationRoutes);
app.use('/api/v1/formations', formationRoutes);
app.use('/api/v1/tache-generique', tacheGeneriqueRoutes);
app.use('/api/v1/tache-theme-formation', tacheThemeFormationRoutes);
app.use('/api/v1/tableau-de-bord', tableauDeBordRoutes);
app.use('/api/v1/programmes-de-formation', programmeFormationRoutes);
app.use('/api/v1/besoins-formation-predefinis', besoinFormationPredefiniRoutes);
app.use('/api/v1/besoin-formation-exprime', besoinFormationExprimeRoutes);
app.use('/api/v1/evaluation-a-chaud', evaluationAChaudRoutes);
app.use('/api/v1/evaluation-a-chaud-reponse', evaluationAChaudReponseRoutes);
app.use('/api/v1/stagiaires', stagiaireRoutes);
app.use('/api/v1/stages', stageRoutes);
app.use('/api/v1/taches-stagiaire', tacheStagiaireRoutes);
app.use('/api/v1/chercheurs', chercheurRoutes);
app.use('/api/v1/mandats-recherche', mandatRechercheRoutes);

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
  
export default app;
