const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const rooms = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (data) => {
    const { roomName, playerLimit, playerName } = data;

    if (Array.from(rooms.values()).some(r => r.name === roomName)) {
      socket.emit('roomCreationError', 'Room name already exists');
      return;
    }

    const room = {
      id: Date.now().toString(),
      name: roomName,
      playerLimit: playerLimit,
      players: new Map(),
      foods: []
    };

    rooms.set(room.id, room);
    socket.join(room.id);
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0
    });

    socket.emit('roomCreated', room);
    io.emit('roomsList', getRoomsList());
  });

  socket.on('getRooms', () => {
    socket.emit('roomsList', getRoomsList());
  });

  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('roomError', 'Room not found');
      return;
    }

    if (room.players.size >= room.playerLimit) {
      socket.emit('roomError', 'Room is full');
      return;
    }

    socket.join(roomId);
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0
    });

    socket.emit('roomJoined', room);
    io.to(roomId).emit('playerJoined', {
      id: socket.id,
      name: playerName
    });
    io.emit('roomsList', getRoomsList());
  });

  socket.on('update', (data) => {
    socket.broadcast.emit('players', [data]);
  });

  socket.on('chat', (data) => {
    io.emit('chat', data);
  });

  socket.on('collision', (data) => {
    io.to(data.killed).emit('died');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);

        if (room.players.size === 0) {
          rooms.delete(roomId);
        }

        io.to(roomId).emit('playerLeft', { id: socket.id });
        io.emit('roomsList', getRoomsList());
      }
    }
  });
});

function getRoomsList() {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.size,
    playerLimit: room.playerLimit
  }));
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
