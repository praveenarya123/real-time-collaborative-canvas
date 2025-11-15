"use client";

import CollaborativeCanvas from "@/components/CollaborativeCanvas";
import { Card } from "@/components/ui/card";
import { Palette } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Palette className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Collaborative Drawing Canvas
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Draw together in real-time with multiple users. See everyone's cursors, drawings, and collaborate seamlessly!
          </p>
        </div>

        <CollaborativeCanvas />

        <Card className="mt-8 p-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Drawing Tools</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Brush and eraser tools</li>
                <li>Multiple color options</li>
                <li>Adjustable brush size (1-20px)</li>
                <li>Touch and mouse support</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">Collaboration</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Real-time drawing synchronization</li>
                <li>Live cursor tracking</li>
                <li>Online user presence</li>
                <li>User color identification</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">Canvas Controls</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Undo your own drawings</li>
                <li>Clear entire canvas</li>
                <li>Auto-sync with all users</li>
                <li>Responsive canvas sizing</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">Real-time Updates</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>WebSocket-based communication</li>
                <li>Instant drawing broadcast</li>
                <li>Connection status indicator</li>
                <li>Automatic room management</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Open this page in multiple tabs or devices to see real-time collaboration in action!</p>
        </div>
      </div>
    </div>
  );
}