import { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import OtherPlayer from './OtherPlayer';

/**
 * GameTable - main game view with table, pile, and player hands
 */
export default function GameTable({
    gameState,
    onPlayCard,
    onNextLevel,
    onVoteThrowingStar,
    onCancelStarVote,
    onLeave
}) {
    const [selectedCard, setSelectedCard] = useState(null);
    const [showPenalty, setShowPenalty] = useState(false);

    const myPlayer = gameState.players.find(p => p.isMe);
    const otherPlayers = gameState.players.filter(p => !p.isMe);
    const topCard = gameState.pile.length > 0 ? gameState.pile[gameState.pile.length - 1] : null;
    const isVoting = gameState.starVotes?.length > 0;
    const hasVoted = gameState.starVotes?.includes(myPlayer?.id);

    // Keyboard shortcuts for playing cards
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (gameState.status !== 'playing') return;

            const key = e.key;
            const cards = myPlayer?.cards || [];

            // Number keys 1-9 select/play cards
            if (key >= '1' && key <= '9') {
                const index = parseInt(key) - 1;
                if (index < cards.length) {
                    const card = cards[index];
                    if (selectedCard === card) {
                        // Double press = play
                        handlePlayCard(card);
                    } else {
                        setSelectedCard(card);
                    }
                }
            }

            // Enter or Space plays selected card
            if ((key === 'Enter' || key === ' ') && selectedCard) {
                e.preventDefault();
                handlePlayCard(selectedCard);
            }

            // Escape deselects
            if (key === 'Escape') {
                setSelectedCard(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState.status, myPlayer?.cards, selectedCard]);

    // Show penalty flash effect
    useEffect(() => {
        const handleCardPlayed = (e) => {
            // Check for penalties in recent game state changes
            if (e.detail?.penalties?.length > 0) {
                setShowPenalty(true);
                setTimeout(() => setShowPenalty(false), 500);
            }
        };

        window.addEventListener('cardPenalty', handleCardPlayed);
        return () => window.removeEventListener('cardPenalty', handleCardPlayed);
    }, []);

    const handlePlayCard = useCallback(async (cardValue) => {
        try {
            await onPlayCard(cardValue);
            setSelectedCard(null);
        } catch (err) {
            console.error('Failed to play card:', err);
        }
    }, [onPlayCard]);

    const handleDrop = (e) => {
        e.preventDefault();
        const cardValue = parseInt(e.dataTransfer.getData('card'));
        if (cardValue) {
            handlePlayCard(cardValue);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Get positions for other players
    const getPlayerPositions = (count) => {
        switch (count) {
            case 1: return ['top'];
            case 2: return ['left', 'right'];
            case 3: return ['left', 'top', 'right'];
            default: return [];
        }
    };

    const positions = getPlayerPositions(otherPlayers.length);

    // End screens
    if (gameState.status === 'victory') {
        return (
            <div className="lobby-container">
                <div className="starfield" />
                <div className="panel panel-glow lobby-card end-screen">
                    <div className="end-icon">🎉</div>
                    <h2 className="end-title victory">Victory!</h2>
                    <p className="text-muted mb-md">
                        You completed all {gameState.maxLevels} levels!
                    </p>
                    <button className="btn btn-primary" onClick={onLeave}>
                        Play Again
                    </button>
                </div>
            </div>
        );
    }

    if (gameState.status === 'gameOver') {
        return (
            <div className="lobby-container">
                <div className="starfield" />
                <div className="panel panel-glow lobby-card end-screen">
                    <div className="end-icon">💔</div>
                    <h2 className="end-title defeat">Game Over</h2>
                    <p className="text-muted mb-md">
                        You ran out of lives on level {gameState.currentLevel}
                    </p>
                    <button className="btn btn-primary" onClick={onLeave}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Level complete modal
    if (gameState.status === 'levelComplete') {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2 className="modal-title">Level {gameState.currentLevel} Complete! 🎯</h2>
                    <p className="modal-text">
                        {gameState.currentLevel < gameState.maxLevels
                            ? `Ready for level ${gameState.currentLevel + 1}?`
                            : 'That was the final level!'}
                    </p>
                    <button className="btn btn-primary" onClick={onNextLevel}>
                        {gameState.currentLevel < gameState.maxLevels ? 'Next Level' : 'See Results'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="game-table">
            <div className="starfield" />

            {showPenalty && <div className="penalty-flash" />}

            {/* Status bar */}
            <div className="game-status">
                <div className="status-item">
                    <span className="status-icon">📊</span>
                    <span className="status-value">Level {gameState.currentLevel}/{gameState.maxLevels}</span>
                </div>
                <div className="status-item">
                    <span className="status-icon">❤️</span>
                    <span className="status-value">{gameState.lives}</span>
                </div>
                <div className="status-item">
                    <span className="status-icon">⭐</span>
                    <span className="status-value">{gameState.throwingStars}</span>
                </div>
            </div>

            {/* Table surface */}
            <div className="table-surface">
                {/* Central pile */}
                <div
                    className="pile-area"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    {topCard ? (
                        <div className="pile-card" key={topCard}>
                            {topCard}
                        </div>
                    ) : (
                        <div className="pile-card empty">
                            Drop card here
                        </div>
                    )}
                    <span className="pile-label">
                        {topCard ? `Played by ${gameState.players.find(p => p.id === gameState.lastPlayedBy)?.name || 'Unknown'}` : 'The Pile'}
                    </span>
                </div>

                {/* Other players */}
                {otherPlayers.map((player, index) => (
                    <OtherPlayer
                        key={player.id}
                        player={player}
                        position={positions[index]}
                    />
                ))}
            </div>

            {/* Throwing star button */}
            <div style={{ position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)' }}>
                {gameState.throwingStars > 0 && (
                    <button
                        className={`btn btn-secondary throwing-star-btn ${isVoting ? 'voting' : ''}`}
                        onClick={hasVoted ? onCancelStarVote : onVoteThrowingStar}
                        style={{ background: hasVoted ? 'rgba(245, 158, 11, 0.3)' : undefined }}
                    >
                        ⭐ {isVoting
                            ? `Throwing Star (${gameState.starVotes.length}/${gameState.players.length})`
                            : 'Use Throwing Star'}
                        {hasVoted && ' ✓'}
                    </button>
                )}
            </div>

            {/* Player's hand */}
            <div className="player-hand">
                <div className="hand-cards">
                    {myPlayer?.cards.map((card, index) => (
                        <Card
                            key={card}
                            value={card}
                            faceUp={true}
                            selected={selectedCard === card}
                            onSelect={setSelectedCard}
                            onPlay={handlePlayCard}
                            keyboardHint={index < 9 ? (index + 1).toString() : null}
                        />
                    ))}
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

            {/* Instructions */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    textAlign: 'right'
                }}
            >
                Drag or double-click to play<br />
                Press 1-9 to select, Enter to play
            </div>
        </div>
    );
}
