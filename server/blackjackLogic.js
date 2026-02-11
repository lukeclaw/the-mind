/**
 * Blackjack game logic.
 * Rules implemented:
 * - Dealer stands on all 17s
 * - Multi-deck shoe with discard pile
 * - Insurance when dealer upcard is Ace
 * - Double down
 * - Split (up to 4 hands)
 * - Surrender (late surrender)
 * - Auto-lock at 21 (treated as blackjack-style status/payout per product request)
 */

const SUITS = ['H', 'D', 'C', 'S'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MAX_SPLIT_HANDS = 4;

function createShoe(numDecks = 6) {
    const shoe = [];
    for (let d = 0; d < numDecks; d += 1) {
        for (const suit of SUITS) {
            for (const value of VALUES) {
                shoe.push({ suit, value });
            }
        }
    }
    return shuffle(shoe);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(card) {
    if (!card) return 0;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value, 10);
}

function cardRankForSplit(card) {
    if (!card) return '';
    if (['10', 'J', 'Q', 'K'].includes(card.value)) return '10';
    return card.value;
}

function calculateScore(cards) {
    let score = 0;
    let aces = 0;

    for (const card of cards) {
        score += getCardValue(card);
        if (card?.value === 'A') aces += 1;
    }

    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }

    return score;
}

function createHand(cards = [], bet = 0, source = 'initial') {
    const score = calculateScore(cards);
    return {
        cards,
        score,
        bet,
        source, // initial, split
        doubled: false,
        surrendered: false,
        result: null,
        status: score === 21 ? 'blackjack' : 'playing' // playing, standing, busted, blackjack, surrendered
    };
}

function refreshLegacyPlayerFields(player) {
    const active = player.hands[player.activeHandIndex] || player.hands[0] || createHand();
    player.hand = active.cards;
    player.score = active.score;
    player.status = active.status;
    player.result = active.result;
    player.currentBet = player.hands.reduce((sum, h) => sum + h.bet, 0);
}

function markHandScoreAndStatus(hand) {
    hand.score = calculateScore(hand.cards);
    if (hand.surrendered) {
        hand.status = 'surrendered';
        return;
    }
    if (hand.score > 21) {
        hand.status = 'busted';
        return;
    }
    if (hand.score === 21) {
        hand.status = 'blackjack';
        return;
    }
    if (!['standing', 'blackjack', 'busted', 'surrendered'].includes(hand.status)) {
        hand.status = 'playing';
    }
}

function moveRoundCardsToDiscard(game) {
    if (game.dealer?.hand?.length) {
        game.discardPile.push(...game.dealer.hand);
    }

    for (const player of game.players) {
        for (const hand of player.hands || []) {
            if (hand.cards?.length) {
                game.discardPile.push(...hand.cards);
            }
        }
    }
}

function drawCard(game) {
    if (game.shoe.length === 0) return null;
    return game.shoe.pop();
}

function ensureShoe(game) {
    if (game.shoe.length >= game.initialShoeSize * 0.25) return;
    game.shoe = createShoe(game.numDecks);
    game.discardPile = [];
    game.message = 'Shoe reshuffled (75% penetration reached)';
}

function createPlayerState(p) {
    const hand = createHand([], 0, 'initial');
    return {
        id: p.id,
        name: p.name,
        connected: true,
        chips: 1000,
        betReady: false,
        insuranceBet: 0,
        insuranceSettled: false,
        insuranceDecisionDone: false,
        hands: [hand],
        activeHandIndex: 0,
        hand: hand.cards,
        score: hand.score,
        status: 'betting',
        result: null,
        currentBet: 0
    };
}

function createGame(players) {
    const numDecks = 6;
    const shoe = createShoe(numDecks);
    return {
        players: players.map(createPlayerState),
        dealer: {
            hand: [],
            score: 0,
            hidden: true
        },
        shoe,
        initialShoeSize: shoe.length,
        numDecks,
        discardPile: [],
        currentPlayerIndex: 0,
        currentHandIndex: 0,
        status: 'betting', // betting, insurance, playing, dealerTurn, roundOver
        roundCount: 1,
        message: null,
        readyVotes: new Set()
    };
}

