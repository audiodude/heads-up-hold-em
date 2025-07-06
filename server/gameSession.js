import { shuffleDeck } from './utils.js';
import { HandEvaluator } from './handEvaluator.js';

export class GameSession {
  constructor(gameCode) {
    this.gameCode = gameCode;
    this.players = new Map();
    this.playerOrder = [];
    this.gameState = 'waiting';
    this.currentHand = null;
    this.handEvaluator = new HandEvaluator();
  }

  addPlayer(playerId, ws) {
    this.players.set(playerId, {
      id: playerId,
      ws,
      chips: 20000,
      holeCards: [],
      isActive: true,
      currentBet: 0,
      totalBet: 0,
      hasActed: false,
      isAllIn: false
    });
    this.playerOrder.push(playerId);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.playerOrder = this.playerOrder.filter(id => id !== playerId);
  }

  isFull() {
    return this.players.size >= 2;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  canStart() {
    return this.players.size === 2 && this.gameState === 'waiting';
  }

  startGame() {
    this.gameState = 'in_game';
    this.startNewHand();
  }

  startNewHand() {
    this.currentHand = {
      handNumber: (this.currentHand?.handNumber || 0) + 1,
      deck: shuffleDeck(),
      communityCards: [],
      pot: 0,
      phase: 'preflop',
      smallBlind: 50,
      bigBlind: 100,
      dealerIndex: this.currentHand ? 1 - this.currentHand.dealerIndex : 0,
      currentPlayer: null,
      lastRaise: 0,
      roundBets: []
    };

    this.broadcastToAll({
      type: 'new_hand',
      handNumber: this.currentHand.handNumber,
      dealerIndex: this.currentHand.dealerIndex,
      smallBlind: this.currentHand.smallBlind,
      bigBlind: this.currentHand.bigBlind
    });

    this.resetPlayerHand();
    this.postBlinds();
    this.dealHoleCards();
    this.startBettingRound();
  }

  resetPlayerHand() {
    for (const player of this.players.values()) {
      player.holeCards = [];
      player.currentBet = 0;
      player.totalBet = 0;
      player.hasActed = false;
      player.isAllIn = false;
      player.isActive = true;
    }
  }

  postBlinds() {
    const dealerPlayer = this.getPlayerByIndex(this.currentHand.dealerIndex);
    const bigBlindPlayer = this.getPlayerByIndex(1 - this.currentHand.dealerIndex);

    this.placeBet(dealerPlayer.id, this.currentHand.smallBlind);
    this.placeBet(bigBlindPlayer.id, this.currentHand.bigBlind);
    
    this.currentHand.lastRaise = this.currentHand.bigBlind;
  }

  dealHoleCards() {
    for (let i = 0; i < 2; i++) {
      for (const playerId of this.playerOrder) {
        const player = this.players.get(playerId);
        if (player.isActive) {
          player.holeCards.push(this.currentHand.deck.pop());
        }
      }
    }

    this.broadcastToAll({
      type: 'hole_cards_dealt',
      players: this.getPlayerStates()
    });
  }

  startBettingRound() {
    if (this.currentHand.phase === 'preflop') {
      this.currentHand.currentPlayer = this.currentHand.dealerIndex;
    } else {
      this.currentHand.currentPlayer = this.currentHand.dealerIndex;
      // Only reset bets for post-flop rounds (blinds should persist preflop)
      this.resetRoundBets();
    }

    this.broadcastGameState();
  }

  resetRoundBets() {
    for (const player of this.players.values()) {
      player.currentBet = 0;
      player.hasActed = false;
    }
  }

  handlePlayerAction(playerId, action) {
    if (!this.isPlayerTurn(playerId)) {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.isActive) {
      return;
    }

    switch (action.action) {
      case 'fold':
        this.handleFold(playerId);
        break;
      case 'check':
        this.handleCheck(playerId);
        break;
      case 'call':
        this.handleCall(playerId);
        break;
      case 'bet':
        this.handleBet(playerId, action.amount);
        break;
      case 'raise':
        this.handleRaise(playerId, action.amount);
        break;
      case 'all_in':
        this.handleAllIn(playerId);
        break;
    }
  }

  handleFold(playerId) {
    const player = this.players.get(playerId);
    player.isActive = false;
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'fold'
    });

