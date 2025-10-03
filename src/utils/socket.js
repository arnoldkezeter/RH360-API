// util/socket.js
import { Server } from 'socket.io';

let io;
const userSockets = new Map();

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log('Nouvelle connexion Socket.IO:', socket.id);

        // Authentification du socket
        socket.on('authenticate', (data) => {
            const { userId, token } = data;
            
            // TODO: Vérifier le token ici
            
            userSockets.set(userId, socket.id);
            socket.userId = userId;
            
            // Joindre une room personnelle
            socket.join(`user_${userId}`);
            
            console.log(`Utilisateur ${userId} authentifié avec socket ${socket.id}`);
            
            socket.emit('authenticated', { success: true });
        });

        // Rejoindre une room spécifique
        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`Socket ${socket.id} a rejoint la room ${roomId}`);
        });

        // Quitter une room
        socket.on('leave_room', (roomId) => {
            socket.leave(roomId);
            console.log(`Socket ${socket.id} a quitté la room ${roomId}`);
        });

        socket.on('disconnect', () => {
            if (socket.userId) {
                userSockets.delete(socket.userId);
                console.log(`Utilisateur ${socket.userId} déconnecté`);
            }
        });

        socket.on('error', (error) => {
            console.error('Erreur Socket.IO:', error);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO non initialisé. Appelez initSocket() d\'abord.');
    }
    return io;
};

export const getUserSockets = () => userSockets;

// Fonction utilitaire pour envoyer une notification à un utilisateur
export const sendNotificationToUser = (userId, event, data) => {
    const io = getIO();
    io.to(`user_${userId}`).emit(event, data);
};

// Fonction pour envoyer à plusieurs utilisateurs
export const sendNotificationToUsers = (userIds, event, data) => {
    const io = getIO();
    userIds.forEach(userId => {
        io.to(`user_${userId}`).emit(event, data);
    });
};

// Fonction pour broadcast à tous
export const broadcastNotification = (event, data) => {
    const io = getIO();
    io.emit(event, data);
};