import { useState } from 'react';
import Card from './Card';
import OtherPlayer from './OtherPlayer';

/**
 * BlackjackTable - view for Blackjack game
 */
export default function BlackjackTable({
    gameState,
    onAction, // hit, stand
    onVoteNextHand,
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

                {/* Reshuffle Notification */}
                {gameState.message && (
                    <div style={{
                        position: 'absolute',
                        top: '10%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(245, 158, 11, 0.9)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        zIndex: 100,
                        animation: 'fadeInOut 4s forwards'
                    }}>
                        ℹ️ {gameState.message}
                    </div>
                )}

                {/* VISUAL DISCARD TRAY */}
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    right: '25%',
                    width: '80px',
                    height: '110px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* Render stack of cards based on usage */}
                    {gameState.initialShoeSize && (
                        Array.from({ length: Math.min(20, Math.floor(((gameState.initialShoeSize - (gameState.shoe?.length || 0)) / gameState.initialShoeSize) * 20)) }).map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                bottom: i * 2,
                                left: i % 2,
                                width: '100%',
                                height: '100%',
                                background: '#b91c1c', // Card back color
                                border: '1px solid white',
                                borderRadius: '6px',
                                boxShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                                transform: `rotate(${i * 2 - 10}deg)`
                            }} />
                        ))
                    )}
                    <div style={{ position: 'absolute', bottom: -25, color: '#fff', fontSize: '0.7em' }}>
                        Discards
                        {/* Debug info: {gameState.initialShoeSize - (gameState.shoe?.length || 0)} */}
                    </div>
                </div>

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
                        alignItems: 'center',
                        gap: '0.5rem',
                        zIndex: 20
                    }}>
                        {/* Player Avatar & Name (Inline to avoid absolute positioning issues) */}
                        <div className="flex flex-col items-center gap-xs">
                            <div className={`player-avatar ${!player.connected ? 'disconnected' : ''}`} style={{
                                width: 40, height: 40, fontSize: '1rem'
                            }}>
                                {player.name[0].toUpperCase()}
                            </div>
                            <span className="player-name" style={{
                                background: 'rgba(0,0,0,0.5)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem'
                            }}>{player.name}</span>
                        </div>

                        {/* Cards */}
                        <div className="flex gap-sm" style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
                            {player.hand.map((card, idx) => renderCard(card, idx))}
                        </div>

                        <div className={`text-center font-bold ${player.status === 'busted' ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.9rem' }}>
                            {player.status === 'playing' ? '' : player.status.toUpperCase()} ({player.score})
                        </div>

                        {/* Result Overlay for other players */}
                        {(player.status === 'busted' || player.result === 'loss') && (
                            <div style={{
                                position: 'absolute',
                                inset: -10,
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '1rem',
                                pointerEvents: 'none'
                            }} />
                        )}
                        {(player.result === 'win' || player.status === 'blackjack') && (
                            <div style={{
                                position: 'absolute',
                                inset: -10,
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: '1rem',
                                pointerEvents: 'none'
                            }} />
                        )}
                    </div>
                ))}

                {/* Game Result / Next Round */}
                {gameState.status === 'roundOver' && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        padding: '2rem',
                        borderRadius: '1rem',
                        textAlign: 'center',
                        zIndex: 50,
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        minWidth: '300px'
                    }}>
                        <h2 className="mb-md" style={{ fontSize: '2rem', color: '#f59e0b' }}>Round Over</h2>

                        <div className="mb-lg">
                            {/* Simple result summary */}
                            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                Dealer had: <strong>{dealer.score}</strong>
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: myPlayer?.result === 'win' || myPlayer?.status === 'blackjack' ? '#4ade80' :
                                    myPlayer?.result === 'push' ? '#94a3b8' : '#ef4444'
                            }}>
                                You {myPlayer?.result === 'win' ? 'WON' : myPlayer?.status === 'blackjack' ? 'WON (Blackjack!)' : myPlayer?.result === 'push' ? 'PUSHED' : 'LOST'}
                            </div>
                        </div>

                        <div className="flex flex-col gap-sm">
                            <button
                                className={`btn ${gameState.readyVotes?.includes(myPlayer?.id) ? 'btn-secondary' : 'btn-primary'}`}
                                onClick={onVoteNextHand}
                                disabled={gameState.readyVotes?.includes(myPlayer?.id)}
                            >
                                {gameState.readyVotes?.includes(myPlayer?.id) ? 'Waiting for others...' : 'Ready for Next Hand'}
                            </button>

                            <div className="text-muted text-sm mt-sm">
                                Votes: {gameState.readyVotes?.length || 0} / {gameState.players?.length || 0}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Player's Actions */}
            <div className="player-hand" style={{ flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
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

                {/* Result Tint Overlay */}
                {(myPlayer?.status === 'busted' || myPlayer?.result === 'loss') && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(239, 68, 68, 0.2)', // Red tint
                        pointerEvents: 'none',
                        borderRadius: '1rem',
                        zIndex: 10
                    }} />
                )}
                {(myPlayer?.result === 'win' || myPlayer?.status === 'blackjack') && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(34, 197, 94, 0.2)', // Green tint
                        pointerEvents: 'none',
                        borderRadius: '1rem',
                        zIndex: 10
                    }} />
                )}
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