function resetRoundStateForBetting(game) {
    moveRoundCardsToDiscard(game);
    ensureShoe(game);

    game.status = 'betting';
    game.readyVotes = new Set();
    game.currentPlayerIndex = 0;
    game.currentHandIndex = 0;
    game.dealer = {
        hand: [],
        score: 0,
        hidden: true
    };

    for (const player of game.players) {
        player.betReady = false;
        player.insuranceBet = 0;
        player.insuranceSettled = false;
        player.insuranceDecisionDone = false;
        player.activeHandIndex = 0;
        player.hands = [createHand([], 0, 'initial')];
        player.result = null;
        refreshLegacyPlayerFields(player);
        player.status = 'betting';
    }
}

function dealInitialCards(game) {
    game.message = null;
    moveRoundCardsToDiscard(game);
    ensureShoe(game);

    game.readyVotes = new Set();
    game.currentPlayerIndex = 0;
    game.currentHandIndex = 0;
    game.dealer = {
        hand: [],
        score: 0,
        hidden: true
    };

    for (const player of game.players) {
        const hand = createHand([], player.currentBet, 'initial');
        player.hands = [hand];
        player.activeHandIndex = 0;
        player.insuranceBet = 0;
        player.insuranceSettled = false;
        player.insuranceDecisionDone = false;
        player.result = null;

        hand.cards = [drawCard(game), drawCard(game)].filter(Boolean);
        hand.bet = player.currentBet;
        markHandScoreAndStatus(hand);
        refreshLegacyPlayerFields(player);
    }

    game.dealer.hand = [drawCard(game), drawCard(game)].filter(Boolean);
    game.dealer.hidden = true;
    game.dealer.score = calculateScore(game.dealer.hand);

    const upCard = game.dealer.hand[0];
    if (upCard?.value === 'A') {
        game.status = 'insurance';
        for (const player of game.players) {
            player.insuranceDecisionDone = !player.connected;
            player.insuranceSettled = false;
        }
        return game;
    }

    game.status = 'playing';
    updateTurn(game);
    return game;
}

function canPlayHand(hand) {
    return hand && hand.status === 'playing';
}

function updateTurn(game) {
    const startPlayer = game.currentPlayerIndex;
    const startHand = game.currentHandIndex;

    for (let playerStep = 0; playerStep < game.players.length; playerStep += 1) {
        const pIndex = (startPlayer + playerStep) % game.players.length;
        const player = game.players[pIndex];
        if (!player.connected) continue;

        const handStart = playerStep === 0 ? startHand : 0;
        for (let hIndex = handStart; hIndex < player.hands.length; hIndex += 1) {
            if (canPlayHand(player.hands[hIndex])) {
                game.currentPlayerIndex = pIndex;
                game.currentHandIndex = hIndex;
                player.activeHandIndex = hIndex;
                refreshLegacyPlayerFields(player);
                game.status = 'playing';
                return;
            }
        }
    }

    // No playable hands left.
    game.status = 'dealerTurn';
}

function normalizeBetAmount(amount) {
    if (!Number.isFinite(amount)) return null;
    const value = Math.floor(amount);
    if (value < 0) return null;
    return value;
}

