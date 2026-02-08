/**
 * Blackjack Game Logic
 * Standard rules: Dealer stands on 17, Blackjack pays 3:2
 */

// Card utilities
const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createShoe(numDecks = 6) {
    const shoe = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of SUITS) {
            for (const value of VALUES) {
                shoe.push({ suit, value });
            }
        }
    }
    return shuffle(shoe);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11; // Handle Ace logic dynamically in score calc
    return parseInt(card.value);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
        score += getCardValue(card);
        if (card.value === 'A') aces += 1;
    }

    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }

    return score;
}

function createGame(players) {
    const numDecks = 6;
    const shoe = createShoe(numDecks);
    return {
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            score: 0,
            status: 'betting', // betting, playing, standing, busted, blackjack
            connected: true,
            chips: 1000, // Starting chips
            currentBet: 0,
            betReady: false
        })),
        dealer: {
            hand: [],
            score: 0,
            hidden: true // Dealer's second card is hidden initially
        },
        shoe: shoe,
        initialShoeSize: shoe.length,
        numDecks: numDecks,
        initialShoeSize: shoe.length,
        numDecks: numDecks,
        currentPlayerIndex: 0,
        status: 'betting', // betting, playing, dealerTurn, roundOver
        roundCount: 1,
        message: null, // For reshuffle notifications
        readyVotes: new Set() // Track players ready for next hand
    };
}

function dealInitialCards(game) {
    // Check if shoe needs reshuffling (75% used = 25% remaining)
    game.message = null;
    if (game.shoe.length < (game.initialShoeSize * 0.25)) {
        game.shoe = createShoe(game.numDecks);
        game.message = "Shoe reshuffled (75% penetration reached)";
    }

    // Reset hands
    game.dealer.hand = [];
    game.dealer.hidden = true;
    game.currentPlayerIndex = 0;
    game.status = 'playing';
    game.readyVotes = new Set(); // Reset votes as Set

    game.players.forEach(p => {
        p.hand = [];
        p.status = 'playing';
        p.result = null; // Clear previous result
        // Deal 2 cards each
        p.hand.push(game.shoe.pop());
        p.hand.push(game.shoe.pop());

        // Check for natural Blackjack
        p.score = calculateScore(p.hand);
        if (p.score === 21) {
            p.status = 'blackjack';
        }
    });

    // Deal dealer cards
    game.dealer.hand.push(game.shoe.pop()); // Face up
    game.dealer.hand.push(game.shoe.pop()); // Hidden

    // Advance to first non-blackjack player
    updateTurn(game);

    return game;
}

// ... existing hit/stand/updateTurn/playDealer/resolveRound functions ...

function placeBet(game, playerId, amount) {
    if (game.status !== 'betting') {
        return { success: false, error: "Not in betting phase" };
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: "Player not found" };

    if (amount <= 0) return { success: false, error: "Bet must be positive" };
    if (amount > player.chips) return { success: false, error: "Not enough chips" };

    player.chips -= amount; // Deduct immediately
    player.currentBet = amount;
    player.betReady = true;

    // Check if all connected players are ready
    const connectedPlayers = game.players.filter(p => p.connected);
    if (connectedPlayers.every(p => p.betReady)) {
        // Start game logic
        dealInitialCards(game);
        return { success: true, gameStarted: true };
    }

    return { success: true, gameStarted: false };
}

function begForMoney(game, playerId, message) {
    if (message.toLowerCase().trim() !== "i suck at gambling") {
        return { success: false, error: "Incorrect phrase" };
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: "Player not found" };

    if (player.chips > 100) { // Only if they are really low/out
        return { success: false, error: "You still have chips!" };
    }

    player.chips = 1000;
    return { success: true, chips: player.chips };
}

function voteNextHand(game, playerId) {
    if (game.status !== 'roundOver') {
        return { success: false, error: "Round not over" };
    }

    // Ensure readyVotes is a Set
    if (!(game.readyVotes instanceof Set)) {
        game.readyVotes = new Set(game.readyVotes || []);
    }

    game.readyVotes.add(playerId);

    const connectedPlayers = game.players.filter(p => p.connected).length;
    const votesNeeded = connectedPlayers; // Require all connected players

    if (game.readyVotes.size >= votesNeeded) {
        // Reset to betting phase instead of dealing immediately
        prepareBettingPhase(game);
        return { success: true, bettingStarted: true };
    }

    return {
        success: true,
        bettingStarted: false,
        votes: game.readyVotes.size,
        needed: votesNeeded
    };
}

function prepareBettingPhase(game) {
    game.status = 'betting';
    game.readyVotes = new Set();
    game.dealer.hand = [];
    game.dealer.hidden = true;
    game.dealer.score = 0;
    game.message = null;

    game.players.forEach(p => {
        p.hand = [];
        p.score = 0;
        p.status = 'betting';
        p.result = null;
        p.betReady = false;
        p.currentBet = 0;
    });
}


