import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import authRoutes from './routes/authRoutes.js';
import { authenticate } from './middlewares/auth.js';
import { authorize } from './middlewares/role.js';
import connectDB from './config/db.js';



const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

connectDB();

//Route d'autentification
app.use('/auth', authRoutes);

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
