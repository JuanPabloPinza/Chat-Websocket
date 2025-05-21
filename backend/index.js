const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();

// Middleware to handle CORS and log IP
app.use((req, res, next) => {
    cors({
        origin: "*",
    })
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`Usuario conectado con ip: ${ip}`);
    next();
})

const server = http.createServer(app);
const io = new Server(server, {
    path: "/socket.io/",
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});
const PORT = process.env.PORT || 3001;

// Data structures
let rooms = {};
let deviceInRoom = new Map(); // deviceId -> pin
let socketToDevice = new Map(); // socket.id -> deviceId

// Root route
app.get('/', (req, res) => {
    res.send('El servidor de websocket de chats está corriendo');
});

// Generate unique PIN for rooms
function generatePIN() {
    let pin;
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[pin]);
    return pin;
}

// Handle room logic
function logicaSalas(socketInstance, pin, deviceId, isCreator = false) {
    if (!deviceId) {
        socketInstance.emit('error', { message: 'Device ID is required.' });
        return;
    }

    const room = rooms[pin];
    if (!room) {
        socketInstance.emit('error', { message: 'Sala no encontrada o el PIN es inválido.' });
        return;
    }

    // Check if device is already in the room
    if (room.deviceIds.has(deviceId)) {
        socketInstance.emit('error', { message: 'Ya estás dentro de esta sala, sal primero.' });
        return;
    }

    // Check if device is in another room
    if (deviceInRoom.has(deviceId) && deviceInRoom.get(deviceId) !== pin) {
        socketInstance.emit('error', { message: `El dispositivo con ID ${deviceId} ya se encuentra en la sala ${deviceInRoom.get(deviceId)}.` });
        return;
    }

    // Check if room is full
    if (room.participants.size >= room.limit) {
        socketInstance.emit('error', { message: 'Error, no te puedes unir, la sala está llena' });
        return;
    }

    // Join the user to the room
    socketInstance.join(pin);
    room.participants.add(socketInstance.id);
    room.deviceIds.add(deviceId);
    deviceInRoom.set(deviceId, pin); // Associate deviceId with PIN
    socketToDevice.set(socketInstance.id, deviceId); // Map socket.id to deviceId

    console.log(`El dispositivo con ID: ${deviceId} (Socket ${socketInstance.id}) se ha unido a la sala ${pin}. Ahora hay: ${room.participants.size}/${room.limit} participantes`);

    socketInstance.emit('joinedRoom', {
        pin,
        limit: room.limit,
        participantsCount: room.participants.size,
        isCreator
    });

    io.to(pin).emit('roomUpdate', { participantsCount: room.participants.size, users: Array.from(room.deviceIds) });
    if (!isCreator) {
        socketInstance.to(pin).emit('newMessage', { user: 'System', text: `El Usuario ${deviceId.substring(0, 6)} se ha unido.` });
    }
}

// Handle leaving a room
function handleLeaveRoom(socketInstance) {
    const deviceId = socketToDevice.get(socketInstance.id); // Get deviceId from socket.id
    if (!deviceId) return; // If no deviceId mapped, nothing to do

    const roomPin = deviceInRoom.get(deviceId);
    const room = rooms[roomPin];
    if (!room) return; // If room doesn't exist, nothing to do

    // Remove socket from participants and device from room
    room.participants.delete(socketInstance.id);
    room.deviceIds.delete(deviceId);
    deviceInRoom.delete(deviceId); // Remove deviceId from deviceInRoom
    socketToDevice.delete(socketInstance.id); // Remove socket.id -> deviceId mapping

    console.log(`El dispositivo ${deviceId} (Socket ${socketInstance.id}) salió de la sala ${roomPin}. Quedan: ${room.participants.size} usuarios`);
    socketInstance.leave(roomPin);
    socketInstance.emit('leftRoomFeedback', { message: `Has salido de la sala con PIN: ${roomPin}` });

    if (room.participants.size === 0) {
        delete rooms[roomPin];
        console.log(`La sala con el PIN: ${roomPin} está vacía y ha sido eliminada.`);
    } else {
        io.to(roomPin).emit('roomUpdate', { participantsCount: room.participants.size, users: Array.from(room.deviceIds) });
        io.to(roomPin).emit('newMessage', { user: 'System', text: `El usuario ${deviceId.substring(0, 6)} ha salido del chat.` });
    }
}

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`Usuario Contectado: ${socket.id}`);
    console.log(`IP: ${socket.client.conn.remoteAddress}`);

    socket.on('createRoom', ({ limit, deviceId }) => {
        // if(limit <= 1 ) {
        //     socket.emit('error', { message: 'Error, el límite de usuarios debe ser mayor a 1.' });
        //     return;
        // }
        if (!deviceId) {
            socket.emit('error', { message: 'Error, se requiere el ID de la sala para unirse.' });
            return;
        }
        if (deviceInRoom.has(deviceId)) {
            socket.emit('error', { message: 'Error, el dispositivo ya se encuentra en una sala.' });
            return;
        }

        const pin = generatePIN();
        rooms[pin] = {
            limit: parseInt(limit, 10) || 5,
            participants: new Set(),
            deviceIds: new Set()
        };
        console.log(`Sala creada con el PIN: ${pin} con límite de ${rooms[pin].limit} Usuarios`);

        logicaSalas(socket, pin, deviceId, true);
    });

    socket.on('joinRoom', ({ pin, deviceId }) => {
        if (!deviceId) {
            socket.emit('error', { message: 'Error, se requiere el ID de la sala para unirse.' });
            return;
        }
        if (deviceInRoom.has(deviceId)) {
            socket.emit('error', { message: 'Error, el dispositivo ya se encuentra en una sala.' });
            return;
        }

        logicaSalas(socket, pin, deviceId);
    });

    socket.on('sendMessage', ({ pin, message, deviceId, user }) => {
        const room = rooms[pin];
        if (room && room.participants.has(socket.id)) {
            io.to(pin).emit('newMessage', { user: user || deviceId.substring(0, 6) + "...", text: message, timestamp: new Date().toLocaleTimeString() });
        } else {
            socket.emit('error', { message: 'Error, no te puedes unir o el chat con el PIN proporcionado no existe' });
        }
    });

    socket.on('leaveRoom', () => {
        handleLeaveRoom(socket);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleLeaveRoom(socket);
    });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`El websocket fue iniciado en el puerto:${PORT}`);
});