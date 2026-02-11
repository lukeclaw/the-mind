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
const blackjackLogic = require('./blackjackLogic');
const minimalistLogic = require('./minimalistLogic');
const estimatorEngine = require('./estimatorEngine');

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
            callback(null, true);
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

app.get('/health', (_, res) => {
    res.status(200).json({ ok: true });
});

// Store active rooms
const rooms = new Map();
const calibrationRuns = [];

function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function sanitizeEstimatorRequest(body) {
    const payload = body || {};
    const workload = payload.workload || {};

    return {
        ...payload,
        model_id: typeof payload.model_id === 'string' ? payload.model_id : undefined,
        runtime_id: typeof payload.runtime_id === 'string' ? payload.runtime_id : undefined,
        quant_id: typeof payload.quant_id === 'string' ? payload.quant_id : undefined,
        objective: typeof payload.objective === 'string' ? payload.objective : undefined,
        contextLength: safeNumber(payload.contextLength, undefined),
        concurrentUsers: safeNumber(payload.concurrentUsers, undefined),
        kvCacheBytes: safeNumber(payload.kvCacheBytes, undefined),
        gpuCount: safeNumber(payload.gpuCount, undefined),
        vramPerGpuGb: safeNumber(payload.vramPerGpuGb, undefined),
        gpuMemoryBandwidth: safeNumber(payload.gpuMemoryBandwidth, undefined),
        gpuFp16Tflops: safeNumber(payload.gpuFp16Tflops, undefined),
        cpuCores: safeNumber(payload.cpuCores, undefined),
        cpuMemoryBandwidth: safeNumber(payload.cpuMemoryBandwidth, undefined),
        systemRamGb: safeNumber(payload.systemRamGb, undefined),
        pcieGen: safeNumber(payload.pcieGen, undefined),
        pcieLanes: safeNumber(payload.pcieLanes, undefined),
        nvlinkBandwidth: safeNumber(payload.nvlinkBandwidth, undefined),
        efficiencyTarget: safeNumber(payload.efficiencyTarget, undefined),
        workload: {
            context_tokens: safeNumber(workload.context_tokens, undefined),
            output_tokens: safeNumber(workload.output_tokens, undefined),
            concurrency: safeNumber(workload.concurrency, undefined)
        }
    };
}

function validateCalibrationPayload(payload) {
    if (!payload || typeof payload !== 'object') return 'Payload must be an object.';
    if (payload.model_id && typeof payload.model_id !== 'string') return 'model_id must be a string.';
    if (payload.runtime_id && typeof payload.runtime_id !== 'string') return 'runtime_id must be a string.';
    if (payload.quant_id && typeof payload.quant_id !== 'string') return 'quant_id must be a string.';

    const serialized = JSON.stringify(payload);
    if (serialized.length > 1024 * 1024) return 'Calibration payload exceeds 1MB limit.';

    return null;
}

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
 * Normalize user-provided display names so client rendering stays stable.
 */
function sanitizePlayerName(rawName) {
    if (typeof rawName !== 'string') return '';
    return rawName.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function sanitizeRoomCode(rawCode) {
    if (typeof rawCode !== 'string') return '';
    return rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/**
 * Get room by code
 */
function getRoom(code) {
    const normalizedCode = sanitizeRoomCode(code);
    if (!normalizedCode) return null;
    return rooms.get(normalizedCode);
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
        gameType: room.gameType || 'the-mind',
        status: room.game ? room.game.status : 'lobby'
    });
});

// ================= ESTIMATOR V2 API =================

app.get('/api/estimator/v1/catalog/models', (_, res) => {
    res.json({ items: estimatorEngine.MODEL_CATALOG });
});

app.get('/api/estimator/v1/catalog/runtimes', (_, res) => {
    res.json({ items: estimatorEngine.RUNTIME_CATALOG });
});

app.get('/api/estimator/v1/catalog/quantizations', (_, res) => {
    res.json({ items: estimatorEngine.QUANT_CATALOG });
});

app.get('/api/estimator/v1/catalog/hardware-profiles', (_, res) => {
    const items = Object.entries(estimatorEngine.GPU_PRESETS).map(([id, spec]) => ({
        id,
        label: id,
        spec
    }));
    res.json({ items });
});

