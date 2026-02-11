import { useState, useEffect } from 'react';
import AiComputeEstimator from './AiComputeEstimator';

/**
 * Lobby component - handles creating/joining rooms
 */
export default function Lobby({
    isConnected,
    onCreateRoom,
    onJoinRoom,
    error,
    onClearError,
    initialJoinCode
}) {
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState(initialJoinCode || '');
    const [mode, setMode] = useState(initialJoinCode ? 'join' : null); // null, 'create', 'join', 'estimator'
    const [gameType, setGameType] = useState('minimalist'); // 'the-mind', 'blackjack', 'minimalist', '3d-platform'
    const [isLoading, setIsLoading] = useState(false);
    const normalizedName = name.trim();
    const normalizedJoinCode = joinCode.trim().toUpperCase();
    const canJoinRoom = !!normalizedName && /^[A-Z0-9]{6}$/.test(normalizedJoinCode);

    useEffect(() => {
        const savedName = window.localStorage.getItem('playerName');
        if (savedName) {
            setName(savedName);
        }
    }, []);

    useEffect(() => {
        if (initialJoinCode) {
            setJoinCode(initialJoinCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6));
            setMode('join');
        }
    }, [initialJoinCode]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!normalizedName) return;

        setIsLoading(true);
        onClearError();

        try {
            window.localStorage.setItem('playerName', normalizedName);
            await onCreateRoom(normalizedName, gameType);
        } catch (err) {
            console.error('Failed to create room:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        if (!canJoinRoom) return;

        setIsLoading(true);
        onClearError();

        try {
            window.localStorage.setItem('playerName', normalizedName);
            await onJoinRoom(normalizedJoinCode, normalizedName);
        } catch (err) {
            console.error('Failed to join room:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!mode) {
        return (
            <div className="lobby-container">
                <div className="starfield" />
                <div className="panel panel-glow lobby-card">
                    <div className="lobby-header">
                        <h1 className="lobby-title">The Mind</h1>
                        <p className="lobby-subtitle">Become one with your team</p>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Your Name</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Enter your name..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={20}
                            disabled={!isConnected}
                        />
                    </div>

                    {error && <div className="text-danger text-center mt-md">{error}</div>}

                    {!isConnected && (
                        <div className="text-warning text-center mt-md">
                            Connecting to server...
                        </div>
                    )}

                    <div className="lobby-form mt-lg">
                        <button
                            className="btn btn-primary"
                            onClick={() => normalizedName && setMode('create')}
                            disabled={!isConnected || !normalizedName}
                        >
                            Create New Game
                        </button>

                        <div className="lobby-divider">or</div>

                        <button
                            className="btn btn-secondary"
                            onClick={() => normalizedName && setMode('join')}
                            disabled={!isConnected || !normalizedName}
                        >
                            Join with Code
                        </button>

                        <button
                            className="btn btn-secondary"
                            onClick={() => setMode('estimator')}
                        >
                            AI Compute Estimator
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'estimator') {
        return <AiComputeEstimator onBack={() => setMode(null)} />;
    }

    if (mode === 'create') {
        return (
            <div className="lobby-container">
                <div className="starfield" />
                <div className="panel panel-glow lobby-card">
                    <div className="lobby-header">
                        <h2>Create Game</h2>
                        <p className="lobby-subtitle">as {name}</p>
                    </div>

                    <form onSubmit={handleCreateRoom} className="lobby-form">
                        <div className="input-group">
                            <label className="input-label">Select Game</label>
                            <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className={`btn ${gameType === 'the-mind' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setGameType('the-mind')}
                                    style={{ flex: 1 }}
                                >
                                    The Mind
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${gameType === 'blackjack' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setGameType('blackjack')}
                                    style={{ flex: 1 }}
                                >
                                    Blackjack
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${gameType === 'minimalist' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setGameType('minimalist')}
                                    style={{ flex: 1 }}
                                >
                                    Minimalist
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${gameType === '3d-platform' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setGameType('3d-platform')}
                                    style={{ flex: 1 }}
                                >
                                    3D Platform
                                </button>
                            </div>
                        </div>

                        {error && <div className="text-danger text-center">{error}</div>}

                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Room'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setMode(null);
                                onClearError();
                            }}
                        >
                            Back
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (mode === 'join') {
        return (
            <div className="lobby-container">
                <div className="starfield" />
                <div className="panel panel-glow lobby-card">
                    <div className="lobby-header">
                        <h2>Join Game</h2>
                        <p className="lobby-subtitle">Enter your name and room code</p>
                    </div>

                    <form onSubmit={handleJoinRoom} className="lobby-form">
                        <div className="input-group">
                            <label className="input-label">Your Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Required to join..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={20}
                                disabled={!isConnected || isLoading}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Room Code</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter 6-character code..."
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
                            />
                        </div>

                        {!normalizedName && (
                            <div className="text-warning text-center">Name is required to join.</div>
                        )}

                        {error && <div className="text-danger text-center">{error}</div>}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading || !canJoinRoom}
                        >
                            {isLoading ? 'Joining...' : 'Join Room'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setMode(null);
                                onClearError();
                            }}
                        >
                            Back
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return null;
}