function placeBet(game, playerId, amount) {
    if (game.status !== 'betting') {
        return { success: false, error: 'Not in betting phase' };
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const normalized = normalizeBetAmount(amount);
    if (normalized === null) return { success: false, error: 'Invalid bet' };

    const bankroll = player.chips + (player.currentBet || 0);
    if (normalized > bankroll) return { success: false, error: 'Not enough chips' };

    player.chips = bankroll - normalized;
    player.currentBet = normalized;
    player.betReady = normalized > 0;
    player.hands[0].bet = normalized;
    refreshLegacyPlayerFields(player);

    const connectedPlayers = game.players.filter((p) => p.connected);
    if (connectedPlayers.length > 0 && connectedPlayers.every((p) => p.betReady && p.currentBet > 0)) {
        dealInitialCards(game);
        return { success: true, gameStarted: true };
    }

    return { success: true, gameStarted: false };
}

function settleInsuranceAndTransition(game) {
    const allDone = game.players
        .filter((p) => p.connected)
        .every((p) => p.insuranceDecisionDone);
    if (!allDone) return { success: true, waiting: true };

    const dealerBlackjack = game.dealer.score === 21 && game.dealer.hand.length === 2;
    if (dealerBlackjack) {
        game.dealer.hidden = false;
        for (const player of game.players) {
            if (!player.insuranceSettled && player.insuranceBet > 0) {
                player.chips += player.insuranceBet * 3; // return bet + 2:1 profit
                player.insuranceSettled = true;
            }
        }
        game.status = 'roundOver';
        resolveRound(game);
        return { success: true, dealerBlackjack: true };
    }

    // Insurance lost if dealer has no blackjack.
    for (const player of game.players) {
        player.insuranceSettled = true;
    }

    game.status = 'playing';
    updateTurn(game);
    return { success: true, dealerBlackjack: false };
}

function insurance(game, playerId, amount = 0) {
    if (game.status !== 'insurance') {
        return { success: false, error: 'Insurance is not available now' };
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (player.insuranceDecisionDone) return { success: false, error: 'Insurance already decided' };

    const normalized = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
    const maxInsurance = Math.floor(player.currentBet / 2);
    if (normalized > maxInsurance) {
        return { success: false, error: 'Insurance exceeds max allowed' };
    }
    if (normalized > player.chips) {
        return { success: false, error: 'Not enough chips for insurance' };
    }

    player.chips -= normalized;
    player.insuranceBet = normalized;
    player.insuranceDecisionDone = true;
    refreshLegacyPlayerFields(player);
    return settleInsuranceAndTransition(game);
}

function getCurrentPlayerAndHand(game, playerId) {
    if (game.status !== 'playing') return { error: 'Round is not in playing phase' };
    const player = game.players[game.currentPlayerIndex];
    if (!player || player.id !== playerId) return { error: 'Not your turn' };
    const hand = player.hands[game.currentHandIndex];
    if (!hand) return { error: 'No active hand' };
    if (!canPlayHand(hand)) return { error: 'Hand is already resolved' };
    return { player, hand };
}

function advanceAfterHandUpdate(game) {
    const player = game.players[game.currentPlayerIndex];
    player.activeHandIndex = game.currentHandIndex;
    refreshLegacyPlayerFields(player);

    if (!canPlayHand(player.hands[game.currentHandIndex])) {
        game.currentHandIndex += 1;
    }

    updateTurn(game);
}

function hit(game, playerId) {
    const turn = getCurrentPlayerAndHand(game, playerId);
    if (turn.error) return { success: false, error: turn.error };
    if (turn.hand.cards.length >= 8) return { success: false, error: 'Hand size limit reached' };

    const card = drawCard(game);
    if (!card) return { success: false, error: 'Shoe is empty' };

    turn.hand.cards.push(card);
    markHandScoreAndStatus(turn.hand);
    advanceAfterHandUpdate(game);

    return { success: true, card, score: turn.hand.score };
}

function stand(game, playerId) {
    const turn = getCurrentPlayerAndHand(game, playerId);
    if (turn.error) return { success: false, error: turn.error };

    turn.hand.status = 'standing';
    markHandScoreAndStatus(turn.hand);
    advanceAfterHandUpdate(game);
    return { success: true };
}

function doubleDown(game, playerId) {
    const turn = getCurrentPlayerAndHand(game, playerId);
    if (turn.error) return { success: false, error: turn.error };

    const { player, hand } = turn;
    if (hand.cards.length !== 2) return { success: false, error: 'Double allowed only on first decision' };
    if (hand.doubled) return { success: false, error: 'Hand already doubled' };
    if (player.chips < hand.bet) return { success: false, error: 'Not enough chips to double' };

    player.chips -= hand.bet;
    hand.bet += hand.bet;
    hand.doubled = true;

    const card = drawCard(game);
    if (!card) return { success: false, error: 'Shoe is empty' };

    hand.cards.push(card);
    hand.status = 'standing';
    markHandScoreAndStatus(hand);
    if (hand.status === 'blackjack') hand.status = 'blackjack';
    advanceAfterHandUpdate(game);
    return { success: true, card, score: hand.score };
}

function split(game, playerId) {
    const turn = getCurrentPlayerAndHand(game, playerId);
    if (turn.error) return { success: false, error: turn.error };

    const { player, hand } = turn;
    if (player.hands.length >= MAX_SPLIT_HANDS) return { success: false, error: 'Split hand limit reached' };
    if (hand.cards.length !== 2) return { success: false, error: 'Split requires exactly two cards' };
    if (cardRankForSplit(hand.cards[0]) !== cardRankForSplit(hand.cards[1])) {
        return { success: false, error: 'Cards are not splittable' };
    }
    if (player.chips < hand.bet) return { success: false, error: 'Not enough chips to split' };

    player.chips -= hand.bet;

    const firstCard = hand.cards[0];
    const secondCard = hand.cards[1];
    const bet = hand.bet;

    const handA = createHand([firstCard, drawCard(game)].filter(Boolean), bet, 'split');
    const handB = createHand([secondCard, drawCard(game)].filter(Boolean), bet, 'split');

    player.hands.splice(game.currentHandIndex, 1, handA, handB);
    player.activeHandIndex = game.currentHandIndex;
    refreshLegacyPlayerFields(player);
    updateTurn(game);
    return { success: true };
}

function surrender(game, playerId) {
    const turn = getCurrentPlayerAndHand(game, playerId);
    if (turn.error) return { success: false, error: turn.error };

    const { hand } = turn;
    if (hand.cards.length !== 2) return { success: false, error: 'Surrender allowed only on first decision' };
    if (hand.source !== 'initial') return { success: false, error: 'Split hands cannot surrender' };

    hand.surrendered = true;
    hand.status = 'surrendered';
    markHandScoreAndStatus(hand);
    advanceAfterHandUpdate(game);
    return { success: true };
}

function revealDealer(game) {
    game.dealer.hidden = false;
    game.dealer.score = calculateScore(game.dealer.hand);
    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }
    return { finished: false };
}

function dealerStep(game) {
    game.dealer.score = calculateScore(game.dealer.hand);
    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    const card = drawCard(game);
    if (!card) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    game.dealer.hand.push(card);
    game.dealer.score = calculateScore(game.dealer.hand);

    if (game.dealer.score >= 17) {
        game.status = 'roundOver';
        resolveRound(game);
        return { finished: true };
    }

    return { finished: false };
}

function playDealer() {
    // async in server/index.js
}

function resolveHandResult(hand, dealerScore, dealerHasNaturalBlackjack) {
    if (hand.surrendered) return { result: 'surrender', payoutMultiplier: 0.5 };
    if (hand.status === 'busted') return { result: 'loss', payoutMultiplier: 0 };

    if (hand.status === 'blackjack') {
        if (dealerHasNaturalBlackjack) return { result: 'push', payoutMultiplier: 1 };
        return { result: 'win', payoutMultiplier: 2.5 };
    }

    if (dealerScore > 21) return { result: 'win', payoutMultiplier: 2 };
    if (hand.score > dealerScore) return { result: 'win', payoutMultiplier: 2 };
    if (hand.score < dealerScore) return { result: 'loss', payoutMultiplier: 0 };
    return { result: 'push', payoutMultiplier: 1 };
}

function resolveRound(game) {
    const dealerScore = game.dealer.score;
    const dealerHasNaturalBlackjack = dealerScore === 21 && game.dealer.hand.length === 2;

    for (const player of game.players) {
        let totalPayout = 0;
        const handResults = [];

        for (const hand of player.hands) {
            const outcome = resolveHandResult(hand, dealerScore, dealerHasNaturalBlackjack);
            hand.result = outcome.result;
            hand.status = hand.status === 'playing' ? 'standing' : hand.status;
            const payout = Math.floor(hand.bet * outcome.payoutMultiplier);
            totalPayout += payout;
            handResults.push(outcome.result);
        }

        player.chips += totalPayout;
        player.result = handResults.includes('win')
            ? 'win'
            : handResults.every((r) => r === 'push')
                ? 'push'
                : handResults.every((r) => r === 'surrender')
                    ? 'surrender'
                    : 'loss';
        player.status = player.hands[0]?.status || 'standing';
        refreshLegacyPlayerFields(player);
    }
}

function voteNextHand(game, playerId) {
    if (game.status !== 'roundOver') return { success: false, error: 'Round not over' };

    if (!(game.readyVotes instanceof Set)) {
        game.readyVotes = new Set(game.readyVotes || []);
    }
    game.readyVotes.add(playerId);

    const votesNeeded = game.players.filter((p) => p.connected).length;
    if (game.readyVotes.size >= votesNeeded) {
        game.roundCount += 1;
        resetRoundStateForBetting(game);
        return { success: true, bettingStarted: true };
    }

    return {
        success: true,
        bettingStarted: false,
        votes: game.readyVotes.size,
        needed: votesNeeded
    };
}

function begForMoney(game, playerId, message) {
    if (String(message || '').toLowerCase().trim() !== 'i suck at gambling') {
        return { success: false, error: 'Incorrect phrase' };
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (player.chips > 100) return { success: false, error: 'You still have chips!' };

    player.chips = 1000;
    refreshLegacyPlayerFields(player);
    return { success: true, chips: player.chips };
}

function getCurrentHandForPlayer(game, playerId) {
    const player = game.players.find((p) => p.id === playerId);
    if (!player) return null;
    if (game.currentPlayerIndex >= 0 && game.players[game.currentPlayerIndex]?.id === playerId) {
        return player.hands[game.currentHandIndex] || null;
    }
    return null;
}

function getAvailableActions(game, playerId) {
    const player = game.players.find((p) => p.id === playerId);
    if (!player) return {};

    if (game.status === 'betting') {
        return {
            canPlaceBet: true,
            canInsurance: false,
            hit: false,
            stand: false,
            double: false,
            split: false,
            surrender: false
        };
    }

    if (game.status === 'insurance') {
        return {
            canPlaceBet: false,
            canInsurance: !player.insuranceDecisionDone,
            insuranceMax: Math.floor(player.currentBet / 2),
            hit: false,
            stand: false,
            double: false,
            split: false,
            surrender: false
        };
    }

    const hand = getCurrentHandForPlayer(game, playerId);
    const isMyTurn = !!hand && game.status === 'playing';
    return {
        canPlaceBet: false,
        canInsurance: false,
        hit: isMyTurn && hand.status === 'playing',
        stand: isMyTurn && hand.status === 'playing',
        double: isMyTurn && hand.status === 'playing' && hand.cards.length === 2 && player.chips >= hand.bet,
        split: isMyTurn
            && hand.status === 'playing'
            && hand.cards.length === 2
            && cardRankForSplit(hand.cards[0]) === cardRankForSplit(hand.cards[1])
            && player.hands.length < MAX_SPLIT_HANDS
            && player.chips >= hand.bet,
        surrender: isMyTurn && hand.status === 'playing' && hand.cards.length === 2 && hand.source === 'initial'
    };
}

function getPlayerView(game, playerId) {
    const dealerHand = Array.isArray(game.dealer?.hand) ? game.dealer.hand.filter(Boolean) : [];
    const visibleDealerHand = game.dealer.hidden
        ? (dealerHand.length >= 2 ? [dealerHand[0], { suit: '?', value: '?' }] : dealerHand)
        : dealerHand;

    return {
        ...game,
        shoe: undefined,
        shoeRemaining: game.shoe.length,
        shoeTotal: game.initialShoeSize,
        discardCount: game.discardPile.length,
        dealer: {
            ...game.dealer,
            hand: visibleDealerHand
        },
        players: game.players.map((p) => ({
            ...p,
            isMe: p.id === playerId
        })),
        readyVotes: Array.from(game.readyVotes || []),
        availableActions: getAvailableActions(game, playerId)
    };
}

function reconnectPlayer(game, previousPlayerId, newPlayerId) {
    const player = game.players.find((p) => p.id === previousPlayerId);
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
    const player = game.players.find((p) => p.id === playerId);
    if (!player) return { success: false };

    const previousStatus = game.status;
    const wasCurrentTurn = game.status === 'playing'
        && game.players[game.currentPlayerIndex]?.id === playerId;

    player.connected = false;
    if (game.readyVotes instanceof Set) game.readyVotes.delete(playerId);

    if (game.status === 'betting') {
        player.betReady = false;
        player.currentBet = 0;
    }

    if (game.status === 'insurance' && !player.insuranceDecisionDone) {
        player.insuranceDecisionDone = true;
        settleInsuranceAndTransition(game);
    }

    if (game.status === 'playing' && wasCurrentTurn) {
        const hand = player.hands[game.currentHandIndex];
        if (hand && hand.status === 'playing') {
            hand.status = 'standing';
        }
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
    doubleDown,
    split,
    surrender,
    insurance,
    voteNextHand,
    placeBet,
    begForMoney,
    getPlayerView,
    revealDealer,
    dealerStep,
    reconnectPlayer,
    handlePlayerDisconnect
};
