# Heads-Up Hold'em

A two-player, no-limit Texas Hold'em poker game built with Node.js, WebSockets, and vanilla JavaScript.

## Features

- **Two-Player Heads-Up**: Exactly two players per game
- **No-Limit Betting**: Players can bet any amount up to their chip stack
- **WebSocket Multiplayer**: Real-time multiplayer using WebSockets
- **Random Game Codes**: Join games using 6-character alphanumeric codes
- **Complete Poker Logic**: Full hand evaluation and betting rounds
- **Responsive UI**: Works on desktop and mobile devices

## Game Rules

### Setup
- Each player starts with 20,000 chips
- Small blind: $50, Big blind: $100
- Standard 52-card deck, shuffled each hand

### Gameplay
1. **Blinds**: Dealer posts small blind, opponent posts big blind
2. **Hole Cards**: Two cards dealt face-down to each player
3. **Betting Rounds**: Pre-flop, Flop, Turn, River
4. **Actions**: Fold, Check, Call, Bet, Raise, All-In
5. **Showdown**: Best 5-card hand wins the pot
6. **Game End**: Player with all chips wins

### Hand Rankings (Highest to Lowest)
- Royal Flush
- Straight Flush
- Four of a Kind
- Full House
- Flush
- Straight
- Three of a Kind
- Two Pair
- One Pair
- High Card

## Installation

### Option 1: Local Development
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Option 2: Docker Deployment
1. Clone the repository
2. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

## Usage

### Local Development
```bash
npm start
```

### Docker Deployment
```bash
docker build -t heads-up-holdem .
docker run -p 3000:3000 heads-up-holdem
```

The server will start on port 3000 (or the port specified in the PORT environment variable).

### Access the Game
Open your browser and go to `http://localhost:3000`

### Creating a Game
1. Click "Create Game" to generate a random game code
2. Share the game code with another player
3. Wait for them to join

### Joining a Game
1. Enter the 6-character game code
2. Click "Join Game"
3. The game will start automatically once both players are connected

## Development

### Start with auto-reload
```bash
npm run dev
```

### Project Structure
```
heads-up-holdem/
├── server/
│   ├── index.js          # Main server file
│   ├── gameManager.js    # Manages game sessions
│   ├── gameSession.js    # Individual game logic
│   ├── handEvaluator.js  # Poker hand evaluation
│   └── utils.js          # Utility functions
├── public/
│   ├── index.html        # Main HTML file
│   ├── style.css         # CSS styles
│   └── app.js            # Client-side JavaScript
└── package.json
```

### Server Components

- **GameManager**: Handles WebSocket connections and routes messages
- **GameSession**: Manages individual game state and logic
- **HandEvaluator**: Evaluates poker hands and determines winners
- **Utils**: Generates game codes and shuffles cards

### Client Components

- **HeadsUpHoldemClient**: Main client-side game controller
- **WebSocket Communication**: Real-time game updates
- **UI Management**: Game interface and user interactions

## WebSocket Messages

### Client to Server
- `create_game`: Create a new game session
- `join_game`: Join an existing game
- `player_action`: Send betting actions (fold, check, call, bet, raise, all_in)
- `resign`: Resign from the game

### Server to Client
- `game_created`: Confirmation of game creation
- `player_joined`: Notification when opponent joins
- `game_state`: Current game state update
- `hole_cards_dealt`: Player's hole cards
- `community_cards`: Community cards (flop, turn, river)
- `player_action`: Opponent's action
- `hand_winner`: Hand result
- `game_over`: Game conclusion
- `error`: Error messages

## Security Features

- Input validation on all user actions
- Server-side game state management
- WebSocket message sanitization
- Secure card dealing and shuffling

## License

MIT License