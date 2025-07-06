class HeadsUpHoldemClient {
  constructor() {
    this.ws = null;
    this.gameCode = null;
    this.playerId = null;
    this.gameState = null;
    this.playerIndex = null;
    this.isCreatingGame = false;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.elements = {
      lobby: document.getElementById('lobby'),
      game: document.getElementById('game'),
      createGameBtn: document.getElementById('create-game-btn'),
      joinGameBtn: document.getElementById('join-game-btn'),
      gameCodeInput: document.getElementById('game-code-input'),
      lobbyMessage: document.getElementById('lobby-message'),
      copyCodeSection: document.getElementById('copy-code-section'),
      createdGameCode: document.getElementById('created-game-code'),
      copyCodeBtn: document.getElementById('copy-code-btn'),
      gameCodeDisplay: document.getElementById('game-code-display'),
      potDisplay: document.getElementById('pot-display'),
      phaseDisplay: document.getElementById('phase-display'),
      resignBtn: document.getElementById('resign-btn'),
      opponentName: document.getElementById('opponent-name'),
      opponentChips: document.getElementById('opponent-chips'),
      opponentBet: document.getElementById('opponent-bet'),
      playerName: document.getElementById('player-name'),
      playerChips: document.getElementById('player-chips'),
      playerBet: document.getElementById('player-bet'),
      holeCard1: document.getElementById('hole-card-1'),
      holeCard2: document.getElementById('hole-card-2'),
      communityCards: [
        document.getElementById('community-card-1'),
        document.getElementById('community-card-2'),
        document.getElementById('community-card-3'),
        document.getElementById('community-card-4'),
        document.getElementById('community-card-5')
      ],
      foldBtn: document.getElementById('fold-btn'),
      checkBtn: document.getElementById('check-btn'),
      callBtn: document.getElementById('call-btn'),
      betBtn: document.getElementById('bet-btn'),
      raiseBtn: document.getElementById('raise-btn'),
      allInBtn: document.getElementById('all-in-btn'),
      halfPotBtn: document.getElementById('half-pot-btn'),
      fullPotBtn: document.getElementById('full-pot-btn'),
      betSlider: document.getElementById('bet-slider'),
      betInput: document.getElementById('bet-input'),
      betAmountDisplay: document.getElementById('bet-amount-display'),
      gameMessages: document.getElementById('game-messages')
    };
  }

  setupEventListeners() {
    this.elements.createGameBtn.addEventListener('click', () => this.createGame());
    this.elements.joinGameBtn.addEventListener('click', () => this.joinGame());
    this.elements.copyCodeBtn.addEventListener('click', () => this.copyGameCode());
    this.elements.gameCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });
    this.elements.resignBtn.addEventListener('click', () => this.resign());
    
    this.elements.foldBtn.addEventListener('click', () => this.sendAction('fold'));
    this.elements.checkBtn.addEventListener('click', () => this.sendAction('check'));
    this.elements.callBtn.addEventListener('click', () => this.sendAction('call'));
    this.elements.betBtn.addEventListener('click', () => this.sendAction('bet', this.getBetAmount()));
    this.elements.raiseBtn.addEventListener('click', () => this.sendAction('raise', this.getBetAmount()));
    this.elements.allInBtn.addEventListener('click', () => this.sendAction('all_in'));
    
    this.elements.halfPotBtn.addEventListener('click', () => this.setHalfPot());
    this.elements.fullPotBtn.addEventListener('click', () => this.setFullPot());
    this.elements.betSlider.addEventListener('input', () => this.updateBetFromSlider());
    this.elements.betInput.addEventListener('input', () => this.updateBetAmount());
  }

  async createGame() {
    try {
      const response = await fetch('/api/create-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      this.gameCode = data.gameCode;
      this.playerId = this.generatePlayerId();
      this.isCreatingGame = true;
      
      this.connectWebSocket();
      this.showMessage('Game created! Code: ' + this.gameCode);
      
    } catch (error) {
      this.showMessage('Error creating game: ' + error.message);
    }
  }

  joinGame() {
    const gameCode = this.elements.gameCodeInput.value.trim().toUpperCase();
    if (!gameCode) {
      this.showMessage('Please enter a game code');
      return;
    }
    
    this.gameCode = gameCode;
    this.playerId = this.generatePlayerId();
    this.isCreatingGame = false;
    this.connectWebSocket();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
      console.log('isCreatingGame:', this.isCreatingGame);
      if (this.isCreatingGame) {
        console.log('Sending create_game message');
        this.sendMessage({
          type: 'create_game',
          gameCode: this.gameCode,
          playerId: this.playerId
        });
      } else {
        console.log('Sending join_game message');
        this.sendMessage({
          type: 'join_game',
          gameCode: this.gameCode,
          playerId: this.playerId
        });
      }
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.showMessage('Connection lost. Please refresh to reconnect.');
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.showMessage('Connection error. Please try again.');
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'game_created':
        this.showGameCreated(data.gameCode);
        this.elements.gameCodeDisplay.textContent = `Game: ${data.gameCode}`;
        break;
        
      case 'player_joined':
        this.showMessage('Opponent joined! Starting game...');
        this.switchToGameView();
        break;
        
      case 'new_hand':
        this.handleNewHand(data);
        break;
        
      case 'game_state':
        this.updateGameState(data);
        break;
        
      case 'hole_cards_dealt':
        this.updateHoleCards(data);
        break;
        
      case 'community_cards':
        this.updateCommunityCards(data);
        break;
        
      case 'player_action':
        this.showGameMessage(`${data.playerId} ${data.action}${data.amount ? ' $' + data.amount : ''}`);
        break;
        
      case 'hand_winner':
        this.showGameMessage(`${data.winnerId} wins $${data.potAmount}!`);
        break;
        
      case 'game_over':
        this.showGameMessage(`Game Over! Winner: ${data.winnerId}`);
        break;
        
      case 'error':
        this.showMessage('Error: ' + data.message);
        break;
    }
  }

  updateGameState(data) {
    this.gameState = data;
    
    this.elements.potDisplay.textContent = `Pot: $${data.pot || 0}`;
    this.elements.phaseDisplay.textContent = `Phase: ${data.phase || 'Waiting'}`;
    
    if (data.players && data.players.length === 2) {
      const playerData = data.players.find(p => p.id === this.playerId);
      const opponentData = data.players.find(p => p.id !== this.playerId);
      
      if (playerData) {
        this.elements.playerChips.textContent = `$${playerData.chips}`;
        this.elements.playerBet.textContent = `$${playerData.currentBet || 0}`;
        this.playerIndex = data.players.indexOf(playerData);
        console.log(`CLIENT DEBUG: playerId=${this.playerId}, playerIndex=${this.playerIndex}, currentPlayer=${data.currentPlayer}, dealerIndex=${data.dealerIndex}`);
      }
      
      if (opponentData) {
        this.elements.opponentChips.textContent = `$${opponentData.chips}`;
        this.elements.opponentBet.textContent = `$${opponentData.currentBet || 0}`;
      }
    }
    
    this.updateActionButtons(data);
    this.updateSliderRange();
  }

  handleNewHand(data) {
    this.clearCards();
    this.showGameMessage(`Hand #${data.handNumber} - Dealer: ${data.dealerIndex === this.playerIndex ? 'You' : 'Opponent'}`);
    this.elements.phaseDisplay.textContent = 'Phase: Pre-flop';
    this.elements.potDisplay.textContent = 'Pot: $0';
    this.elements.playerBet.textContent = '$0';
    this.elements.opponentBet.textContent = '$0';
  }

  clearCards() {
    this.elements.holeCard1.innerHTML = '';
    this.elements.holeCard1.className = 'card card-back';
    this.elements.holeCard2.innerHTML = '';
    this.elements.holeCard2.className = 'card card-back';
    
    this.elements.communityCards.forEach(card => {
      card.innerHTML = '';
      card.className = 'card community-card';
    });
  }

  updateHoleCards(data) {
    const playerData = data.players.find(p => p.id === this.playerId);
    if (playerData && playerData.holeCards) {
      this.displayCard(this.elements.holeCard1, playerData.holeCards[0]);
      this.displayCard(this.elements.holeCard2, playerData.holeCards[1]);
    }
  }

  updateCommunityCards(data) {
    if (data.cards) {
      data.cards.forEach((card, index) => {
        if (index < this.elements.communityCards.length) {
          this.displayCard(this.elements.communityCards[index], card);
        }
      });
    }
  }

  displayCard(element, card) {
    if (!card) return;
    
    element.classList.remove('card-back');
    element.innerHTML = `
      <div class="rank">${card.rank}</div>
      <div class="suit">${this.getSuitSymbol(card.suit)}</div>
    `;
    
    if (card.suit === 'H' || card.suit === 'D') {
      element.classList.add('hearts');
    } else {
      element.classList.add('spades');
    }
  }

  getSuitSymbol(suit) {
    const symbols = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    return symbols[suit] || suit;
  }

  updateActionButtons(data) {
    const isMyTurn = data.currentPlayer === this.playerIndex;
    const playerData = data.players?.find(p => p.id === this.playerId);
    
    if (!playerData) return;
    
    const canAct = isMyTurn && playerData.isActive && !playerData.isAllIn;
    const callAmount = this.getCallAmount(data);
    const canCheck = canAct && callAmount === 0;
    const canCall = canAct && callAmount > 0;
    
    this.elements.foldBtn.disabled = !canAct;
    this.elements.checkBtn.disabled = !canCheck;
    this.elements.callBtn.disabled = !canCall;
    this.elements.betBtn.disabled = !canAct;
    this.elements.raiseBtn.disabled = !canAct;
    this.elements.allInBtn.disabled = !canAct;
    
    if (canAct) {
      if (canCall) {
        this.elements.callBtn.textContent = `Call $${callAmount}`;
      } else {
        this.elements.callBtn.textContent = 'Call';
      }
      
      this.elements.betInput.max = playerData.chips;
    }
  }

  getCallAmount(data) {
    const playerData = data.players.find(p => p.id === this.playerId);
    if (!playerData) return 0;
    
    const maxBet = Math.max(...data.players.map(p => p.currentBet || 0));
    return Math.max(0, maxBet - (playerData.currentBet || 0));
  }

  getBetAmount() {
    return parseInt(this.elements.betInput.value) || 0;
  }

  setHalfPot() {
    const pot = this.gameState?.pot || 0;
    const halfPot = Math.floor(pot / 2);
    this.elements.betInput.value = halfPot;
    this.updateBetAmount();
    
    // Determine if this is a bet or raise
    const callAmount = this.getCallAmount(this.gameState);
    if (callAmount > 0) {
      this.sendAction('raise', halfPot);
    } else {
      this.sendAction('bet', halfPot);
    }
  }

  setFullPot() {
    const pot = this.gameState?.pot || 0;
    this.elements.betInput.value = pot;
    this.updateBetAmount();
    
    // Determine if this is a bet or raise
    const callAmount = this.getCallAmount(this.gameState);
    if (callAmount > 0) {
      this.sendAction('raise', pot);
    } else {
      this.sendAction('bet', pot);
    }
  }

  updateBetFromSlider() {
    this.elements.betInput.value = this.elements.betSlider.value;
    this.updateBetAmount();
  }

  updateBetAmount() {
    this.elements.betAmountDisplay.textContent = `$${this.getBetAmount()}`;
  }

  updateSliderRange() {
    const pot = this.gameState?.pot || 200; // Default to 200 if no pot yet
    const halfPot = Math.floor(pot / 2);
    const maxSlider = Math.max(halfPot, 100); // Minimum range of 100
    
    this.elements.betSlider.max = maxSlider;
    
    // Update the slider label
    const sliderLabels = document.querySelector('.slider-labels');
    if (sliderLabels) {
      sliderLabels.innerHTML = `
        <span>$50</span>
        <span>$${halfPot} (1/2 Pot)</span>
      `;
    }
  }

  sendAction(action, amount = null) {
    const message = {
      type: 'player_action',
      action: action
    };
    
    if (amount !== null) {
      message.amount = amount;
    }
    
    this.sendMessage(message);
  }

  resign() {
    if (confirm('Are you sure you want to resign?')) {
      this.sendMessage({ type: 'resign' });
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  switchToGameView() {
    this.elements.lobby.classList.add('hidden');
    this.elements.game.classList.remove('hidden');
  }

  showGameCreated(gameCode) {
    this.elements.lobbyMessage.textContent = 'Waiting for opponent...';
    this.elements.createdGameCode.textContent = gameCode;
    this.elements.copyCodeSection.classList.remove('hidden');
  }

  copyGameCode() {
    const gameCode = this.gameCode;
    if (gameCode) {
      navigator.clipboard.writeText(gameCode).then(() => {
        const originalText = this.elements.copyCodeBtn.textContent;
        this.elements.copyCodeBtn.textContent = 'Copied!';
        this.elements.copyCodeBtn.classList.add('btn-info');
        this.elements.copyCodeBtn.classList.remove('btn-success');
        
        setTimeout(() => {
          this.elements.copyCodeBtn.textContent = originalText;
          this.elements.copyCodeBtn.classList.remove('btn-info');
          this.elements.copyCodeBtn.classList.add('btn-success');
        }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = gameCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        this.elements.copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => {
          this.elements.copyCodeBtn.textContent = 'Copy Code';
        }, 2000);
      });
    }
  }

  showMessage(message) {
    this.elements.lobbyMessage.textContent = message;
  }

  showGameMessage(message) {
    this.elements.gameMessages.innerHTML += `<div>${message}</div>`;
    this.elements.gameMessages.scrollTop = this.elements.gameMessages.scrollHeight;
  }

  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substring(2, 9);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new HeadsUpHoldemClient();
});