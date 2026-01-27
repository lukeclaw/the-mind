/**
 * OtherPlayer - represents other players around the table
 */
export default function OtherPlayer({ player, position }) {
    const positionStyles = {
        top: { top: '10%', left: '50%', transform: 'translateX(-50%)' },
        left: { top: '50%', left: '10%', transform: 'translateY(-50%)' },
        right: { top: '50%', right: '10%', transform: 'translateY(-50%)' },
        'top-left': { top: '20%', left: '15%' },
        'top-right': { top: '20%', right: '15%' }
    };

    return (
        <div className="other-player" style={positionStyles[position]}>
            <div className={`player-avatar ${!player.connected ? 'disconnected' : ''}`}>
                {player.name[0].toUpperCase()}
            </div>
            <span className="player-name">{player.name}</span>
            <span className="player-cards-count">
                {player.cardCount} card{player.cardCount !== 1 ? 's' : ''}
            </span>
            {!player.connected && (
                <span className="text-warning" style={{ fontSize: '0.75rem' }}>
                    Disconnected
                </span>
            )}
        </div>
    );
}
