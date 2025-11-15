import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

interface DrawOperation {
  type: 'draw' | 'erase';
  points: { x: number; y: number }[];
  color: string;
  width: number;
  userId: string;
  timestamp: number;
}

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

const rooms = new Map<string, {
  users: Map<string, User>;
  drawHistory: DrawOperation[];
}>();

const userColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
];

let colorIndex = 0;

export function initSocketServer(io: SocketIOServer) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-room', (roomId: string, userName?: string) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          drawHistory: []
        });
      }

      const room = rooms.get(roomId)!;
      const userColor = userColors[colorIndex % userColors.length];
      colorIndex++;

      const user: User = {
        id: socket.id,
        name: userName || `User ${room.users.size + 1}`,
        color: userColor
      };

      room.users.set(socket.id, user);

      // Send current state to new user
      socket.emit('init-canvas', {
        drawHistory: room.drawHistory,
        users: Array.from(room.users.values()),
        userId: socket.id,
        userColor
      });

      // Notify others of new user
      socket.to(roomId).emit('user-joined', user);

      console.log(`User ${user.name} joined room ${roomId}`);
    });

    socket.on('draw', (data: { roomId: string; operation: DrawOperation }) => {
      const room = rooms.get(data.roomId);
      if (room) {
        room.drawHistory.push(data.operation);
        socket.to(data.roomId).emit('draw', data.operation);
      }
    });

    socket.on('undo', (data: { roomId: string; userId: string }) => {
      const room = rooms.get(data.roomId);
      if (room) {
        // Find and remove the last operation by this user
        for (let i = room.drawHistory.length - 1; i >= 0; i--) {
          if (room.drawHistory[i].userId === data.userId) {
            room.drawHistory.splice(i, 1);
            io.to(data.roomId).emit('undo', data.userId);
            break;
          }
        }
      }
    });

    socket.on('clear-canvas', (roomId: string) => {
      const room = rooms.get(roomId);
      if (room) {
        room.drawHistory = [];
        io.to(roomId).emit('clear-canvas');
      }
    });

    socket.on('cursor-move', (data: { roomId: string; x: number; y: number }) => {
      const room = rooms.get(data.roomId);
      if (room && room.users.has(socket.id)) {
        const user = room.users.get(socket.id)!;
        user.cursor = { x: data.x, y: data.y };
        socket.to(data.roomId).emit('cursor-move', {
          userId: socket.id,
          x: data.x,
          y: data.y
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // Remove user from all rooms
      rooms.forEach((room, roomId) => {
        if (room.users.has(socket.id)) {
          const user = room.users.get(socket.id)!;
          room.users.delete(socket.id);
          io.to(roomId).emit('user-left', socket.id);

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });
}
