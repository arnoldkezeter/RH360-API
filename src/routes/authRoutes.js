import express from 'express';
import { register, login, verifyPasswordController } from '../controllers/authController.js';
import { authentificate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/:userId/verify-password', authentificate, verifyPasswordController);


export default router;