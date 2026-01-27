/**
 * Blackjack Game Logic
 * Standard rules: Dealer stands on 17, Blackjack pays 3:2
 */

// Card utilities
const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return shuffle(deck);
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
    return {
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            score: 0,
            status: 'betting', // betting, playing, standing, busted, blackjack
            connected: true,
            chips: 1000 // Starting chips
        })),
        dealer: {
            hand: [],
            score: 0,
            hidden: true // Dealer's second card is hidden initially
        },
        deck: createDeck(),
        currentPlayerIndex: 0,
        status: 'playing', // betting, playing, dealerTurn, roundOver
        roundCount: 1
    };
}

function dealInitialCards(game) {
    // Reset hands
    game.deck = createDeck();
    game.dealer.hand = [];
    game.dealer.hidden = true;
    game.currentPlayerIndex = 0;
    game.status = 'playing';

    game.players.forEach(p => {
        p.hand = [];
        p.status = 'playing';
        // Deal 2 cards each
        p.hand.push(game.deck.pop());
        p.hand.push(game.deck.pop());

        // Check for natural Blackjack
        p.score = calculateScore(p.hand);
        if (p.score === 21) {
            p.status = 'blackjack';
        }
    });

    // Deal dealer cards
    game.dealer.hand.push(game.deck.pop()); // Face up
    game.dealer.hand.push(game.deck.pop()); // Hidden

    // Advance to first non-blackjack player
    updateTurn(game);

    return game;
}

function hit(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) {
        return { success: false, error: "Not your turn" };
    }

    const card = game.deck.pop();
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
        ['busted', 'standing', 'blackjack'].includes(game.players[game.currentPlayerIndex].status)
    ) {
        game.currentPlayerIndex++;
    }

    // All players done? Dealer turn
    if (game.currentPlayerIndex >= game.players.length) {
        game.status = 'dealerTurn';
        playDealer(game);
    }
}

function playDealer(game) {
    game.dealer.hidden = false;
    game.dealer.score = calculateScore(game.dealer.hand);

    // Dealer hits on soft 17? Let's say stand on all 17s for simplicity
    while (game.dealer.score < 17) {
        game.dealer.hand.push(game.deck.pop());
        game.dealer.score = calculateScore(game.dealer.hand);
    }

    game.status = 'roundOver';
    resolveRound(game);
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
            // If dealer also has blackjack, push. Else win 3:2 (standard) or just Win.
            if (dealerScore === 21 && game.dealer.hand.length === 2) {
                p.result = 'push';
            } else {
                p.result = 'win';
            }
            return;
        }

        // Standard hand
        if (dealerBust) {
            p.result = 'win';
        } else if (p.score > dealerScore) {
            p.result = 'win';
        } else if (p.score < dealerScore) {
            p.result = 'loss';
        } else {
            p.result = 'push';
        }
    });
}

function getPlayerView(game, playerId) {
    return {
        ...game,
        deck: undefined, // Hide deck
        dealer: {
            ...game.dealer,
            hand: game.dealer.hidden
                ? [game.dealer.hand[0], { suit: '?', value: '?' }]
                : game.dealer.hand
        },
        players: game.players.map(p => ({
            ...p,
            isMe: p.id === playerId
        }))
    };
}

module.exports = {
    createGame,
    dealInitialCards,
    hit,
    stand,
    getPlayerView
};
