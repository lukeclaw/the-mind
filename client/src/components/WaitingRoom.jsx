/**
 * WaitingRoom - displays after room is created/joined, before game starts
 */
export default function WaitingRoom({
    roomCode,
    players,
    isHost,
    onStartGame,
    onLeave,
    error,
    gameType
}) {
    const canStart = players.length >= (['blackjack', 'minimalist', '3d-platform'].includes(gameType) ? 1 : 2) && players.length <= 4;

    const shareUrl = `${window.location.origin}?join=${roomCode}`;

    const copyCode = () => {
        navigator.clipboard.writeText(roomCode);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl);
    };

    return (
        <div className="lobby-container">
            <div className="starfield" />
            <div className="panel panel-glow lobby-card waiting-room">
                <div className="lobby-header">
                    <h2>Game Lobby</h2>
                </div>

                <div className="room-code-display">
                    <div className="room-code-label">Room Code ({gameType === 'blackjack' ? 'Blackjack' : gameType === 'minimalist' ? 'Minimalist' : gameType === '3d-platform' ? '3D Platform' : 'The Mind'})</div>
                    <div className="room-code">{roomCode}</div>
                    <div className="flex gap-sm justify-center mt-md">
                        <button className="btn btn-secondary btn-small" onClick={copyCode}>
                            📋 Copy Code
                        </button>
                        <button className="btn btn-secondary btn-small" onClick={copyLink}>
                            🔗 Copy Link
                        </button>
                    </div>
                </div>

                <div className="mt-lg">
                    <h3 style={{ marginBottom: '0.5rem' }}>Players ({players.length}/4)</h3>
                    <div className="player-list">
                        {players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`player-badge ${index === 0 ? 'host' : ''}`}
                            >
                                <span className="player-avatar" style={{ width: 28, height: 28, fontSize: '0.875rem' }}>
                                    {player.name[0].toUpperCase()}
                                </span>
                                {player.name}
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="text-danger text-center mt-md">{error}</div>
                )}

                {players.length < (['blackjack', 'minimalist', '3d-platform'].includes(gameType) ? 1 : 2) && (
                    <p className="waiting-text mt-md">
                        Waiting for more players... (minimum {['blackjack', 'minimalist', '3d-platform'].includes(gameType) ? 1 : 2})
                    </p>
                )}

                {isHost ? (
                    <div className="mt-lg">
                        <button
                            className="btn btn-primary"
                            onClick={onStartGame}
                            disabled={!canStart}
                            style={{ width: '100%' }}
                        >
                            {canStart ? '🎯 Start Game' : `Need ${gameType === 'the-mind' ? '2-4' : '1-4'} Players`}
                        </button>
                    </div>
                ) : (
                    <p className="waiting-text mt-lg">
                        Waiting for host to start the game...
                    </p>
                )}

                <button
                    className="btn btn-secondary mt-md"
                    onClick={onLeave}
                    style={{ width: '100%' }}
                >
                    Leave Room
                </button>
            </div>
        </div>
    );
}
