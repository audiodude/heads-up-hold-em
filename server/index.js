import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { GameManager } from './gameManager.js';
import { generateGameCode } from './utils.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const gameManager = new GameManager();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      gameManager.handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    gameManager.handleDisconnect(ws);
  });
});

app.post('/api/create-game', (req, res) => {
  const gameCode = generateGameCode();
  res.json({ gameCode });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});