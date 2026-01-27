/**
 * Game Logic for The Mind
 * Manages game state, card dealing, and rule enforcement
 */

// Game configuration based on player count
const GAME_CONFIG = {
    2: { levels: 12, startLives: 2, startStars: 1 },
    3: { levels: 10, startLives: 3, startStars: 1 },
    4: { levels: 8, startLives: 4, startStars: 1 }
};

// Rewards at certain levels
const LEVEL_REWARDS = {
    2: { lives: 0, stars: 1 },
    3: { lives: 1, stars: 0 },
    5: { lives: 0, stars: 1 },
    6: { lives: 1, stars: 0 },
    8: { lives: 0, stars: 1 },
    9: { lives: 1, stars: 0 }
};

/**
 * Create a new game state
 */
function createGame(players) {
    const playerCount = players.length;
    const config = GAME_CONFIG[playerCount];

    if (!config) {
        throw new Error(`Invalid player count: ${playerCount}. Must be 2-4 players.`);
    }

    return {
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            cards: [],
            connected: true
        })),
        currentLevel: 1,
        maxLevels: config.levels,
        lives: config.startLives,
        throwingStars: config.startStars,
        pile: [],
        status: 'waiting', // waiting, playing, levelComplete, gameOver, victory
        starVotes: new Set(),
        lastPlayedBy: null
    };
}

/**
 * Deal cards for the current level
 */
function dealCards(game) {
    const level = game.currentLevel;
    const playerCount = game.players.length;

    // Create deck of cards 1-100
    const deck = Array.from({ length: 100 }, (_, i) => i + 1);

    // Shuffle deck (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal 'level' cards to each player
    game.players.forEach((player, index) => {
        player.cards = deck
            .slice(index * level, (index + 1) * level)
            .sort((a, b) => a - b);
    });

    game.pile = [];
    game.status = 'playing';
    game.starVotes.clear();
    game.lastPlayedBy = null;

    return game;
}

/**
 * Play a card - returns result with any penalties
 */
function playCard(game, playerId, cardValue) {
    const player = game.players.find(p => p.id === playerId);

    if (!player) {
        return { success: false, error: 'Player not found' };
    }

    if (!player.cards.includes(cardValue)) {
        return { success: false, error: 'Card not in hand' };
    }

    const topCard = game.pile.length > 0 ? game.pile[game.pile.length - 1] : 0;

    if (cardValue <= topCard) {
        return { success: false, error: 'Card must be higher than pile' };
    }

    // Check for penalties - any player with lower cards
    const penalties = [];
    game.players.forEach(p => {
        const lowerCards = p.cards.filter(c => c < cardValue);
        if (lowerCards.length > 0) {
            penalties.push({
                playerId: p.id,
                playerName: p.name,
                cards: lowerCards
            });
            // Remove all lower cards from that player's hand
            p.cards = p.cards.filter(c => c >= cardValue);
        }
    });

    // Remove the played card from player's hand
    player.cards = player.cards.filter(c => c !== cardValue);

    // Add to pile
    game.pile.push(cardValue);
    game.lastPlayedBy = playerId;

    // Apply penalty
    if (penalties.length > 0) {
        game.lives -= 1;
    }

    // Check for game over
    if (game.lives <= 0) {
        game.status = 'gameOver';
        return { success: true, penalties, gameOver: true };
    }

    // Check for level complete
    const allCardsPlayed = game.players.every(p => p.cards.length === 0);
    if (allCardsPlayed) {
        game.status = 'levelComplete';
        return { success: true, penalties, levelComplete: true };
    }

    return { success: true, penalties };
}

/**
 * Advance to next level
 */
function nextLevel(game) {
    game.currentLevel += 1;

    // Check for victory
    if (game.currentLevel > game.maxLevels) {
        game.status = 'victory';
        return { victory: true };
    }

    // Apply level rewards
    const reward = LEVEL_REWARDS[game.currentLevel];
    if (reward) {
        game.lives += reward.lives;
        game.throwingStars += reward.stars;
    }

    // Deal new cards
    dealCards(game);

    return { newLevel: game.currentLevel };
}

/**
 * Vote for throwing star
 */
function voteThrowingStar(game, playerId) {
    if (game.throwingStars <= 0) {
        return { success: false, error: 'No throwing stars left' };
    }

    game.starVotes.add(playerId);

    // Check if all players voted
    const allVoted = game.players.every(p => game.starVotes.has(p.id));

    if (allVoted) {
        return useThrowingStar(game);
    }

    return {
        success: true,
        waiting: true,
        votes: game.starVotes.size,
        needed: game.players.length
    };
}

/**
 * Cancel throwing star vote
 */
function cancelStarVote(game, playerId) {
    game.starVotes.delete(playerId);
    return { success: true, votes: game.starVotes.size };
}

/**
 * Use throwing star - all players discard lowest card
 */
function useThrowingStar(game) {
    game.throwingStars -= 1;

    const discarded = [];

    game.players.forEach(player => {
        if (player.cards.length > 0) {
            const lowestCard = player.cards[0]; // Cards are sorted
            player.cards = player.cards.slice(1);
            discarded.push({
                playerId: player.id,
                playerName: player.name,
                card: lowestCard
            });
        }
    });

    game.starVotes.clear();

    // Check for level complete after discarding
    const allCardsPlayed = game.players.every(p => p.cards.length === 0);
    if (allCardsPlayed) {
        game.status = 'levelComplete';
        return { success: true, discarded, levelComplete: true };
    }

    return { success: true, discarded };
}

/**
 * Get sanitized game state for a specific player
 * (hides other players' card values)
 */
function getPlayerView(game, playerId) {
    return {
        currentLevel: game.currentLevel,
        maxLevels: game.maxLevels,
        lives: game.lives,
        throwingStars: game.throwingStars,
        pile: game.pile,
        status: game.status,
        starVotes: Array.from(game.starVotes),
        lastPlayedBy: game.lastPlayedBy,
        players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            cardCount: p.cards.length,
            cards: p.id === playerId ? p.cards : [],
            connected: p.connected,
            isMe: p.id === playerId
        }))
    };
}

module.exports = {
    createGame,
    dealCards,
    playCard,
    nextLevel,
    voteThrowingStar,
    cancelStarVote,
    useThrowingStar,
    getPlayerView,
    GAME_CONFIG
};
