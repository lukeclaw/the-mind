/**
 * The Mind - Multiplayer Game Server
 * Handles room management and real-time game synchronization
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];

// Add Vercel preview deployments if needed (optional)
// You can also just set origin: "*" for testing, but that's less secure

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            // Allow any Vercel deployment if you want (easier for previews)
            if (origin.endsWith('.vercel.app')) {
                return callback(null, true);
            }

            if (allowedOrigins.indexOf(origin) !== -1 || origin === clientUrl) {
                callback(null, true);
            } else {
                // Fallback: just allow it for now to fix your issue
                console.log('Allowing unknown origin:', origin);
                callback(null, true);
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: true, // Reflects the request origin
    credentials: true
}));
app.use(express.json());

// Store active rooms
const rooms = new Map();

/**
 * Generate a short room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * Get room by code
 */
function getRoom(code) {
    return rooms.get(code.toUpperCase());
}

// REST endpoint to check room status
app.get('/api/room/:code', (req, res) => {
    const room = getRoom(req.params.code);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
        code: room.code,
        playerCount: room.players.length,
        maxPlayers: 4,
        status: room.game ? room.game.status : 'lobby'
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    let currentRoom = null;
    let playerName = null;

    /**
     * Create a new room
     */
    socket.on('createRoom', ({ name }, callback) => {
        const code = generateRoomCode();
        const playerId = socket.id;

        const room = {
            code,
            host: playerId,
            players: [{ id: playerId, name, connected: true }],
            game: null
        };

        rooms.set(code, room);
        socket.join(code);
        currentRoom = code;
        playerName = name;

        console.log(`Room ${code} created by ${name}`);

        callback({
            success: true,
            code,
            players: room.players,
            isHost: true
        });
    });

    /**
     * Join an existing room
     */
    socket.on('joinRoom', ({ code, name }, callback) => {
        const room = getRoom(code);

        if (!room) {
            return callback({ success: false, error: 'Room not found' });
        }

        if (room.game && room.game.status !== 'lobby') {
            return callback({ success: false, error: 'Game already in progress' });
        }

        if (room.players.length >= 4) {
            return callback({ success: false, error: 'Room is full (max 4 players)' });
        }

        const playerId = socket.id;
        room.players.push({ id: playerId, name, connected: true });

        socket.join(code);
        currentRoom = code;
        playerName = name;

        console.log(`${name} joined room ${code}`);

        // Notify other players
        socket.to(code).emit('playerJoined', {
            id: playerId,
            name,
            players: room.players
        });

        callback({
            success: true,
            code,
            players: room.players,
            isHost: room.host === playerId
        });
    });

    /**
     * Start the game (host only)
     */
    socket.on('startGame', (_, callback) => {
        const room = getRoom(currentRoom);

        if (!room) {
            return callback({ success: false, error: 'Room not found' });
        }

        if (room.host !== socket.id) {
            return callback({ success: false, error: 'Only host can start game' });
        }

        if (room.players.length < 2) {
            return callback({ success: false, error: 'Need at least 2 players' });
        }

        // Create and initialize game
        room.game = gameLogic.createGame(room.players);
        gameLogic.dealCards(room.game);

        console.log(`Game started in room ${currentRoom}`);

        // Send personalized game state to each player
        room.players.forEach(player => {
            const playerView = gameLogic.getPlayerView(room.game, player.id);
            io.to(player.id).emit('gameStarted', playerView);
        });

        callback({ success: true });
    });

    /**
     * Play a card
     */
    socket.on('playCard', ({ cardValue }, callback) => {
        const room = getRoom(currentRoom);

        if (!room || !room.game) {
            return callback({ success: false, error: 'No active game' });
        }

        if (room.game.status !== 'playing') {
            return callback({ success: false, error: 'Game not in playing state' });
        }

        const result = gameLogic.playCard(room.game, socket.id, cardValue);

        if (!result.success) {
            return callback(result);
        }

        const player = room.game.players.find(p => p.id === socket.id);
        console.log(`${player.name} played ${cardValue} in room ${currentRoom}`);

        // Broadcast card played to all players
        room.players.forEach(p => {
            const playerView = gameLogic.getPlayerView(room.game, p.id);
            io.to(p.id).emit('cardPlayed', {
                playerId: socket.id,
                playerName: player.name,
                cardValue,
                penalties: result.penalties,
                gameState: playerView
            });
        });

        // Handle level complete
        if (result.levelComplete) {
            io.to(currentRoom).emit('levelComplete', {
                level: room.game.currentLevel
            });
        }

        // Handle game over
        if (result.gameOver) {
            io.to(currentRoom).emit('gameOver', {
                reason: 'No lives remaining'
            });
        }

        callback({ success: true });
    });

    /**
     * Request next level
     */
    socket.on('nextLevel', (_, callback) => {
        const room = getRoom(currentRoom);

        if (!room || !room.game) {
            return callback({ success: false, error: 'No active game' });
        }

        if (room.game.status !== 'levelComplete') {
            return callback({ success: false, error: 'Level not complete' });
        }

        const result = gameLogic.nextLevel(room.game);

        console.log(`Level ${room.game.currentLevel} started in room ${currentRoom}`);

        if (result.victory) {
            io.to(currentRoom).emit('victory', {
                finalLevel: room.game.maxLevels
            });
        } else {
            // Send updated game state to all players
            room.players.forEach(p => {
                const playerView = gameLogic.getPlayerView(room.game, p.id);
                io.to(p.id).emit('newLevel', playerView);
            });
        }

        callback({ success: true });
    });

    /**
     * Vote for throwing star
     */
    socket.on('voteThrowingStar', (_, callback) => {
        const room = getRoom(currentRoom);

        if (!room || !room.game) {
            return callback({ success: false, error: 'No active game' });
        }

        const result = gameLogic.voteThrowingStar(room.game, socket.id);

        if (!result.success) {
            return callback(result);
        }

        if (result.waiting) {
            // Broadcast vote status
            io.to(currentRoom).emit('starVoteUpdate', {
                votes: result.votes,
                needed: result.needed,
                voters: Array.from(room.game.starVotes)
            });
        } else {
            // Star was used - broadcast result
            room.players.forEach(p => {
                const playerView = gameLogic.getPlayerView(room.game, p.id);
                io.to(p.id).emit('throwingStarUsed', {
                    discarded: result.discarded,
                    gameState: playerView,
                    levelComplete: result.levelComplete
                });
            });
        }

        callback({ success: true });
    });

    /**
     * Cancel throwing star vote
     */
    socket.on('cancelStarVote', (_, callback) => {
        const room = getRoom(currentRoom);

        if (!room || !room.game) {
            return callback({ success: false, error: 'No active game' });
        }

        gameLogic.cancelStarVote(room.game, socket.id);

        io.to(currentRoom).emit('starVoteUpdate', {
            votes: room.game.starVotes.size,
            needed: room.game.players.length,
            voters: Array.from(room.game.starVotes)
        });

        callback({ success: true });
    });

    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (currentRoom) {
            const room = getRoom(currentRoom);
            if (room) {
                // Mark player as disconnected
                const player = room.players.find(p => p.id === socket.id);
                if (player) {
                    player.connected = false;

                    // Update game state if in progress
                    if (room.game) {
                        const gamePlayer = room.game.players.find(p => p.id === socket.id);
                        if (gamePlayer) {
                            gamePlayer.connected = false;
                        }
                    }

                    io.to(currentRoom).emit('playerDisconnected', {
                        id: socket.id,
                        name: player.name
                    });
                }

                // If all players disconnected, clean up room after delay
                const allDisconnected = room.players.every(p => !p.connected);
                if (allDisconnected) {
                    setTimeout(() => {
                        const currentPlayerStatus = room.players.every(p => !p.connected);
                        if (currentPlayerStatus) {
                            rooms.delete(currentRoom);
                            console.log(`Room ${currentRoom} deleted (all players left)`);
                        }
                    }, 30000); // 30 second grace period
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`The Mind server running on port ${PORT}`);
    console.log(`Accepting connections from: ${clientUrl}`);
});