    this.checkHandEnd();
  }

  handleCheck(playerId) {
    const player = this.players.get(playerId);
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'check'
    });

    this.nextPlayer();
  }

  handleCall(playerId) {
    const player = this.players.get(playerId);
    const callAmount = this.getCallAmount(playerId);
    
    if (callAmount > 0) {
      this.placeBet(playerId, callAmount);
    }
    
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'call',
      amount: callAmount
    });

    this.nextPlayer();
  }

  handleBet(playerId, amount) {
    if (!this.isValidBet(playerId, amount)) {
      return;
    }

    this.placeBet(playerId, amount);
    this.currentHand.lastRaise = amount;
    
    const player = this.players.get(playerId);
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'bet',
      amount
    });

    this.nextPlayer();
  }

  handleRaise(playerId, amount) {
    if (!this.isValidRaise(playerId, amount)) {
      return;
    }

    const callAmount = this.getCallAmount(playerId);
    this.placeBet(playerId, callAmount + amount);
    this.currentHand.lastRaise = amount;
    
    const player = this.players.get(playerId);
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'raise',
      amount: amount
    });

    this.nextPlayer();
  }

  handleAllIn(playerId) {
    const player = this.players.get(playerId);
    const allInAmount = player.chips;
    
    this.placeBet(playerId, allInAmount);
    player.isAllIn = true;
    player.hasActed = true;
    
    this.broadcastToAll({
      type: 'player_action',
      playerId,
      action: 'all_in',
      amount: allInAmount
    });

    this.nextPlayer();
  }

  placeBet(playerId, amount) {
    const player = this.players.get(playerId);
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    player.totalBet += actualAmount;
    this.currentHand.pot += actualAmount;
    
    if (player.chips === 0) {
      player.isAllIn = true;
    }
  }

  nextPlayer() {
    if (this.isBettingRoundComplete()) {
      this.endBettingRound();
    } else {
      this.currentHand.currentPlayer = this.getNextActivePlayer();
      this.broadcastGameState();
    }
  }

  isBettingRoundComplete() {
    const activePlayers = Array.from(this.players.values()).filter(p => p.isActive);
    const playersWhoNeedToAct = activePlayers.filter(p => !p.hasActed && !p.isAllIn);
    
    if (playersWhoNeedToAct.length > 0) {
      return false;
    }

    const maxBet = Math.max(...activePlayers.map(p => p.currentBet));
    const playersWithMaxBet = activePlayers.filter(p => p.currentBet === maxBet || p.isAllIn);
    
    return playersWithMaxBet.length === activePlayers.length;
  }

  endBettingRound() {
    this.resetRoundBets();
    
    switch (this.currentHand.phase) {
      case 'preflop':
        this.dealFlop();
        break;
      case 'flop':
        this.dealTurn();
        break;
      case 'turn':
        this.dealRiver();
        break;
      case 'river':
        this.showdown();
        break;
    }
  }

  dealFlop() {
    this.currentHand.phase = 'flop';
    this.currentHand.deck.pop();
    for (let i = 0; i < 3; i++) {
      this.currentHand.communityCards.push(this.currentHand.deck.pop());
    }
    
    this.broadcastToAll({
      type: 'community_cards',
      cards: this.currentHand.communityCards,
      phase: 'flop'
    });
    
    this.startBettingRound();
  }

  dealTurn() {
    this.currentHand.phase = 'turn';
    this.currentHand.deck.pop();
    this.currentHand.communityCards.push(this.currentHand.deck.pop());
    
    this.broadcastToAll({
      type: 'community_cards',
      cards: this.currentHand.communityCards,
      phase: 'turn'
    });
    
    this.startBettingRound();
  }

  dealRiver() {
    this.currentHand.phase = 'river';
    this.currentHand.deck.pop();
    this.currentHand.communityCards.push(this.currentHand.deck.pop());
    
    this.broadcastToAll({
      type: 'community_cards',
      cards: this.currentHand.communityCards,
      phase: 'river'
    });
    
    this.startBettingRound();
  }

  showdown() {
    const activePlayers = Array.from(this.players.values()).filter(p => p.isActive);
    
    if (activePlayers.length === 1) {
      this.awardPot(activePlayers[0].id);
    } else {
      const winner = this.determineWinner(activePlayers);
      this.awardPot(winner.id);
    }
    
    this.endHand();
  }

  determineWinner(players) {
    let bestPlayer = null;
    let bestHand = null;
    
    for (const player of players) {
      const hand = this.handEvaluator.evaluate(
        player.holeCards,
        this.currentHand.communityCards
      );
      
      if (!bestHand || this.handEvaluator.compare(hand, bestHand) > 0) {
        bestPlayer = player;
        bestHand = hand;
      }
    }
    
    return bestPlayer;
  }

  awardPot(winnerId) {
    const winner = this.players.get(winnerId);
    winner.chips += this.currentHand.pot;
    
    this.broadcastToAll({
      type: 'hand_winner',
      winnerId,
      potAmount: this.currentHand.pot,
      winnerChips: winner.chips
    });
  }

  endHand() {
    this.checkGameEnd();
    
    if (this.gameState === 'in_game') {
      this.startNewHand();
    }
  }

  checkGameEnd() {
    const activePlayers = Array.from(this.players.values()).filter(p => p.chips > 0);
    
    if (activePlayers.length === 1) {
      this.gameState = 'game_over';
      this.broadcastToAll({
        type: 'game_over',
        winnerId: activePlayers[0].id
      });
    }
  }

  checkHandEnd() {
    const activePlayers = Array.from(this.players.values()).filter(p => p.isActive);
    
    if (activePlayers.length === 1) {
      this.awardPot(activePlayers[0].id);
      this.endHand();
    }
  }

  handleResign(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.chips = 0;
      player.isActive = false;
      this.checkGameEnd();
    }
  }

  handleDisconnect(playerId) {
    const player = this.players.get(playerId);
    if (player && this.gameState === 'in_game') {
      player.isActive = false;
      this.checkHandEnd();
    }
    this.removePlayer(playerId);
  }

  isPlayerTurn(playerId) {
    return this.currentHand?.currentPlayer === this.playerOrder.indexOf(playerId);
  }

  getCallAmount(playerId) {
    const player = this.players.get(playerId);
    const maxBet = Math.max(...Array.from(this.players.values()).map(p => p.currentBet));
    return Math.max(0, maxBet - player.currentBet);
  }

  isValidBet(playerId, amount) {
    const player = this.players.get(playerId);
    return amount > 0 && amount <= player.chips;
  }

  isValidRaise(playerId, amount) {
    const player = this.players.get(playerId);
    const callAmount = this.getCallAmount(playerId);
    return amount >= this.currentHand.lastRaise && 
           (callAmount + amount) <= player.chips;
  }

  getNextActivePlayer() {
    const currentIndex = this.currentHand.currentPlayer;
    const nextIndex = (currentIndex + 1) % this.playerOrder.length;
    return nextIndex;
  }

  getPlayerByIndex(index) {
    return this.players.get(this.playerOrder[index]);
  }

  getPlayerStates() {
    return Array.from(this.players.values()).map(player => ({
      id: player.id,
      chips: player.chips,
      holeCards: player.holeCards,
      currentBet: player.currentBet,
      isActive: player.isActive,
      isAllIn: player.isAllIn
    }));
  }

  broadcastToAll(message) {
    for (const player of this.players.values()) {
      if (player.ws.readyState === 1) {
        player.ws.send(JSON.stringify(message));
      }
    }
  }

  broadcastGameState() {
    const gameState = {
      type: 'game_state',
      gameCode: this.gameCode,
      phase: this.currentHand?.phase,
      pot: this.currentHand?.pot,
      communityCards: this.currentHand?.communityCards,
      currentPlayer: this.currentHand?.currentPlayer,
      players: this.getPlayerStates(),
      smallBlind: this.currentHand?.smallBlind,
      bigBlind: this.currentHand?.bigBlind
    };
    
    this.broadcastToAll(gameState);
  }
}