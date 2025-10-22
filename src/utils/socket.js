import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

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

    // ✅ Middleware d'authentification
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            console.error('❌ Pas de token fourni');
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            // Enlever "Bearer " si présent
            const cleanToken = token.replace('Bearer ', '');
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
            
            socket.userId = decoded.id || decoded.userId || decoded._id;
            console.log(`✅ Token validé pour userId: ${socket.userId}`);
            next();
        } catch (err) {
            console.error('❌ Token invalide:', err.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`🔌 Connexion Socket.IO: ${socket.id} - User: ${userId}`);

        // Enregistrer le socket
        if (userId) {
            userSockets.set(userId.toString(), socket.id);
            socket.join(`user_${userId}`);
            console.log(`📍 User ${userId} a rejoint room: user_${userId}`);
            
            // Confirmer l'authentification
            socket.emit('authenticated', { success: true, userId });
        }

        // Rejoindre un chat
        socket.on('join_chat', (chatId) => {
            const roomName = `chat_${chatId}`;
            socket.join(roomName);
            console.log(`💬 ${userId} a rejoint ${roomName}`);
            socket.emit('chat_joined', { chatId, success: true });
        });

        // Quitter un chat
        socket.on('leave_chat', (chatId) => {
            const roomName = `chat_${chatId}`;
            socket.leave(roomName);
            console.log(`👋 ${userId} a quitté ${roomName}`);
        });

        // Événement typing
        socket.on('typing', ({ chatId, userName }) => {
            socket.to(`chat_${chatId}`).emit('user_typing', { 
                chatId, 
                userName,
                userId 
            });
        });

        socket.on('stop_typing', ({ chatId }) => {
            socket.to(`chat_${chatId}`).emit('user_stop_typing', { 
                chatId,
                userId 
            });
        });

        socket.on('disconnect', (reason) => {
            console.log(`❌ Déconnexion ${userId}: ${reason}`);
            if (userId) {
                userSockets.delete(userId.toString());
            }
        });

        socket.on('error', (error) => {
            console.error('❗ Erreur Socket:', error);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO non initialisé');
    }
    return io;
};

export const getUserSockets = () => userSockets;

export const sendNotificationToUser = (userId, event, data) => {
    try {
        const io = getIO();
        const userRoom = `user_${userId}`;
        console.log(`📤 Envoi ${event} à ${userRoom}`);
        io.to(userRoom).emit(event, data);
    } catch (error) {
        console.error(`❌ Erreur envoi notification à ${userId}:`, error);
    }
};

export const sendNotificationToUsers = (userIds, event, data) => {
    const io = getIO();
    userIds.forEach(userId => {
        io.to(`user_${userId}`).emit(event, data);
    });
};

export const broadcastNotification = (event, data) => {
    const io = getIO();
    io.emit(event, data);
};