app.post('/api/estimator/v1/estimate', (req, res) => {
    try {
        const sanitized = sanitizeEstimatorRequest(req.body);
        const inputs = estimatorEngine.mergeEstimateInputs(sanitized);
        const scenario = estimatorEngine.estimateScenario(inputs.modelId, inputs);
        const envelope = estimatorEngine.estimateModelEnvelope(inputs);
        const recommendations = estimatorEngine.recommendConfigs(inputs);
        const minimumBuild = estimatorEngine.recommendMinimumBuild(inputs);

        const bottlenecks = scenario.bottlenecks.map((code) => ({
            code,
            label: estimatorEngine.bottleneckLabel(code)
        }));

        const explanations = [];
        if (scenario.feasibilityCode === 'with_offload') {
            explanations.push(`Model exceeds pure VRAM envelope by ${scenario.memory.offloadGb.toFixed(1)} GB, causing host offload.`);
        }
        if (bottlenecks.some((item) => item.code === 'pcie_bandwidth')) {
            explanations.push('PCIe throughput limits sustained decode under current concurrency.');
        }
        if (explanations.length === 0) {
            explanations.push('Current estimate is memory-path efficient for the selected scenario.');
        }

        res.json({
            feasibility: scenario.feasibilityCode,
            feasibilityLabel: estimatorEngine.feasibilityLabel(scenario.feasibilityCode),
            estimates: {
                decode_toks_sec: scenario.throughput.decode,
                prefill_toks_sec: scenario.throughput.prefill,
                ttft_ms: scenario.latency.ttftMs,
                memory_gb: scenario.memory
            },
            bottlenecks,
            recommended_configs: recommendations,
            minimum_build: minimumBuild,
            envelope: envelope.map((row) => ({
                model_id: row.model.id,
                model: row.model.label,
                feasibility: row.feasibilityCode,
                decode_p50: row.throughput.decode.p50,
                memory_p50: row.memory.p50
            })),
            diagnostics: scenario.diagnostics,
            explanations
        });
    } catch (error) {
        console.error('Estimator error:', error);
        res.status(400).json({ error: 'Failed to estimate scenario', details: error.message });
    }
});

app.post('/api/estimator/v1/calibrate', (req, res) => {
    const payload = req.body || {};
    const validationError = validateCalibrationPayload(payload);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const run = {
        id: uuidv4(),
        receivedAt: new Date().toISOString(),
        payload
    };

    calibrationRuns.push(run);
    if (calibrationRuns.length > 2000) calibrationRuns.shift();

    res.status(202).json({
        success: true,
        calibration_run_id: run.id,
        queue_size: calibrationRuns.length
    });
});

