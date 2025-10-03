import { server as httpServer } from './src/app.js';


const PORT = process.env.PORT || 5000;

// Démarrez le serveur HTTP/Socket.IO (pas seulement l'app Express)
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`📡 Socket.IO activé sur le port ${PORT}`); // Afficher le port pour confirmation
});

// Ancien code à retirer: app.listen(PORT, ...);
