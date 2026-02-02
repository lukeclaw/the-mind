/**
 * Minimalist Masterpiece - Game Logic
 */

// A curated list of MobileNet classes that are "drawable"
// Full list: https://github.com/tensorflow/tfjs-models/blob/master/mobilenet/src/imagenet_classes.ts
const DRAWABLE_CLASSES = [
    'banana', 'apple', 'sandwich', 'pizza', 'donut', 'hotdog',
    'butterfly', 'spider', 'ant', 'bee',
    'bicycle', 'traffic light', 'stop watch', 'clock', 'hourglass',
    'axe', 'hammer', 'screwdriver',
    'umbrella', 'mushroom', 'soccer ball', 'baseball', 'basketball',
    'eyeglasses', 'sunglasses', 'candle', 'envelope', 'ice cream',
    'cup', 'coffee mug', 'wine bottle', 'fork', 'knife', 'spoon'
];

/**
 * Create a new game state
 */
function createGame(players) {
    return {
        id: Date.now(),
        status: 'waiting', // waiting, playing, roundOver, gameEnded
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            score: 0,
            finished: false,
            inkUsed: 0,
            rank: null
        })),
        currentRound: 0,
        maxRounds: 5,
        targetWord: null,
        roundStartTime: null
    };
}

/**
 * Start a new round
 */
function startRound(game) {
    game.currentRound++;
    game.status = 'playing';
    game.targetWord = DRAWABLE_CLASSES[Math.floor(Math.random() * DRAWABLE_CLASSES.length)];
    game.roundStartTime = Date.now();

    // Reset round-specific player state
    game.players.forEach(p => {
        p.inkUsed = 0;
        p.finished = false;
        p.rank = null;
    });

    return {
        targetWord: game.targetWord,
        round: game.currentRound,
        maxRounds: game.maxRounds
    };
}

/**
 * Start a sandbox session (1 player)
 */
function startSandbox(game) {
    game.status = 'playing';
    game.mode = 'sandbox'; // Distinct from normal competitive
    game.targetWord = null; // No target
    game.currentRound = 1;
    game.maxRounds = 1; // Infinite really, but let's just keep state simple

    // Players just hang out
    return {
        mode: 'sandbox',
        targetWord: null
    };
}

/**
 * Handle a player finishing the drawing correctly
 */
function submitScore(game, playerId, inkConsumed) {
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.finished) return { success: false };

    player.finished = true;
    player.inkUsed = inkConsumed;

    // Calculate score based on Ink Economy formula
    // Score = (1 / InkUsed) * 100000 (roughly)
    // To make it distinct: The person with LESS ink ranks HIGHER.
    // For the game state, we just verify they are done. 
    // Actual points can be assigned at round end based on rank.

    // Assign rank based on who finished first? No, the rules say "Winner: player who hits threshold using LEAST ink".
    // So finishing order doesn't matter for winning, but we might want to end the round when everyone is done.

    const allFinished = game.players.every(p => p.finished || !p.connected);

    return {
        success: true,
        roundOver: allFinished // Trigger round end if everyone is done
    };
}

/**
 * End the round and calculate scores
 */
function endRound(game) {
    game.status = 'roundOver';

    // Sort players by Ink Used (Ascending) - only those who finished
    const finishedPlayers = game.players.filter(p => p.finished);
    finishedPlayers.sort((a, b) => a.inkUsed - b.inkUsed);

    // Assign points: 1st place gets 5 pts, 2nd 3pts, 3rd 1pt (Example) or just raw Score
    // Let's use the formula from the prompt: S = (InkThreshold / InkUsed) * 1000
    // Since InkThreshold is implicit (just being done), let's just do pure Efficiency Score.
    // We'll give points inversely proportional to ink used.
    // Simple approach: Rank based points.

    finishedPlayers.forEach((p, index) => {
        let points = 0;
        if (index === 0) points = 100; // Winner
        else if (index === 1) points = 75;
        else if (index === 2) points = 50;
        else points = 25;

        p.score += points;
        p.rank = index + 1;
    });

    return {
        rankings: finishedPlayers,
        nextRoundDelay: 5000
    };
}

function getPlayerView(game, playerId) {
    return {
        status: game.status,
        mode: game.mode || 'competitive',
        round: game.currentRound,
        totalRounds: game.maxRounds,
        targetWord: game.targetWord,
        players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            finished: p.finished,
            inkUsed: p.inkUsed,
            isMe: p.id === playerId
            // Hide exact ink of others during round to keep suspense? Or show it?
            // "Progress bar tracks ink usage" - likely personal. 
            // Let's show "finished" status to others.
        }))
    };
}

module.exports = {
    createGame,
    startRound,
    startSandbox,
    submitScore,
    endRound,
    getPlayerView
};