app.get('/api/estimator/v1/calibrate', (_, res) => {
    res.json({
        queue_size: calibrationRuns.length,
        latest: calibrationRuns.slice(-10).map((run) => ({
            id: run.id,
            receivedAt: run.receivedAt
        }))
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    let currentRoom = null;
    let playerName = null;

    function emitPlayerList(room) {
        io.to(room.code).emit('playerJoined', {
            id: null,
            name: null,
            players: room.players
        });
    }

    function transferHostIfNeeded(room, previousHostId) {
        if (room.host !== previousHostId) return;
        const nextHost = room.players.find(p => p.connected) || room.players[0];
        if (!nextHost) return;
        room.host = nextHost.id;
        io.to(room.code).emit('hostChanged', { hostId: room.host });
    }

    function broadcastBlackjackUpdate(room, lastAction, options = {}) {
        const { maskDealerTurnStatus = false } = options;
        room.players
            .filter(p => p.connected)
            .forEach((p) => {
                const view = blackjackLogic.getPlayerView(room.game, p.id);
                if (maskDealerTurnStatus) {
                    view.status = 'dealerTurn';
                }
                io.to(p.id).emit('blackjackUpdate', { gameState: view, lastAction });
            });
    }

    function startBlackjackDealerTurn(room) {
        if (!room?.game || room.gameType !== 'blackjack' || room.game.status !== 'dealerTurn') {
            return;
        }
        if (room.blackjackDealerTurnRunning) return;
        room.blackjackDealerTurnRunning = true;

        const reveal = blackjackLogic.revealDealer(room.game);

        if (reveal.finished) {
            broadcastBlackjackUpdate(room, { action: 'dealerReveal' }, { maskDealerTurnStatus: true });
            setTimeout(() => {
                room.blackjackDealerTurnRunning = false;
                broadcastBlackjackUpdate(room, { action: 'roundOver' });
            }, 4000);
            return;
        }

        broadcastBlackjackUpdate(room, { action: 'dealerReveal' });

        const dealerLoop = setInterval(() => {
            const step = blackjackLogic.dealerStep(room.game);
            if (step.finished) {
                clearInterval(dealerLoop);
                broadcastBlackjackUpdate(room, { action: 'dealerHit' }, { maskDealerTurnStatus: true });
                setTimeout(() => {
                    room.blackjackDealerTurnRunning = false;
                    broadcastBlackjackUpdate(room, { action: 'roundOver' });
                }, 4000);
            } else {
                broadcastBlackjackUpdate(room, { action: 'dealerHit' });
            }
        }, 1000);
    }

    /**
     * Create a new room
     */
    socket.on('createRoom', ({ name, gameType = 'the-mind' }, callback) => {
        const sanitizedName = sanitizePlayerName(name);
        if (!sanitizedName) {
            return callback({ success: false, error: 'Name is required' });
        }

        const code = generateRoomCode();
        const playerId = socket.id;

        // Check valid game type
        if (!['the-mind', 'blackjack', 'minimalist', '3d-platform'].includes(gameType)) {
            gameType = 'the-mind';
        }

        const room = {
            code,
            host: playerId,
            gameType,
            players: [{ id: playerId, name: sanitizedName, connected: true }],
            game: null
        };

        rooms.set(code, room);
        socket.join(code);
        currentRoom = code;
        playerName = sanitizedName;

        console.log(`Room ${code} created by ${sanitizedName}`);

        callback({
            success: true,
            code,
            players: room.players,
            isHost: true,
            gameType
        });
    });

    /**
     * Join an existing room
     */
    socket.on('joinRoom', ({ code, name }, callback) => {
        const sanitizedName = sanitizePlayerName(name);
        if (!sanitizedName) {
            return callback({ success: false, error: 'Name is required to join a room' });
        }
        const sanitizedCode = sanitizeRoomCode(code);
        if (!sanitizedCode || sanitizedCode.length !== 6) {
            return callback({ success: false, error: 'Invalid room code' });
        }

        const room = getRoom(sanitizedCode);

        if (!room) {
            return callback({ success: false, error: 'Room not found' });
        }

        const normalizedName = sanitizedName.toLowerCase();
        const reconnectingPlayer = room.players.find(
            (p) => !p.connected && p.name.toLowerCase() === normalizedName
        );
        const isGameInProgress = !!(room.game && room.game.status !== 'lobby' && room.game.status !== 'waiting');

        if (isGameInProgress && !reconnectingPlayer) {
            return callback({ success: false, error: 'Game already in progress' });
        }

        if (!reconnectingPlayer) {
            const connectedCount = room.players.filter(p => p.connected).length;
            if (connectedCount >= 4) {
                return callback({ success: false, error: 'Room is full (max 4 players)' });
            }
        }

        const playerId = socket.id;
        if (reconnectingPlayer) {
            const previousPlayerId = reconnectingPlayer.id;
            reconnectingPlayer.id = playerId;
            reconnectingPlayer.connected = true;

            if (room.host === previousPlayerId) {
                room.host = playerId;
            }

            if (room.game) {
                if (room.gameType === 'blackjack') {
                    blackjackLogic.reconnectPlayer(room.game, previousPlayerId, playerId);
                } else {
                    const gamePlayer = room.game.players.find(p => p.id === previousPlayerId);
                    if (gamePlayer) {
                        gamePlayer.id = playerId;
                        gamePlayer.connected = true;
                        gamePlayer.name = reconnectingPlayer.name;
                    }
                }
            }
        } else {
            room.players.push({ id: playerId, name: sanitizedName, connected: true });
        }

        socket.join(sanitizedCode);
        currentRoom = sanitizedCode;
        playerName = sanitizedName;

        console.log(`${sanitizedName} joined room ${sanitizedCode}`);

        // Notify other players
        emitPlayerList(room);
        io.to(sanitizedCode).emit('hostChanged', { hostId: room.host });

        callback({
            success: true,
            code: sanitizedCode,
            gameType: room.gameType,
            players: room.players,
            isHost: room.host === playerId
        });

        if (room.game) {
            if (room.gameType === 'blackjack') {
                io.to(playerId).emit('gameStarted', blackjackLogic.getPlayerView(room.game, playerId));
            } else if (room.gameType === 'minimalist') {
                io.to(playerId).emit('gameStarted', minimalistLogic.getPlayerView(room.game, playerId));
            } else if (room.gameType === 'the-mind') {
                io.to(playerId).emit('gameStarted', gameLogic.getPlayerView(room.game, playerId));
            } else if (room.gameType === '3d-platform') {
                io.to(playerId).emit('gameStarted', room.game);
            }
        }
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

        if (room.gameType === 'the-mind' && room.players.length < 2) {
            return callback({ success: false, error: 'Need at least 2 players' });
        }

        if (room.gameType === 'the-mind') {
            // Create and initialize game
            room.game = gameLogic.createGame(room.players);
            gameLogic.dealCards(room.game);

            // Send personalized game state to each player
            room.players.forEach(player => {
                const playerView = gameLogic.getPlayerView(room.game, player.id);
                io.to(player.id).emit('gameStarted', playerView);
            });
        } else if (room.gameType === 'blackjack') {
            room.game = blackjackLogic.createGame(room.players);

            // Send personalized game state
            room.players.forEach(player => {
                const playerView = blackjackLogic.getPlayerView(room.game, player.id);
                io.to(player.id).emit('gameStarted', playerView);
            });
        } else if (room.gameType === 'minimalist') {
            room.game = minimalistLogic.createGame(room.players);

            if (room.players.length === 1) {
                minimalistLogic.startSandbox(room.game);
            } else {
                minimalistLogic.startRound(room.game);
            }

            room.players.forEach(player => {
                const playerView = minimalistLogic.getPlayerView(room.game, player.id);
                io.to(player.id).emit('gameStarted', playerView);
            });
        } else if (room.gameType === '3d-platform') {
            room.game = {
                status: 'playing',
                mode: '3d-platform',
                players: room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })),
                startedAt: Date.now()
            };

            room.players.forEach(player => {
                io.to(player.id).emit('gameStarted', room.game);
            });
        }

        console.log(`Game (${room.gameType}) started in room ${currentRoom}`);
        callback({ success: true });
    });

    // ================= BLACKJACK EVENTS =================

    socket.on('blackjackAction', ({ action, amount }, callback) => {
        const room = getRoom(currentRoom);
        if (!room || !room.game || room.gameType !== 'blackjack') return callback({ success: false, error: 'Invalid game' });

        let result;
        if (action === 'hit') {
            result = blackjackLogic.hit(room.game, socket.id);
        } else if (action === 'stand') {
            result = blackjackLogic.stand(room.game, socket.id);
        } else if (action === 'double') {
            result = blackjackLogic.doubleDown(room.game, socket.id);
        } else if (action === 'split') {
            result = blackjackLogic.split(room.game, socket.id);
        } else if (action === 'surrender') {
            result = blackjackLogic.surrender(room.game, socket.id);
        } else if (action === 'insurance') {
            result = blackjackLogic.insurance(room.game, socket.id, amount);
        } else {
            return callback({ success: false, error: 'Invalid action' });
        }

        if (!result.success) return callback(result);

        // Broadcast update for the player's action
        broadcastBlackjackUpdate(room, { playerId: socket.id, action });

        // If turn passed to dealer, start dealer sequence.
        if (room.game.status === 'dealerTurn') {
            startBlackjackDealerTurn(room);
        } else if (room.game.status === 'roundOver') {
            // Insurance dealer blackjack or immediate terminal states.
            broadcastBlackjackUpdate(room, { action: 'roundOver' });
        }

        callback({ success: true });
    });

    socket.on('blackjackVoteNextHand', (_, callback) => {
        const room = getRoom(currentRoom);
        if (!room || !room.game || room.gameType !== 'blackjack') return callback({ success: false });

        const result = blackjackLogic.voteNextHand(room.game, socket.id);
        if (!result.success) return callback(result);

        if (result.bettingStarted) {
            // Betting phase started
            broadcastBlackjackUpdate(room, { action: 'bettingPhase' });
        } else {
            // Vote registered
            broadcastBlackjackUpdate(room, { action: 'vote', playerId: socket.id });
        }

        callback({ success: true });
    });

    socket.on('blackjackPlaceBet', ({ amount }, callback) => {
        const room = getRoom(currentRoom);
        if (!room || !room.game || room.gameType !== 'blackjack') return callback({ success: false, error: 'Invalid game' });

        const result = blackjackLogic.placeBet(room.game, socket.id, amount);
        if (!result.success) return callback(result);

        if (result.gameStarted) {
            // Everyone bet, cards dealt
            broadcastBlackjackUpdate(room, { action: 'deal' });
            if (room.game.status === 'dealerTurn') {
                startBlackjackDealerTurn(room);
            }
        } else {
            // Bet placed
            broadcastBlackjackUpdate(room, { action: 'bet', playerId: socket.id });
        }
        callback({ success: true });
    });

    socket.on('blackjackBegForMoney', ({ message }, callback) => {
        const room = getRoom(currentRoom);
        if (!room || !room.game || room.gameType !== 'blackjack') return callback({ success: false, error: 'Invalid game' });

        const result = blackjackLogic.begForMoney(room.game, socket.id, message);
        if (!result.success) return callback(result);

        // Update view
        io.to(socket.id).emit('blackjackUpdate', {
            gameState: blackjackLogic.getPlayerView(room.game, socket.id),
            lastAction: { action: 'refill' }
        });

        callback({ success: true });
    });

    // ================= MINIMALIST MASTERPIECE EVENTS =================

    socket.on('minimalistSubmitScore', ({ inkUsed }, callback) => {
        const room = getRoom(currentRoom);
        if (!room || !room.game || room.gameType !== 'minimalist') return callback({ success: false });

        const result = minimalistLogic.submitScore(room.game, socket.id, inkUsed);

        if (result.success) {
            // Notify everyone that a player finished
            room.players.forEach(p => {
                io.to(p.id).emit('minimalistUpdate', {
                    gameState: minimalistLogic.getPlayerView(room.game, p.id),
                    lastAction: { action: 'playerFinished', playerId: socket.id }
                });
            });

            if (result.roundOver) {
                const endResult = minimalistLogic.endRound(room.game);

                // Broadcast round over and rankings
                room.players.forEach(p => {
                    io.to(p.id).emit('minimalistUpdate', {
                        gameState: minimalistLogic.getPlayerView(room.game, p.id),
                        lastAction: {
                            action: 'roundOver',
                            rankings: endResult.rankings
                        }
                    });
                });

                // Auto start next round after delay
                if (room.game.currentRound < room.game.maxRounds) {
                    setTimeout(() => {
                        if (rooms.has(currentRoom)) { // Ensure room still exists
                            minimalistLogic.startRound(room.game);
                            room.players.forEach(p => {
                                io.to(p.id).emit('minimalistUpdate', {
                                    gameState: minimalistLogic.getPlayerView(room.game, p.id),
                                    lastAction: { action: 'newRound' }
                                });
                            });
                        }
                    }, endResult.nextRoundDelay);
                } else {
                    // Game Over
                    setTimeout(() => {
                        if (rooms.has(currentRoom)) {
                            room.game.status = 'gameEnded';
                            room.players.forEach(p => {
                                io.to(p.id).emit('minimalistUpdate', {
                                    gameState: minimalistLogic.getPlayerView(room.game, p.id),
                                    lastAction: { action: 'gameEnded' }
                                });
                            });
                        }
                    }, endResult.nextRoundDelay);
                }
            }
        }

        callback({ success: true });
    });

    // ================= THE MIND EVENTS =================

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
                const player = room.players.find(p => p.id === socket.id);
                if (player) {
                    const previousHostId = room.host;

                    if (room.game) {
                        player.connected = false;

                        if (room.gameType === 'blackjack') {
                            const disconnectResult = blackjackLogic.handlePlayerDisconnect(room.game, socket.id);
                            if (disconnectResult.transitionedToDealerTurn) {
                                startBlackjackDealerTurn(room);
                            }
                            broadcastBlackjackUpdate(room, { action: 'playerDisconnected', playerId: socket.id });
                        } else {
                            const gamePlayer = room.game.players.find(p => p.id === socket.id);
                            if (gamePlayer) {
                                gamePlayer.connected = false;
                            }
                        }
                    } else {
                        room.players = room.players.filter(p => p.id !== socket.id);
                        transferHostIfNeeded(room, previousHostId);
                        emitPlayerList(room);
                    }

                    transferHostIfNeeded(room, previousHostId);

                    io.to(currentRoom).emit('playerDisconnected', {
                        id: socket.id,
                        name: player.name
                    });
                }

                // Clean up logic
                const allDisconnected = room.players.length === 0 || room.players.every(p => !p.connected);

                if (allDisconnected) {
                    // If lobby is empty, delete immediately
                    if (!room.game) {
                        rooms.delete(currentRoom);
                        console.log(`Room ${currentRoom} deleted (lobby empty)`);
                    } else {
                        // If game in progress, wait grace period
                        setTimeout(() => {
                            const currentPlayerStatus = room.players.every(p => !p.connected);
                            if (currentPlayerStatus) {
                                rooms.delete(currentRoom);
                                console.log(`Room ${currentRoom} deleted (all players left game)`);
                            }
                        }, 30000); // 30 second grace period
                    }
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
