import { useEffect, useState } from 'react';
import Card from './Card';

function getSeatClass(index, total) {
    if (total <= 1) return 'seat-top';
    if (total === 2) return index === 0 ? 'seat-left' : 'seat-right';
    if (total === 3) return ['seat-left', 'seat-top', 'seat-right'][index];
    return ['seat-far-left', 'seat-left', 'seat-right', 'seat-far-right'][index] || 'seat-top';
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
    const dealer = state.dealer && typeof state.dealer === 'object'
        ? { hand: Array.isArray(state.dealer.hand) ? state.dealer.hand : [], score: state.dealer.score || 0, hidden: !!state.dealer.hidden }
        : { hand: [], score: 0, hidden: true };
    const myPlayer = players.find((p) => p.isMe);
    const otherPlayers = players.filter((p) => !p.isMe);
    const [selectedBet, setSelectedBet] = useState(100);
    const [begMessage, setBegMessage] = useState('');
    const [showBegModal, setShowBegModal] = useState(false);
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [betPanelOpen, setBetPanelOpen] = useState(false);

    const isMyTurn = state.status === 'playing'
        && players[state.currentPlayerIndex]?.id === myPlayer?.id
        && myPlayer?.status === 'playing';
    const connectedPlayerCount = players.filter((p) => p.connected).length;
    const roundVotes = state.readyVotes?.length || 0;

    useEffect(() => {
        if (state.status !== 'betting' || myPlayer?.betReady) {
            setBetPanelOpen(false);
        }
    }, [state.status, myPlayer?.betReady]);

    const handlePlaceBet = async () => {
        const normalized = Math.floor(selectedBet);
        if (!Number.isFinite(normalized) || normalized <= 0) return;
        await onPlaceBet(normalized);
    };

    const renderPlayerCards = (player, compact = false) => (
        <div className="card-fan">
            {(Array.isArray(player?.hand) ? player.hand : []).map((card, index) => {
                const cardKey = `${player.id}-${index}`;
                const rank = card?.value ?? '?';
                const suit = card?.suit;
                return (
                    <button
                        type="button"
                        key={cardKey}
                        className={`card-slot ${selectedCardIndex === index && player.isMe ? 'selected' : ''}`}
                        onClick={() => player.isMe && setSelectedCardIndex(index)}
                    >
                        <Card
                            rank={rank}
                            suit={suit}
                            compact={compact}
                            selected={selectedCardIndex === index && player.isMe}
                            disabled={!player.isMe}
                            animateIn={true}
                            animationDelayMs={index * 60}
                        />
                    </button>
                );
            })}
        </div>
    );

    const renderDealerCards = () => (
        <div className="card-fan dealer-fan">
            {dealer.hand.map((card, index) => {
                const hidden = !card || card.value === '?';
                const cardKey = `dealer-${index}`;
                return (
                    <div className="card-slot" key={cardKey}>
                        <Card
                            faceUp={!hidden}
                            rank={hidden ? '?' : (card?.value ?? '?')}
                            suit={hidden ? undefined : card?.suit}
                            compact={false}
                            disabled={true}
                            animateIn={true}
                            animationDelayMs={index * 80}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="game-table blackjack-table">
            <div className="starfield" />

            <header className="blackjack-status-bar">
                <div className="status-item">
                    <span className="status-value">Blackjack</span>
                </div>
                <div className="status-item">
                    <span className="status-label">Round</span>
                    <span className="status-value">{state.roundCount || 1}</span>
                </div>
                <div className="status-item">
                    <span className="status-label">Shoe</span>
                    <span className="status-value">{state.shoeRemaining || 0}/{state.shoeTotal || 0}</span>
                </div>
                <button className="btn btn-secondary btn-small" onClick={onLeave}>
                    Leave Game
                </button>
            </header>

            <div className="table-surface blackjack-surface">
                {state.message && (
                    <div className="blackjack-banner">{state.message}</div>
                )}

                <section className={`dealer-lane ${state.status === 'dealerTurn' ? 'active' : ''}`}>
                    <span className="pile-label">Dealer ({dealer.hidden ? '?' : dealer.score})</span>
                    {renderDealerCards()}
                </section>

                <aside className="discard-tray">
                    <div className="discard-stack">
                        {Array.from({ length: Math.min(16, Math.ceil(((state.discardCount || 0)) / 4)) }).map((_, i) => (
                            <div className="discard-card" key={`discard-${i}`} style={{ transform: `translate(${i * 0.8}px, ${-i}px) rotate(${(i % 2 ? 1 : -1) * (i * 0.7)}deg)` }} />
                        ))}
                    </div>
                    <span className="discard-label">Discard {state.discardCount || 0}</span>
                </aside>

                <section className="opponents-zone">
                    {otherPlayers.map((player, index) => (
                        <article key={player.id} className={`blackjack-seat ${getSeatClass(index, otherPlayers.length)}`}>
                            <div className="seat-head">
                                <div className={`player-avatar ${!player.connected ? 'disconnected' : ''}`}>
                                    {player.name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="seat-meta">
                                    <span className="player-name">{player.name}</span>
                                    <span className="seat-chips">${player.chips} {player.currentBet > 0 ? `| Bet ${player.currentBet}` : ''}</span>
                                </div>
                            </div>
                            {renderPlayerCards(player, true)}
                            <div className={`seat-status ${player.status}`}>
                                {player.status === 'playing' || player.status === 'betting' ? '' : `${player.status.toUpperCase()} (${player.score})`}
                            </div>
                        </article>
                    ))}
                </section>

                <section className="local-lane">
                    <div className="local-summary">
                        <span>You: {myPlayer?.score || 0}</span>
                        <span>{myPlayer?.status}</span>
                        {myPlayer?.result && <span>{myPlayer.result.toUpperCase()}</span>}
                    </div>
                    {myPlayer ? renderPlayerCards(myPlayer) : null}
                </section>
            </div>

            <footer className="blackjack-hud">
                <div className="blackjack-hud-stats">
                    <div className="blackjack-pill balance">
                        <span className="blackjack-pill-label">Balance</span>
                        <span className="blackjack-pill-value">${myPlayer?.chips || 0}</span>
                    </div>
                    <div className="blackjack-pill bet">
                        <span className="blackjack-pill-label">Bet</span>
                        <span className="blackjack-pill-value">{myPlayer?.currentBet ? `$${myPlayer.currentBet}` : '--'}</span>
                    </div>
                </div>
                <div className="blackjack-hud-actions">
                    <button className="btn btn-success blackjack-action-btn" onClick={() => onAction('hit')} disabled={!isMyTurn}>
                        HIT
                    </button>
                    <button className="btn btn-danger blackjack-action-btn" onClick={() => onAction('stand')} disabled={!isMyTurn}>
                        STAND
                    </button>
                </div>
            </footer>

            {state.status === 'betting' && !myPlayer?.betReady && (
                <div className={`blackjack-bet-dock ${betPanelOpen ? 'open' : ''}`}>
                    <button
                        className={`blackjack-bet-toggle ${state.roundCount <= 1 ? 'first-round' : ''}`}
                        onClick={() => setBetPanelOpen((prev) => !prev)}
                    >
                        <span className="bet-toggle-dot" />
                        <span className="bet-toggle-text">Place Bet</span>
                        <span className="bet-toggle-sub">Required</span>
                        <span className="bet-toggle-arrow">{betPanelOpen ? '>' : '<'}</span>
                    </button>

                    <div className={`blackjack-bet-panel ${state.roundCount <= 1 ? 'first-round' : ''}`}>
                        <div className="blackjack-bet-head">
                            <h2>Place Bet</h2>
                            <span>Balance: ${myPlayer?.chips || 0}</span>
                        </div>

                        <div className="blackjack-bet-decor" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>

                        {myPlayer?.chips === 0 ? (
                            <div className="blackjack-stack">
                                <p className="text-danger">You are out of chips.</p>
                                <button className="btn btn-secondary" onClick={() => setShowBegModal(true)}>Request Refill</button>
                            </div>
                        ) : (
                            <div className="blackjack-stack">
                                <div className="blackjack-chip-row">
                                    {[10, 50, 100, 250, 500].map((amount) => (
                                        <button
                                            key={amount}
                                            className={`btn btn-small ${selectedBet === amount ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSelectedBet(amount)}
                                        >
                                            {amount}
                                        </button>
                                    ))}
                                </div>
                                <div className="blackjack-bet-input-row">
                                    <input
                                        type="number"
                                        className="input"
                                        value={selectedBet}
                                        min={1}
                                        max={myPlayer?.chips || 1}
                                        onChange={(e) => setSelectedBet(Number(e.target.value))}
                                    />
                                    <button
                                        className="btn btn-success"
                                        onClick={handlePlaceBet}
                                        disabled={!Number.isFinite(selectedBet) || selectedBet <= 0 || selectedBet > (myPlayer?.chips || 0)}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {state.status === 'betting' && myPlayer?.betReady && (
                <div className="blackjack-banner waiting-banner">
                    Waiting for bets: {players.filter((p) => p.betReady).length}/{connectedPlayerCount}
                </div>
            )}

            {state.status === 'roundOver' && (
                <aside
                    className={`blackjack-result-card ${(myPlayer?.result === 'win' || myPlayer?.status === 'blackjack') ? 'win' : myPlayer?.result === 'push' ? 'push' : 'loss'}`}
                >
                    <div className="blackjack-result-head">
                        <span className="blackjack-result-kicker">Round Over</span>
                        <span className="blackjack-result-dealer">Dealer {dealer.score}</span>
                    </div>

                    <p className="blackjack-result-main">
                        {myPlayer?.status === 'blackjack' ? 'BLACKJACK WIN' : myPlayer?.result ? myPlayer.result.toUpperCase() : 'LOSS'}
                    </p>
                    <p className="blackjack-result-balance">Balance: ${myPlayer?.chips || 0}</p>

                    <div className="blackjack-result-actions">
                        <button
                            className={`btn ${state.readyVotes?.includes(myPlayer?.id) ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={onVoteNextHand}
                            disabled={state.readyVotes?.includes(myPlayer?.id)}
                        >
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
                        <input
                            type="text"
                            className="input"
                            placeholder="i suck at gambling"
                            value={begMessage}
                            onChange={(e) => setBegMessage(e.target.value)}
                        />
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
                            <button className="btn btn-secondary" onClick={() => setShowBegModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
