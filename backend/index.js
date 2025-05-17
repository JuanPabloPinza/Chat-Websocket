const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();

// app.use(cors({
//     origin: "*",
// }));

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
        // allowedHeaders: ["my-custom-header"], // Solo si es necesario
        // credentials: true // Solo si es necesario
    }
});
const PORT = process.env.PORT || 3001;

let rooms = {};
let deviceInRoom = {};

app.get('/', (req, res) => {
    res.send('El servidor de websocket está corriendo');
});

function generatePIN() {
    let pin;
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[pin]);
    return pin;
}

io.on('connection', (socket) => {
    console.log(`Usuario Contectado: ${socket.id}`);
    console.log(`IP: ${socket.client.conn.remoteAddress}`);


    socket.on('createRoom', ({ limit, deviceId }) => {
        if (!deviceId) {
            socket.emit('error', { message: 'Error, se requiere el ID de la sala para unirse.' });
            return;
        }
        if (deviceInRoom[deviceId]) {
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

        if (deviceInRoom[deviceId] && deviceInRoom[deviceId] !== pin) {
            socketInstance.emit('error', { message: `El dispositivo con ID ${deviceInRoom[deviceId]} ya se encuentra en la sala.` });
            return;
        }
        if (room.deviceIds.has(deviceId)) {
            socketInstance.join(pin);
            room.participants.add(socketInstance.id);
            socketInstance.emit('joinedRoom', {
                pin,
                limit: room.limit,
                participantsCount: room.participants.size,
                isCreator
            });
            io.to(pin).emit('roomUpdate', { participantsCount: room.participants.size, users: Array.from(room.deviceIds) });
            return;
        }

        if (room.participants.size >= room.limit) {
            socketInstance.emit('error', { message: 'Error, no te puedes unir, la sala está llena' });
            return;
        }

        socketInstance.join(pin);
        room.participants.add(socketInstance.id);
        room.deviceIds.add(deviceId);
        deviceInRoom[deviceId] = pin;

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

    socket.on('joinRoom', ({ pin, deviceId }) => {
        logicaSalas(socket, pin, deviceId);
    });

    socket.on('sendMessage', ({ pin, message, deviceId }) => {
        const room = rooms[pin];
        if (room && room.participants.has(socket.id)) {
            io.to(pin).emit('newMessage', { user: deviceId.substring(0, 6) + "...", text: message, timestamp: new Date().toLocaleTimeString() });
        } else {
            socket.emit('error', { message: 'Error, no te puedes unir o el chat con el PIN proporcionado no existe' });
        }
    });

    function handleLeaveRoom(socketInstance) {
        let deviceIdToRemove = null;
        for (const [devId, roomPin] of Object.entries(deviceInRoom)) {
            const room = rooms[roomPin];
            if (room && room.participants.has(socketInstance.id)) {
                deviceIdToRemove = devId;
                const pin = roomPin;

                room.participants.delete(socketInstance.id);
                room.deviceIds.delete(deviceIdToRemove);
                delete deviceInRoom[deviceIdToRemove];

                console.log(`El dispositivo ${deviceIdToRemove} (Socket ${socketInstance.id}) salió de el chat ${pin}. Quedan: ${room.participants.size} usuarios`);
                socketInstance.leave(pin);
                socketInstance.emit('leftRoomFeedback', { message: `Has salido de la sala con PIN: ${pin}` });


                if (room.participants.size === 0) {
                    delete rooms[pin];
                    console.log(`La sala con el PIN: ${pin} está vacío y ha sido eliminado.`);
                } else {
                    io.to(pin).emit('roomUpdate', { participantsCount: room.participants.size, users: Array.from(room.deviceIds) });
                    io.to(pin).emit('newMessage', { user: 'System', text: `El usuario ${deviceIdToRemove.substring(0, 6)} ha salido del chat.` });
                }
                break;
            }
        }
    }

    socket.on('leaveRoom', () => {
        handleLeaveRoom(socket);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleLeaveRoom(socket);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`El websocket fue iniciado en el puerto:${PORT}`);
});

app.get('/', (req, res) => {
    res.send('El websocket de chats está corriendo');
});