function hit(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) {
        return { success: false, error: "Not your turn" };
    }

    const card = game.shoe.pop();
    player.hand.push(card);
    player.score = calculateScore(player.hand);

    if (player.score > 21) {
        player.status = 'busted';
        updateTurn(game);
    }
    // Auto-stand on 21? Optional. Let's let them stand manually to be safe.

    return { success: true, card, score: player.score };
}

function stand(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) {
        return { success: false, error: "Not your turn" };
    }

    player.status = 'standing';
    updateTurn(game);

    return { success: true };
}

function updateTurn(game) {
    // Find next player who is 'playing'
    while (
        game.currentPlayerIndex < game.players.length &&
        (
            !game.players[game.currentPlayerIndex].connected ||
            ['busted', 'standing', 'blackjack'].includes(game.players[game.currentPlayerIndex].status)
        )
    ) {
        game.currentPlayerIndex++;
    }

    // All players done? Dealer turn
    if (game.currentPlayerIndex >= game.players.length) {
        game.status = 'dealerTurn';
        playDealer(game);
    }
}

// Reveal hidden card only
function revealDealer(game) {
    game.dealer.hidden = false;
    game.dealer.score = calculateScore(game.dealer.hand);

    // Check if dealer is done immediately (e.g. has 17+)
    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    return { finished: false };
}

// Perform one dealer hit
function dealerStep(game) {
    // Safety check
    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    game.dealer.hand.push(game.shoe.pop());
    game.dealer.score = calculateScore(game.dealer.hand);

    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    return { finished: false };
}

/* 
 * Legacy function - kept if needed but we'll use steps now
 */
function playDealer(game) {
    // No-op for async handled in index.js
    // We just return, index.js observes status = 'dealerTurn' and takes over
}

function resolveRound(game) {
    const dealerScore = game.dealer.score;
    const dealerBust = dealerScore > 21;

    game.players.forEach(p => {
        if (p.status === 'busted') {
            // Player loses
            return;
        }

        if (p.status === 'blackjack') {
            // If dealer also has blackjack, push. Else win 3:2 (standard)
            if (dealerScore === 21 && game.dealer.hand.length === 2) {
                p.result = 'push';
                p.chips += p.currentBet;
            } else {
                p.result = 'win';
                p.chips += Math.floor(p.currentBet * 2.5); // 3:2 payout + return bet
            }
            return;
        }

        // Standard hand
        if (dealerBust) {
            p.result = 'win';
            p.chips += p.currentBet * 2; // Return bet + win
        } else if (p.score > dealerScore) {
            p.result = 'win';
            p.chips += p.currentBet * 2;
        } else if (p.score < dealerScore) {
            p.result = 'loss';
            // Chips already deducted at bet time (actually I need to deduct them at bet time or here? Let's check logic)
            // Wait, if I deduct at bet time, then 'Win' returns bet + profit.
            // If I haven't deducted yet, I should.
            // Best practice: Deduct on placeBet. Then Win returns 2x, Push returns 1x.
        } else {
            p.result = 'push';
            p.chips += p.currentBet; // Return bet
        }
    });
}

function getPlayerView(game, playerId) {
    return {
        ...game,
        shoe: undefined, // Hide shoe
        dealer: {
            ...game.dealer,
            hand: game.dealer.hidden
                ? [game.dealer.hand[0], { suit: '?', value: '?' }]
                : game.dealer.hand
        },
        players: game.players.map(p => ({
            ...p,
            isMe: p.id === playerId
        })),
        readyVotes: Array.from(game.readyVotes || []) // Serialize Set to Array
    };
}

function reconnectPlayer(game, previousPlayerId, newPlayerId) {
    const player = game.players.find(p => p.id === previousPlayerId);
    if (!player) return { success: false, error: 'Player not found' };

    player.id = newPlayerId;
    player.connected = true;

    if (game.readyVotes instanceof Set && game.readyVotes.has(previousPlayerId)) {
        game.readyVotes.delete(previousPlayerId);
        game.readyVotes.add(newPlayerId);
    }

    return { success: true };
}

function handlePlayerDisconnect(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false };

    const previousStatus = game.status;
    const wasCurrentTurn = game.status === 'playing' && game.players[game.currentPlayerIndex]?.id === playerId;

    player.connected = false;

    if (game.readyVotes instanceof Set) {
        game.readyVotes.delete(playerId);
    }

    if (game.status === 'betting') {
        player.betReady = false;
        player.currentBet = 0;
    }

    if (game.status === 'playing' && player.status === 'playing') {
        player.status = 'standing';
    }

    if (game.status === 'playing' && (wasCurrentTurn || player.status === 'standing')) {
        updateTurn(game);
    }

    return {
        success: true,
        transitionedToDealerTurn: previousStatus !== 'dealerTurn' && game.status === 'dealerTurn'
    };
}

module.exports = {
    createGame,
    dealInitialCards,
    hit,
    stand,
    voteNextHand,
    placeBet,
    begForMoney,
    getPlayerView,
    revealDealer,
    dealerStep,
    reconnectPlayer,
    handlePlayerDisconnect
};
