import { useState, useRef } from 'react';

/**
 * Card component - reusable card for The Mind and Blackjack.
 */
export default function Card({
    value,
    suit,
    rank,
    faceUp = true,
    onPlay,
    selected,
    onSelect,
    keyboardHint,
    disabled = false,
    compact = false,
    animateIn = false,
    animationDelayMs = 0
}) {
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef(null);
    const identityValue = value ?? rank;

    const handleDragStart = (e) => {
        if (disabled || identityValue === undefined || identityValue === null) return;
        setIsDragging(true);
        e.dataTransfer.setData('card', identityValue.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleClick = () => {
        if (disabled || !faceUp || !onSelect) return;
        onSelect(identityValue);
    };

    const handleDoubleClick = () => {
        if (disabled || !faceUp || !onPlay) return;
        onPlay(identityValue);
    };

    if (!faceUp) {
        return (
            <div
                className={`playing-card face-down ${compact ? 'compact' : ''} ${animateIn ? 'dealt' : ''}`}
                style={{ animationDelay: animateIn ? `${animationDelayMs}ms` : undefined }}
            >
                <div className="card-back-pattern" />
                <div className="card-back-logo">M</div>
            </div>
        );
    }

    const displayValue = identityValue ?? '?';
    const suitSymbol = suit
        ? ({
            H: '♥',
            D: '♦',
            C: '♣',
            S: '♠'
        }[suit] || '')
        : '';
    const isRedSuit = suit === 'H' || suit === 'D';
    const cardToneClass = suit ? (isRedSuit ? 'red-suit' : 'black-suit') : '';

    return (
        <div
            ref={cardRef}
            className={`playing-card face-up ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${compact ? 'compact' : ''} ${cardToneClass} ${animateIn ? 'dealt' : ''}`}
            draggable={!disabled && identityValue !== undefined && identityValue !== null}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            style={{
                opacity: isDragging ? 0.5 : 1,
                animationDelay: animateIn ? `${animationDelayMs}ms` : undefined
            }}
        >
            <span className="card-corner top-left">{displayValue}{suitSymbol}</span>
            {suitSymbol ? (
                <span className="card-suit">{suitSymbol}</span>
            ) : (
                <span className="card-number">{displayValue}</span>
            )}
            <span className="card-corner bottom-right">{displayValue}{suitSymbol}</span>
            {keyboardHint && (
                <span
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.625rem',
                        color: 'var(--color-accent-primary)',
                        opacity: 0.7
                    }}
                >
                    [{keyboardHint}]
                </span>
            )}
        </div>
    );
}
