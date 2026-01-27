import { useState } from 'react';
import Card from './Card';
import OtherPlayer from './OtherPlayer';

/**
 * BlackjackTable - view for Blackjack game
 */
export default function BlackjackTable({
    gameState,
    onAction, // hit, stand
    onDeal,
    onLeave
}) {
    const myPlayer = gameState.players.find(p => p.isMe);
    const otherPlayers = gameState.players.filter(p => !p.isMe);
    const dealer = gameState.dealer;
    const isMyTurn = gameState.status === 'playing' && gameState.players[gameState.currentPlayerIndex]?.id === myPlayer?.id && myPlayer?.status === 'playing';

    // Helper to get card value/suit
    const renderCard = (card, index) => {
        // Handle hidden dealer card
        if (card.value === '?') {
            return <Card key={`hidden-${index}`} value="?" faceUp={false} disabled={true} />;
        }

        // Convert to display format
        let displayValue = card.value;
        const suitSymbol = {
            'H': '❤️',
            'D': '♦️',
            'C': '♣️',
            'S': '♠️'
        }[card.suit];

        return (
            <div key={`${card.value}${card.suit}-${index}`} className="playing-card face-up" style={{
                color: ['H', 'D'].includes(card.suit) ? '#ef4444' : 'black',
                background: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '1.5rem',
                fontWeight: 'bold'
            }}>
                <div>{displayValue}</div>
                <div style={{ fontSize: '2rem' }}>{suitSymbol}</div>
            </div>
        );
    };

    return (
        <div className="game-table">
            <div className="starfield" />

            {/* Status bar */}
            <div className="game-status">
                <div className="status-item">
                    <span className="status-icon">🎰</span>
                    <span className="status-value">Blackjack</span>
                </div>
            </div>

            {/* Table surface */}
            <div className="table-surface" style={{ background: '#0f3822' }}> {/* Green felt style */}

                {/* Dealer Area */}
                <div className="pile-area" style={{ top: '30%' }}>
                    <div className="flex flex-col items-center gap-sm">
                        <span className="pile-label">Dealer ({dealer.hidden ? '?' : dealer.score})</span>
                        <div className="flex gap-sm">
                            {dealer.hand.map((card, idx) => renderCard(card, idx))}
                        </div>
                    </div>
                </div>

                {/* Other players - simplified positioning */}
                {otherPlayers.map((player, index) => (
                    <div key={player.id} style={{
                        position: 'absolute',
                        top: '50%',
                        [index % 2 === 0 ? 'left' : 'right']: '10%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <OtherPlayer player={player} position="top" />
                        <div className="flex gap-sm" style={{ marginTop: '0.5rem', transform: 'scale(0.6)' }}>
                            {player.hand.map((card, idx) => renderCard(card, idx))}
                        </div>
                        <div className={`mt-sm ${player.status === 'busted' ? 'text-danger' : 'text-muted'}`}>
                            {player.status.toUpperCase()} ({player.score})
                        </div>
                    </div>
                ))}

                {/* Game Result / Next Round */}
                {gameState.status === 'roundOver' && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0,0,0,0.8)',
                        padding: '2rem',
                        borderRadius: '1rem',
                        textAlign: 'center',
                        zIndex: 50
                    }}>
                        <h2 className="mb-md">Round Over</h2>
                        <button className="btn btn-primary" onClick={onDeal}>Deal Next Hand</button>
                    </div>
                )}

            </div>

            {/* Player's Actions */}
            <div className="player-hand" style={{ flexDirection: 'column', gap: '1rem' }}>
                <div className="text-center mb-sm font-bold">
                    You: {myPlayer?.score} ({myPlayer?.status})
                    {myPlayer?.result && ` - ${myPlayer.result.toUpperCase()}`}
                </div>

                <div className="flex gap-sm justify-center">
                    {myPlayer?.hand.map((card, index) => renderCard(card, index))}
                </div>

                <div className="flex gap-md mt-md">
                    <button
                        className="btn btn-success"
                        onClick={() => onAction('hit')}
                        disabled={!isMyTurn}
                    >
                        HIT
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={() => onAction('stand')}
                        disabled={!isMyTurn}
                    >
                        STAND
                    </button>
                </div>
            </div>

            {/* Leave button */}
            <button
                className="btn btn-secondary btn-small"
                onClick={onLeave}
                style={{ position: 'absolute', top: 20, right: 20 }}
            >
                Leave Game
            </button>
        </div>
    );
}
