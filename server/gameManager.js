import { GameSession } from './gameSession.js';

export class GameManager {
  constructor() {
    this.games = new Map();
    this.playerConnections = new Map();
  }

  handleMessage(ws, data) {
    const { type, gameCode, playerId } = data;
    console.log('Received message:', { type, gameCode, playerId });

    switch (type) {
      case 'create_game':
        this.createGame(ws, gameCode, playerId);
        break;
      case 'join_game':
        this.joinGame(ws, gameCode, playerId);
        break;
      case 'player_action':
        this.handlePlayerAction(ws, data);
        break;
      case 'resign':
        this.handleResign(ws, data);
        break;
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Unknown message type' 
        }));
    }
  }

  createGame(ws, gameCode, playerId) {
    if (this.games.has(gameCode)) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Game code already exists' 
      }));
      return;
    }

    const game = new GameSession(gameCode);
    game.addPlayer(playerId, ws);
    this.games.set(gameCode, game);
    this.playerConnections.set(ws, { gameCode, playerId });

    ws.send(JSON.stringify({ 
      type: 'game_created', 
      gameCode,
      playerId 
    }));
  }

  joinGame(ws, gameCode, playerId) {
    const game = this.games.get(gameCode);
    if (!game) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Game not found' 
      }));
      return;
    }

    if (game.isFull()) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Game is full' 
      }));
      return;
    }

    game.addPlayer(playerId, ws);
    this.playerConnections.set(ws, { gameCode, playerId });

    game.broadcastToAll({ 
      type: 'player_joined', 
      playerId 
    });

    if (game.canStart()) {
      game.startGame();
    }
  }

  handlePlayerAction(ws, data) {
    const connection = this.playerConnections.get(ws);
    if (!connection) return;

    const game = this.games.get(connection.gameCode);
    if (!game) return;

    game.handlePlayerAction(connection.playerId, data);
  }

  handleResign(ws, data) {
    const connection = this.playerConnections.get(ws);
    if (!connection) return;

    const game = this.games.get(connection.gameCode);
    if (!game) return;

    game.handleResign(connection.playerId);
  }

  handleDisconnect(ws) {
    const connection = this.playerConnections.get(ws);
    if (!connection) return;

    const game = this.games.get(connection.gameCode);
    if (game) {
      game.handleDisconnect(connection.playerId);
      
      if (game.isEmpty()) {
        this.games.delete(connection.gameCode);
      }
    }

    this.playerConnections.delete(ws);
  }
}