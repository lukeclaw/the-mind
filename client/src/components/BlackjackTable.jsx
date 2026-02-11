import { useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';

const BET_CHIPS = [10, 25, 50, 100, 250, 500];

function getSeatClass(index, total) {
    if (total <= 1) return 'seat-top';
    if (total === 2) return index === 0 ? 'seat-left' : 'seat-right';
    if (total === 3) return ['seat-left', 'seat-top', 'seat-right'][index];
    return ['seat-far-left', 'seat-left', 'seat-right', 'seat-far-right'][index] || 'seat-top';
}

function getPlayerHands(player) {
    if (Array.isArray(player?.hands) && player.hands.length > 0) {
        return player.hands;
    }
    return [{
        cards: Array.isArray(player?.hand) ? player.hand : [],
        score: player?.score || 0,
        status: player?.status || 'betting',
        result: player?.result || null,
        bet: player?.currentBet || 0
    }];
}

export default function BlackjackTable({
    gameState,
    onAction,
    onVoteNextHand,
    onPlaceBet,
    onBeg,
    onLeave
}) {
    const state = (gameState && typeof gameState === 'object') ? gameState : {};
    const players = Array.isArray(state.players) ? state.players : [];
    const myPlayer = players.find((p) => p.isMe);
    const otherPlayers = players.filter((p) => !p.isMe);
    const myHands = useMemo(() => getPlayerHands(myPlayer), [myPlayer]);
    const dealer = state.dealer && typeof state.dealer === 'object'
        ? { hand: Array.isArray(state.dealer.hand) ? state.dealer.hand : [], score: state.dealer.score || 0, hidden: !!state.dealer.hidden }
        : { hand: [], score: 0, hidden: true };
    const available = state.availableActions || {};

    const [showBegModal, setShowBegModal] = useState(false);
    const [begMessage, setBegMessage] = useState('');
    const [pendingBet, setPendingBet] = useState(0);
    const [dragChip, setDragChip] = useState(null);
    const dropZoneRef = useRef(null);
    const dragStateRef = useRef(null);

    const connectedPlayerCount = players.filter((p) => p.connected).length;
    const isBetting = state.status === 'betting';
    const isInsurance = state.status === 'insurance';
    const roundVotes = state.readyVotes?.length || 0;
    const currentTurnPlayer = state.currentPlayerIndex !== undefined ? players[state.currentPlayerIndex] : null;
    const isMyTurn = !!(state.status === 'playing' && currentTurnPlayer?.id === myPlayer?.id);
    const waitingForBets = players.filter((p) => p.connected && !p.betReady);
    const waitingForInsurance = players.filter((p) => p.connected && !p.insuranceDecisionDone);
    const activeHandIndex = state.currentPlayerIndex !== undefined && players[state.currentPlayerIndex]?.id === myPlayer?.id
        ? state.currentHandIndex || 0
        : (myPlayer?.activeHandIndex || 0);
    const insuranceMax = available.insuranceMax ?? Math.floor((myPlayer?.currentBet || 0) / 2);
    const shoePercent = state.shoeTotal ? Math.max(0, Math.min(1, (state.shoeRemaining || 0) / state.shoeTotal)) : 0;

    useEffect(() => {
        if (!isBetting) {
            setPendingBet(0);
            return;
        }
        setPendingBet(myPlayer?.currentBet || 0);
    }, [isBetting, myPlayer?.currentBet]);

    const addChip = (amount) => {
        const bankroll = (myPlayer?.chips || 0) + (myPlayer?.currentBet || 0);
        setPendingBet((prev) => {
            const next = prev + amount;
            if (next > bankroll) return prev;
            return next;
        });
    };

    const startChipDrag = (event, amount, chipId) => {
        if (!isBetting || (myPlayer?.chips || 0) <= 0) return;
        const startX = event.clientX;
        const startY = event.clientY;
        dragStateRef.current = { amount, chipId, startX, startY, moved: false };
        setDragChip({ amount, chipId, x: startX, y: startY, moved: false });
    };

    useEffect(() => {
        if (!dragChip) return undefined;

        const handlePointerMove = (event) => {
            if (!dragStateRef.current) return;
            const dx = event.clientX - dragStateRef.current.startX;
            const dy = event.clientY - dragStateRef.current.startY;
            const moved = dragStateRef.current.moved || Math.hypot(dx, dy) > 8;
            dragStateRef.current.moved = moved;
            setDragChip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY, moved } : prev);
        };

        const handlePointerUp = (event) => {
            const dragState = dragStateRef.current;
            dragStateRef.current = null;
            if (!dragState) {
                setDragChip(null);
                return;
            }

            if (!dragState.moved) {
                addChip(dragState.amount);
                setDragChip(null);
                return;
            }

            const dropRect = dropZoneRef.current?.getBoundingClientRect();
            if (dropRect) {
                const inside =
                    event.clientX >= dropRect.left
                    && event.clientX <= dropRect.right
                    && event.clientY >= dropRect.top
                    && event.clientY <= dropRect.bottom;
                if (inside) {
                    addChip(dragState.amount);
                }
            }
            setDragChip(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [dragChip, isBetting, myPlayer?.chips, myPlayer?.currentBet]);

    const handlePlaceBet = async () => {
        const bankroll = (myPlayer?.chips || 0) + (myPlayer?.currentBet || 0);
        if (pendingBet < 0 || pendingBet > bankroll) return;
        if (pendingBet === 0 && (myPlayer?.currentBet || 0) === 0) return;
        await onPlaceBet(pendingBet);
    };

    const renderHandCards = (cards, compact = false, delayBaseMs = 0) => (
        <div className="card-fan">
            {cards.map((card, index) => {
                const hidden = !card || card.value === '?';
                return (
                    <div key={`card-${index}-${card?.value || 'u'}-${card?.suit || 'u'}`} className="card-slot">
                        <Card
                            faceUp={!hidden}
                            rank={hidden ? '?' : card?.value}
                            suit={hidden ? undefined : card?.suit}
                            compact={compact}
                            disabled={true}
                            animateIn={true}
                            animationDelayMs={delayBaseMs + (index * 90)}
                        />
                    </div>
                );
            })}
            {cards.length === 0 && (
                <>
                    <div className="card-slot ghost"><Card faceUp={false} compact={compact} disabled={true} /></div>
                    <div className="card-slot ghost"><Card faceUp={false} compact={compact} disabled={true} /></div>
                </>
            )}
        </div>
    );

    return (
        <div className="game-table blackjack-table">
            <div className="starfield" />

            <header className="blackjack-status-bar">
                <div className="status-item"><span className="status-value">Blackjack</span></div>
                <div className="status-item"><span className="status-label">Round</span><span className="status-value">{state.roundCount || 1}</span></div>
                <div className="status-item"><span className="status-label">Shoe</span><span className="status-value">{state.shoeRemaining || 0}/{state.shoeTotal || 0}</span></div>
                <button className="btn btn-secondary btn-small" onClick={onLeave}>Leave Game</button>
            </header>

            <div className="table-surface blackjack-surface">
                {state.message && <div className="blackjack-banner">{state.message}</div>}

                <aside className="discard-tray discard-left">
                    <div className="discard-stack">
                        {Array.from({ length: Math.min(20, Math.ceil((state.discardCount || 0) / 4)) }).map((_, i) => (
                            <div key={`discard-${i}`} className="discard-card" style={{ transform: `translate(${i * 0.7}px, ${-i}px) rotate(${(i % 2 ? 1 : -1) * (i * 0.7)}deg)` }} />
                        ))}
                    </div>
                    <span className="discard-label">Discard {state.discardCount || 0}</span>
                </aside>

                <aside className="shoe-tray shoe-right">
                    <div className="shoe-stack">
                        <div className="shoe-fill" style={{ height: `${shoePercent * 100}%` }} />
                    </div>
                    <span className="discard-label">Shoe {state.shoeRemaining || 0}</span>
                </aside>

                <section className={`dealer-lane ${state.status === 'dealerTurn' ? 'active' : ''}`}>
                    <span className="pile-label">Dealer ({dealer.hidden ? '?' : dealer.score})</span>
                    {renderHandCards(dealer.hand, false, 30)}
                </section>

                <section className="opponents-zone">
                    {otherPlayers.map((player, index) => {
                        const hands = getPlayerHands(player);
                        return (
                            <article key={player.id} className={`blackjack-seat ${getSeatClass(index, otherPlayers.length)}`}>
                                <div className="seat-head">
                                    <div className={`player-avatar ${!player.connected ? 'disconnected' : ''}`}>{player.name?.[0]?.toUpperCase() || '?'}</div>
                                    <div className="seat-meta">
                                        <span className="player-name">{player.name}</span>
                                        <span className="seat-chips">${player.chips} {player.currentBet > 0 ? `| Bet ${player.currentBet}` : ''}</span>
                                    </div>
                                </div>
                                <div className="seat-hands">
                                    {hands.map((hand, handIndex) => (
                                        <div className="seat-hand-box" key={`${player.id}-hand-${handIndex}`}>
                                            {renderHandCards(hand.cards || [], true, 90 + (index * 70) + (handIndex * 45))}
                                        </div>
                                    ))}
                                </div>
                                <div className={`seat-status ${player.status}`}>
                                    {player.status === 'playing' || player.status === 'betting' ? '' : `${player.status.toUpperCase()} (${player.score || 0})`}
                                </div>
                            </article>
                        );
                    })}
                </section>

                <section className={`local-lane ${isBetting ? 'betting' : ''}`}>
                    <div className="local-summary">
                        <span>You: {myPlayer?.score || 0}</span>
                        <span>{myPlayer?.status || 'waiting'}</span>
                        {myPlayer?.result && <span>{myPlayer.result.toUpperCase()}</span>}
                    </div>

                    <div className="local-hands-grid">
                        {myHands.map((hand, index) => (
                            <div key={`my-hand-${index}`} className={`local-hand-box ${index === activeHandIndex ? 'active' : ''}`}>
                                <div className="local-hand-head">
                                    <span>Hand {index + 1}</span>
                                    <span>{hand.score || 0} | {hand.status}</span>
                                </div>
                                {renderHandCards(hand.cards || [], false, 160 + (index * 80))}
                            </div>
                        ))}
                    </div>

                    {isBetting && <div className="local-hint">Drag chips into the betting circle or click chips below</div>}
                </section>
            </div>

            <footer className="blackjack-hud">
                <div className="blackjack-hud-stats">
                    <div className="blackjack-pill balance"><span className="blackjack-pill-label">Balance</span><span className="blackjack-pill-value">${myPlayer?.chips || 0}</span></div>
                    <div className="blackjack-pill bet"><span className="blackjack-pill-label">Bet</span><span className="blackjack-pill-value">{myPlayer?.currentBet ? `$${myPlayer.currentBet}` : '--'}</span></div>
                </div>

                <div className="blackjack-hud-actions">
                    <button className="btn btn-success blackjack-action-btn" onClick={() => onAction('hit')} disabled={!available.hit}>Hit</button>
                    <button className="btn btn-danger blackjack-action-btn" onClick={() => onAction('stand')} disabled={!available.stand}>Stand</button>
                    <button className="btn btn-secondary blackjack-action-btn small" onClick={() => onAction('double')} disabled={!available.double}>Double</button>
                    <button className="btn btn-secondary blackjack-action-btn small" onClick={() => onAction('split')} disabled={!available.split}>Split</button>
                    <button className="btn btn-secondary blackjack-action-btn small" onClick={() => onAction('surrender')} disabled={!available.surrender}>Surrender</button>
                </div>
            </footer>

            {isBetting && myPlayer?.betReady && waitingForBets.length > 0 && (
                <div className="blackjack-banner waiting-banner">
                    Bet locked. Waiting for: {waitingForBets.map((p) => p.name).join(', ')}
                </div>
            )}

            {state.status === 'playing' && !isMyTurn && currentTurnPlayer && (
                <div className="blackjack-banner waiting-banner">
                    Waiting for {currentTurnPlayer.name} to play
                    {state.currentHandIndex !== undefined ? ` (Hand ${state.currentHandIndex + 1})` : ''}
                </div>
            )}

            {isInsurance && !available.canInsurance && waitingForInsurance.length > 0 && (
                <div className="blackjack-banner waiting-banner">
                    Insurance locked. Waiting for: {waitingForInsurance.map((p) => p.name).join(', ')}
                </div>
            )}

            {isInsurance && (
                <div className="insurance-banner">
                    <span>Dealer shows Ace. Insurance?</span>
                    <button className="btn btn-secondary btn-small" onClick={() => onAction('insurance', { amount: 0 })} disabled={!available.canInsurance}>Decline</button>
                    <button className="btn btn-primary btn-small" onClick={() => onAction('insurance', { amount: insuranceMax })} disabled={!available.canInsurance || insuranceMax <= 0}>
                        Buy ${insuranceMax}
                    </button>
                </div>
            )}

            {isBetting && (
                <section className="table-betting-zone">
                    {myPlayer?.chips === 0 ? (
                        <div className="blackjack-stack">
                            <p className="text-danger">You are out of chips.</p>
                            <button className="btn btn-secondary" onClick={() => setShowBegModal(true)}>Request Refill</button>
                        </div>
                    ) : (
                        <>
                            <div
                                ref={dropZoneRef}
                                className={`bet-drop-zone ${pendingBet > 0 ? 'active' : ''}`}
                            >
                                <div className="bet-drop-label">Betting Circle</div>
                                <div className="bet-drop-value">${pendingBet}</div>
                            </div>

                            <div className="chip-bank table-chips">
                                {BET_CHIPS.map((amount, index) => {
                                    const chipId = `chip-${amount}-${index}`;
                                    const draggingThisChip = dragChip?.chipId === chipId;
                                    return (
                                    <button
                                        key={chipId}
                                        type="button"
                                        className={`chip-token chip-${amount} ${draggingThisChip ? 'dragging' : ''}`}
                                        onPointerDown={(e) => startChipDrag(e, amount, chipId)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                addChip(amount);
                                            }
                                        }}
                                    >
                                        <span className="chip-core">{amount}</span>
                                    </button>
                                );})}
                            </div>

                            <div className="blackjack-bet-input-row">
                                <button className="btn btn-secondary btn-small" onClick={() => setPendingBet(0)}>Clear</button>
                                <button
                                    className="btn btn-success"
                                    onClick={handlePlaceBet}
                                    disabled={
                                        pendingBet > ((myPlayer?.chips || 0) + (myPlayer?.currentBet || 0))
                                        || (pendingBet === 0 && (myPlayer?.currentBet || 0) === 0)
                                    }
                                >
                                    {pendingBet > 0
                                        ? `Confirm $${pendingBet}`
                                        : (myPlayer?.currentBet || 0) > 0
                                            ? 'Remove Bet'
                                            : 'Place Bet'}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}

            {dragChip && (
                <div
                    className={`chip-token chip-ghost chip-${dragChip.amount} ${dragChip.moved ? 'moving' : ''}`}
                    style={{ left: `${dragChip.x}px`, top: `${dragChip.y}px` }}
                >
                    <span className="chip-core">{dragChip.amount}</span>
                </div>
            )}

            {isBetting && myPlayer?.betReady && waitingForBets.length === 0 && (
                <div className="blackjack-banner waiting-banner">
                    Dealing cards...
                </div>
            )}

            {state.status === 'roundOver' && (
                <aside className={`blackjack-result-card ${(myPlayer?.result === 'win' || myPlayer?.status === 'blackjack') ? 'win' : myPlayer?.result === 'push' ? 'push' : 'loss'}`}>
                    <div className="blackjack-result-head">
                        <span className="blackjack-result-kicker">Round Over</span>
                        <span className="blackjack-result-dealer">Dealer {dealer.score}</span>
                    </div>
                    <p className="blackjack-result-main">
                        {myPlayer?.status === 'blackjack' ? 'BLACKJACK WIN' : myPlayer?.result ? myPlayer.result.toUpperCase() : 'LOSS'}
                    </p>
                    <p className="blackjack-result-balance">Balance: ${myPlayer?.chips || 0}</p>
                    <div className="blackjack-result-actions">
                        <button className={`btn ${state.readyVotes?.includes(myPlayer?.id) ? 'btn-secondary' : 'btn-primary'}`} onClick={onVoteNextHand} disabled={state.readyVotes?.includes(myPlayer?.id)}>
                            {state.readyVotes?.includes(myPlayer?.id) ? 'Waiting For Others' : 'Next Round'}
                        </button>
                        <span className="blackjack-result-votes">Votes {roundVotes}/{connectedPlayerCount}</span>
                    </div>
                </aside>
            )}

            {showBegModal && (
                <div className="modal-overlay">
                    <div className="modal-content blackjack-modal">
                        <h2 className="modal-title">Request Refill</h2>
                        <p className="modal-text">Type the exact phrase to receive chips.</p>
                        <input type="text" className="input" placeholder="i suck at gambling" value={begMessage} onChange={(e) => setBegMessage(e.target.value)} />
                        <div className="blackjack-chip-row">
                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    await onBeg(begMessage);
                                    setBegMessage('');
                                    setShowBegModal(false);
                                }}
                            >
                                Submit
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowBegModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
