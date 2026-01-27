import { useState, useRef } from 'react';

/**
 * Card component - draggable playing card
 */
export default function Card({
    value,
    faceUp = true,
    onPlay,
    selected,
    onSelect,
    keyboardHint,
    disabled = false
}) {
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef(null);

    const handleDragStart = (e) => {
        if (disabled) return;
        setIsDragging(true);
        e.dataTransfer.setData('card', value.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleClick = () => {
        if (disabled || !faceUp) return;
        if (onSelect) {
            onSelect(value);
        }
    };

    const handleDoubleClick = () => {
        if (disabled || !faceUp) return;
        if (onPlay) {
            onPlay(value);
        }
    };

    if (!faceUp) {
        return (
            <div className="playing-card face-down">
                <div className="card-back-pattern" />
                <div className="card-back-logo">🧠</div>
            </div>
        );
    }

    return (
        <div
            ref={cardRef}
            className={`playing-card face-up ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            draggable={!disabled}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            style={{ opacity: isDragging ? 0.5 : 1 }}
        >
            <span className="card-corner top-left">{value}</span>
            <span className="card-number">{value}</span>
            <span className="card-corner bottom-right">{value}</span>
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
