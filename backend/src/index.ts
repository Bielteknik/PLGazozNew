import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { randomUUID } from 'crypto';
import path from 'path';
import { DatabaseManager } from './db/DatabaseManager';
import { StateManager } from './state/StateManager';
import { SerialManager } from './hardware/SerialManager';
import { GPIOManager } from './hardware/GPIOManager';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const httpServer = createServer(app);

const dbManager = new DatabaseManager();
const serialManager = new SerialManager();
const gpioManager = new GPIOManager();

const io = new Server(httpServer, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

const stateManager = new StateManager(dbManager, serialManager, gpioManager, (newState) => {
  io.emit('STATE_UPDATE', newState);
});

// Middleware
app.use(cors());
app.use(express.json());

// Broadcast state updates to all clients
stateManager.onUpdate = (data) => {
  io.emit('STATE_UPDATE', data);
};

// Broadcast terminal data from serial to all clients
serialManager.onData = (nanoId, data) => {
  io.emit('TERMINAL_OUTPUT', { nanoId, data });
};

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current state on connect
  socket.emit('STATE_UPDATE', stateManager.getState());

  // Manual login for manual mode
  socket.on('MANUAL_LOGIN', (data) => {
    const { password } = data;
    const expected = process.env.MANUAL_PASSWORD || 'admin123';
    if (password === expected) {
      const token = randomUUID();
      const expires = Date.now() + 30 * 60 * 1000; // 30 minutes
      stateManager.setManualAuth(token, expires);
      socket.emit('MANUAL_TOKEN', { token, expires });
      console.log('[Auth] Manual login successful, token sent');
    } else {
      socket.emit('ERROR', { message: 'Invalid manual mode password' });
      console.warn('[Auth] Manual login failed');
    }
  });

  socket.on('MANUAL_LOGOUT', () => {
    stateManager.clearManualAuth();
    socket.emit('MANUAL_LOGOUT_SUCCESS');
    console.log('[Auth] Manual logout processed');
  });


  socket.on('GET_STATE', () => {
    socket.emit('STATE_UPDATE', stateManager.getState());
  });

  socket.on('ACTION', (action) => {
    stateManager.handleAction(action);
  });

  socket.on('TERMINAL_INPUT', (payload) => {
    const { nanoId, data } = payload;
    if (nanoId === 'ALL') {
      // Broadcast to all configured nanos
      stateManager.getState().nanos.forEach(n => {
         serialManager.sendCommand(n.id, data);
      });
    } else {
      serialManager.sendCommand(nanoId, data);
    }
  });
});

// Serve frontend build if configured
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend is running' });
  });
}

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`[Server] HMI Backend started on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[Server] Shutting down...');
  gpioManager.cleanup();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
