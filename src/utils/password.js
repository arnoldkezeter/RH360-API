// utils/password.js
import bcrypt from 'bcrypt';

export function generateRandomPassword(length = 10) {
    // const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
    // let password = '';
    // for (let i = 0; i < length; i++) {
    //     password += chars.charAt(Math.floor(Math.random() * chars.length));
    // }
    // return password;
    return 'Utilisateur@123';
}

export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (err) {
    // Ne pas renvoyer d'erreur détaillée au client
    console.error('comparePassword error:', err);
    return false;
  }
}

  