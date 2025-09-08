import app from './src/app.js';
import http from 'http';
import { Server } from 'socket.io';


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Créez le serveur HTTP à partir de l'application Express
const server = http.createServer(app);

// Configurez et liez Socket.IO au serveur HTTP
const io = new Server(server, {
  cors: {
    origin: '*', // Permet toutes les origines pour le développement. À ajuster pour la production.
    methods: ['GET', 'POST'],
  },
});

// Gérer les connexions Socket.IO
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté :', socket.id);

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté :', socket.id);
  });
  
  // Rejoindre un chat spécifique (une "room")
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`L'utilisateur ${socket.id} a rejoint le chat ${chatId}.`);
  });
  
  // Quitter un chat
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat_${chatId}`);
    console.log(`L'utilisateur ${socket.id} a quitté le chat ${chatId}.`);
  });
});

// Exportez l'instance de 'io' pour l'utiliser dans vos contrôleurs
export { io, server };
