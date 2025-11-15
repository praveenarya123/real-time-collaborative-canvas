"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Brush, Eraser, Undo, Redo, Trash2, Users, Sparkles } from 'lucide-react';

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

interface RemoteCursor {
  x: number;
  y: number;
  userName: string;
  color: string;
}

const ROOM_ID = 'default-room';

export default function CollaborativeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'draw' | 'erase'>('draw');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userColor, setUserColor] = useState<string>('#FF6B6B');
  const [drawHistory, setDrawHistory] = useState<DrawOperation[]>([]);
  const [localHistory, setLocalHistory] = useState<DrawOperation[]>([]);
  const [redoHistory, setRedoHistory] = useState<DrawOperation[]>([]);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  const colors = [
    '#000000', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739'
  ];

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io({
      path: '/api/socket',
    });

    socketInstance.on('connect', () => {
      console.log('Connected to socket server');
      setIsConnected(true);
      socketInstance.emit('join-room', ROOM_ID, `User ${Math.floor(Math.random() * 1000)}`);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setIsConnected(false);
    });

    socketInstance.on('init-canvas', (data: {
      drawHistory: DrawOperation[];
      users: User[];
      userId: string;
      userColor: string;
    }) => {
      console.log('Canvas initialized', data);
      setDrawHistory(data.drawHistory);
      setUsers(data.users);
      setCurrentUserId(data.userId);
      setUserColor(data.userColor);
      setCurrentColor(data.userColor);
      
      // Redraw canvas with history
      redrawCanvas(data.drawHistory);
    });

    socketInstance.on('draw', (operation: DrawOperation) => {
      console.log('Received draw operation', operation);
      setDrawHistory(prev => [...prev, operation]);
      drawOperation(operation);
    });

    socketInstance.on('user-joined', (user: User) => {
      console.log('User joined', user);
      setUsers(prev => [...prev, user]);
    });

    socketInstance.on('user-left', (userId: string) => {
      console.log('User left', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setRemoteCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(userId);
        return newCursors;
      });
    });

    socketInstance.on('undo', (userId: string) => {
      console.log('Undo operation', userId);
      setDrawHistory(prev => {
        const newHistory = [...prev];
        for (let i = newHistory.length - 1; i >= 0; i--) {
          if (newHistory[i].userId === userId) {
            newHistory.splice(i, 1);
            break;
          }
        }
        redrawCanvas(newHistory);
        return newHistory;
      });
    });

    socketInstance.on('redo', (data: { userId: string; operation: DrawOperation }) => {
      console.log('Redo operation', data);
      setDrawHistory(prev => {
        const newHistory = [...prev, data.operation];
        redrawCanvas(newHistory);
        return newHistory;
      });
    });

    socketInstance.on('clear-canvas', () => {
      console.log('Canvas cleared');
      setDrawHistory([]);
      setLocalHistory([]);
      setRedoHistory([]);
      clearCanvas();
    });

    socketInstance.on('cursor-move', (data: {
      userId: string;
      userName: string;
      color: string;
      x: number;
      y: number;
    }) => {
      setRemoteCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(data.userId, {
          x: data.x,
          y: data.y,
          userName: data.userName,
          color: data.color
        });
        return newCursors;
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const redrawCanvas = useCallback((history: DrawOperation[]) => {
    clearCanvas();
    history.forEach(operation => {
      drawOperation(operation);
    });
  }, [clearCanvas]);

  const drawOperation = useCallback((operation: DrawOperation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = operation.type === 'erase' ? '#FFFFFF' : operation.color;
    ctx.lineWidth = operation.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (operation.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(operation.points[0].x, operation.points[0].y);

    for (let i = 1; i < operation.points.length; i++) {
      ctx.lineTo(operation.points[i].x, operation.points[i].y);
    }

    ctx.stroke();
  }, []);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    setCurrentPoints([coords]);
  }, [getCanvasCoordinates]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      // Just track cursor for other users
      const coords = getCanvasCoordinates(e);
      if (socket && isConnected) {
        socket.emit('cursor-move', {
          roomId: ROOM_ID,
          x: coords.x,
          y: coords.y
        });
      }
      return;
    }

    const coords = getCanvasCoordinates(e);
    setCurrentPoints(prev => [...prev, coords]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = currentTool === 'erase' ? '#FFFFFF' : currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const prevPoints = currentPoints;
    if (prevPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(prevPoints[prevPoints.length - 1].x, prevPoints[prevPoints.length - 1].y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  }, [isDrawing, currentTool, currentColor, brushSize, currentPoints, getCanvasCoordinates, socket, isConnected]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentPoints.length === 0) {
      setIsDrawing(false);
      return;
    }

    setIsDrawing(false);

    const operation: DrawOperation = {
      type: currentTool,
      points: currentPoints,
      color: currentColor,
      width: brushSize,
      userId: currentUserId,
      timestamp: Date.now()
    };

    setLocalHistory(prev => [...prev, operation]);
    setDrawHistory(prev => [...prev, operation]);
    setRedoHistory([]); // Clear redo history when new drawing is made

    if (socket && isConnected) {
      socket.emit('draw', {
        roomId: ROOM_ID,
        operation
      });
    }

    setCurrentPoints([]);
  }, [isDrawing, currentPoints, currentTool, currentColor, brushSize, currentUserId, socket, isConnected]);

  const handleUndo = useCallback(() => {
    if (localHistory.length === 0) return;

    const lastOperation = localHistory[localHistory.length - 1];
    setLocalHistory(prev => prev.slice(0, -1));
    setRedoHistory(prev => [...prev, lastOperation]); // Add to redo stack

    if (socket && isConnected) {
      socket.emit('undo', {
        roomId: ROOM_ID,
        userId: currentUserId
      });
    }

    // Update local draw history
    setDrawHistory(prev => {
      const newHistory = [...prev];
      for (let i = newHistory.length - 1; i >= 0; i--) {
        if (newHistory[i].userId === currentUserId && 
            newHistory[i].timestamp === lastOperation.timestamp) {
          newHistory.splice(i, 1);
          break;
        }
      }
      redrawCanvas(newHistory);
      return newHistory;
    });
  }, [localHistory, socket, isConnected, currentUserId, redrawCanvas]);

  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;

    const lastUndone = redoHistory[redoHistory.length - 1];
    setRedoHistory(prev => prev.slice(0, -1));
    setLocalHistory(prev => [...prev, lastUndone]);

    if (socket && isConnected) {
      socket.emit('redo', {
        roomId: ROOM_ID,
        operation: lastUndone
      });
    }

    // Update local draw history
    setDrawHistory(prev => {
      const newHistory = [...prev, lastUndone];
      redrawCanvas(newHistory);
      return newHistory;
    });
  }, [redoHistory, socket, isConnected, redrawCanvas]);

  const handleClear = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('clear-canvas', ROOM_ID);
    }
    setDrawHistory([]);
    setLocalHistory([]);
    setRedoHistory([]);
    clearCanvas();
  }, [socket, isConnected, clearCanvas]);

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = Math.min(600, window.innerHeight - 300);
      
      // Redraw after resize
      redrawCanvas(drawHistory);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawHistory, redrawCanvas]);

  return (
    <div className="w-full h-[calc(100vh-12rem)] max-w-7xl mx-auto p-4">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-lg">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
          <h2 className="text-xl font-bold text-white">Colorful Canvas</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-xs font-medium text-white">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <Users className="w-3 h-3 text-white" />
            <span className="text-xs font-medium text-white">{users.length} online</span>
          </div>

          {/* Users badges inline */}
          <div className="flex items-center gap-1">
            {users.slice(0, 3).map((user) => (
              <div
                key={user.id}
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </div>
            ))}
            {users.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold bg-gray-600 text-white">
                +{users.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Side by Side */}
      <div className="flex gap-4 h-[calc(100%-4rem)]">
        {/* Left Sidebar - Toolbar */}
        <Card className="w-80 p-4 bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 dark:from-purple-900 dark:via-pink-900 dark:to-yellow-900 overflow-y-auto">
          <div className="space-y-4">
            {/* Drawing Tools */}
            <div className="flex flex-col gap-2">
              <Button
                variant={currentTool === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentTool('draw')}
                className={`w-full ${currentTool === 'draw' ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' : ''}`}
              >
                <Brush className="w-4 h-4 mr-2" />
                Draw
              </Button>
              <Button
                variant={currentTool === 'erase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentTool('erase')}
                className={`w-full ${currentTool === 'erase' ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700' : ''}`}
              >
                <Eraser className="w-4 h-4 mr-2" />
                Erase
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={localHistory.length === 0}
                className="w-full hover:bg-purple-100 dark:hover:bg-purple-900"
              >
                <Undo className="w-4 h-4 mr-2" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={redoHistory.length === 0}
                className="w-full hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                <Redo className="w-4 h-4 mr-2" />
                Redo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="w-full hover:bg-red-100 dark:hover:bg-red-900"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>

            {/* Current Color Display */}
            <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100">Current Color:</span>
              </div>
              <div className="w-full h-12 rounded-lg border-4 border-white shadow-lg" style={{ backgroundColor: currentColor }} />
            </div>

            {/* Color Palette */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-200 via-pink-200 to-purple-200 dark:from-yellow-800 dark:via-pink-800 dark:to-purple-800">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-100 mb-2 block">Color Palette:</span>
              <div className="grid grid-cols-6 gap-1.5">
                {/* Rainbow colors */}
                {['#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#ADFF2F', '#00FF00', '#00CED1', '#1E90FF', '#4169E1', '#8B00FF', '#FF00FF', '#FF1493'].map((color) => (
                  <button
                    key={color}
                    className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 shadow-md ${
                      currentColor === color ? 'border-white ring-2 ring-purple-400 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setCurrentColor(color);
                      setCurrentTool('draw');
                    }}
                  />
                ))}
                
                {/* Neon colors */}
                {['#FF0080', '#FF00FF', '#8000FF', '#0080FF', '#00FFFF', '#00FF80', '#80FF00', '#FFFF00', '#FF8000', '#FF0040', '#C0C0C0', '#808080'].map((color) => (
                  <button
                    key={color}
                    className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 shadow-md ${
                      currentColor === color ? 'border-white ring-2 ring-purple-400 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setCurrentColor(color);
                      setCurrentTool('draw');
                    }}
                  />
                ))}
                
                {/* Pastel colors */}
                {['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4', '#FFDFD3', '#D4F1F4', '#C9E4CA', '#E8E8E8', '#000000', '#FFFFFF'].map((color) => (
                  <button
                    key={color}
                    className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 shadow-md ${
                      currentColor === color ? 'border-white ring-2 ring-purple-400 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setCurrentColor(color);
                      setCurrentTool('draw');
                    }}
                  />
                ))}
                
                {/* Deep rich colors */}
                {['#8B0000', '#FF4500', '#B8860B', '#006400', '#000080', '#4B0082', '#8B008B', '#A0522D', '#2F4F4F', '#696969', '#800000', '#191970'].map((color) => (
                  <button
                    key={color}
                    className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 shadow-md ${
                      currentColor === color ? 'border-white ring-2 ring-purple-400 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setCurrentColor(color);
                      setCurrentTool('draw');
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Brush Size */}
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100">Brush Size:</span>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100">{brushSize}px</span>
              </div>
              <Slider
                value={[brushSize]}
                onValueChange={(value) => setBrushSize(value[0])}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            {/* Tip */}
            <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-200 to-pink-200 dark:from-yellow-800 dark:to-pink-800 border-2 border-purple-300">
              <p className="text-xs text-purple-900 dark:text-purple-100 font-medium">
                💡 Open in multiple tabs to see real-time collaboration!
              </p>
            </div>
          </div>
        </Card>

        {/* Right Side - Canvas */}
        <Card className="flex-1 relative overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          
          {Array.from(remoteCursors.entries()).map(([userId, cursor]) => (
            <div
              key={userId}
              className="absolute pointer-events-none transition-all duration-75"
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: cursor.color }}
              />
              <div
                className="text-xs font-medium px-2 py-1 rounded mt-1 whitespace-nowrap"
                style={{ backgroundColor: cursor.color, color: 'white' }}
              >
                {cursor.userName}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}