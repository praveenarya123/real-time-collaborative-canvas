import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { initSocketServer } from '@/lib/socket-server';

// Store the io instance globally
let io: SocketIOServer | undefined;

export async function GET(req: NextRequest) {
  if (!io) {
    console.log('Initializing Socket.io server...');
    
    // @ts-expect-error - Accessing internal Next.js server
    const httpServer = (global as any).httpServer;
    
    if (!httpServer) {
      return new Response('WebSocket server not initialized', { status: 500 });
    }

    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    initSocketServer(io);
    console.log('Socket.io server initialized');
  }

  return new Response('Socket.io server running', { status: 200 });
}
