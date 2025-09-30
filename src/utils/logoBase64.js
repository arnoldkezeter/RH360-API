import path from 'path';
import fs from 'fs';
export const getLogoBase64 = (__dirname) => {
    try {
        const logoPath = path.join(__dirname, '../views/logo.png'); // Votre chemin
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        return `data:image/png;base64,${logoBase64}`;
    } catch (error) {
        console.error('Erreur lors du chargement du logo:', error);
        return null;
    }
};