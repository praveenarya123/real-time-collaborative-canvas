const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Store httpServer globally for Socket.io initialization
  global.httpServer = httpServer;

  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket.io logic
  const rooms = new Map();
  const userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ];
  let colorIndex = 0;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-room', (roomId, userName) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          drawHistory: []
        });
      }

      const room = rooms.get(roomId);
      const userColor = userColors[colorIndex % userColors.length];
      colorIndex++;

      const user = {
        id: socket.id,
        name: userName || `User ${room.users.size + 1}`,
        color: userColor
      };

      room.users.set(socket.id, user);

      socket.emit('init-canvas', {
        drawHistory: room.drawHistory,
        users: Array.from(room.users.values()),
        userId: socket.id,
        userColor
      });

      socket.to(roomId).emit('user-joined', user);
      console.log(`User ${user.name} joined room ${roomId}`);
    });

    socket.on('draw', (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        room.drawHistory.push(data.operation);
        socket.to(data.roomId).emit('draw', data.operation);
      }
    });

    socket.on('undo', (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        for (let i = room.drawHistory.length - 1; i >= 0; i--) {
          if (room.drawHistory[i].userId === data.userId) {
            room.drawHistory.splice(i, 1);
            io.to(data.roomId).emit('undo', data.userId);
            break;
          }
        }
      }
    });

    socket.on('redo', (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        room.drawHistory.push(data.operation);
        socket.to(data.roomId).emit('redo', {
          userId: data.operation.userId,
          operation: data.operation
        });
      }
    });

    socket.on('clear-canvas', (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.drawHistory = [];
        io.to(roomId).emit('clear-canvas');
      }
    });

    socket.on('cursor-move', (data) => {
      const room = rooms.get(data.roomId);
      if (room && room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        user.cursor = { x: data.x, y: data.y };
        socket.to(data.roomId).emit('cursor-move', {
          userId: socket.id,
          userName: user.name,
          color: user.color,
          x: data.x,
          y: data.y
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      rooms.forEach((room, roomId) => {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          io.to(roomId).emit('user-left', socket.id);

          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});