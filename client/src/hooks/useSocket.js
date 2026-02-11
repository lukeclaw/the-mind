import { useState, useEffect, useCallback } from 'react';
import socket from '../socket';

/**
 * Custom hook for Socket.IO connection and game state management
 */
export function useSocket() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [roomCode, setRoomCode] = useState(null);
    const [players, setPlayers] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [gameType, setGameType] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [error, setError] = useState(null);

    // Connection handlers
    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            setError(null);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        function onConnectError(err) {
            setError(`Connection failed: ${err.message}`);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);

        // Connect on mount
        socket.connect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
        };
    }, []);

    // Game event handlers
    useEffect(() => {
        function onPlayerJoined({ players: updatedPlayers }) {
            setPlayers(updatedPlayers);
        }

        function onHostChanged({ hostId }) {
            setIsHost(hostId === socket.id);
        }

        function onPlayerDisconnected({ id }) {
            setPlayers(prev =>
                prev.map(p => p.id === id ? { ...p, connected: false } : p)
            );
            setGameState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map(p =>
                        p.id === id ? { ...p, connected: false } : p
                    )
                };
            });
        }

        function onGameStarted(state) {
            setGameState(state);
        }

        function onCardPlayed({ gameState: newState }) {
            setGameState(newState);
        }

        function onNewLevel(state) {
            setGameState(state);
        }

        function onLevelComplete() {
            setGameState(prev => ({ ...prev, status: 'levelComplete' }));
        }

        function onGameOver({ reason }) {
            setGameState(prev => ({ ...prev, status: 'gameOver', gameOverReason: reason }));
        }

        function onVictory() {
            setGameState(prev => ({ ...prev, status: 'victory' }));
        }

        function onStarVoteUpdate({ needed, voters }) {
            setGameState(prev => ({
                ...prev,
                starVotes: voters,
                starVotesNeeded: needed
            }));
        }

        function onThrowingStarUsed({ gameState: newState }) {
            setGameState(newState);
        }

        function onBlackjackUpdate({ gameState: newState }) {
            setGameState(newState);
        }

        socket.on('playerJoined', onPlayerJoined);
        socket.on('hostChanged', onHostChanged);
        socket.on('playerDisconnected', onPlayerDisconnected);
        socket.on('gameStarted', onGameStarted);
        socket.on('cardPlayed', onCardPlayed);
        socket.on('newLevel', onNewLevel);
        socket.on('levelComplete', onLevelComplete);
        socket.on('gameOver', onGameOver);
        socket.on('victory', onVictory);
        socket.on('starVoteUpdate', onStarVoteUpdate);
        socket.on('throwingStarUsed', onThrowingStarUsed);
        socket.on('blackjackUpdate', onBlackjackUpdate);
        socket.on('minimalistUpdate', ({ gameState: newState }) => setGameState(newState));

        return () => {
            socket.off('playerJoined', onPlayerJoined);
            socket.off('hostChanged', onHostChanged);
            socket.off('playerDisconnected', onPlayerDisconnected);
            socket.off('gameStarted', onGameStarted);
            socket.off('cardPlayed', onCardPlayed);
            socket.off('newLevel', onNewLevel);
            socket.off('levelComplete', onLevelComplete);
            socket.off('gameOver', onGameOver);
            socket.off('victory', onVictory);
            socket.off('starVoteUpdate', onStarVoteUpdate);
            socket.off('throwingStarUsed', onThrowingStarUsed);
            socket.off('blackjackUpdate', onBlackjackUpdate);
            socket.off('minimalistUpdate');
        };
    }, []);

    // Actions
    const createRoom = useCallback((name, gameType = 'the-mind') => {
        return new Promise((resolve, reject) => {
            socket.emit('createRoom', { name, gameType }, (response) => {
                if (response.success) {
                    setRoomCode(response.code);
                    setPlayers(response.players);
                    setIsHost(true);
                    setGameType(response.gameType);
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const joinRoom = useCallback((code, name) => {
        return new Promise((resolve, reject) => {
            socket.emit('joinRoom', { code, name }, (response) => {
                if (response.success) {
                    setRoomCode(response.code);
                    setPlayers(response.players);
                    setIsHost(response.isHost);
                    setGameType(response.gameType);
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const startGame = useCallback(() => {
        return new Promise((resolve, reject) => {
            socket.emit('startGame', null, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const playCard = useCallback((cardValue) => {
        return new Promise((resolve, reject) => {
            socket.emit('playCard', { cardValue }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const nextLevel = useCallback(() => {
        return new Promise((resolve, reject) => {
            socket.emit('nextLevel', null, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const voteThrowingStar = useCallback(() => {
        return new Promise((resolve, reject) => {
            socket.emit('voteThrowingStar', null, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const cancelStarVote = useCallback(() => {
        return new Promise((resolve, reject) => {
            socket.emit('cancelStarVote', null, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const blackjackAction = useCallback((action, payload = {}) => {
        return new Promise((resolve, reject) => {
            socket.emit('blackjackAction', { action, ...payload }, (response) => {
                if (response.success) resolve(response);
                else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const blackjackPlaceBet = useCallback((amount) => {
        return new Promise((resolve, reject) => {
            socket.emit('blackjackPlaceBet', { amount }, (response) => {
                if (response.success) resolve(response);
                else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const blackjackBegForMoney = useCallback((message) => {
        return new Promise((resolve, reject) => {
            socket.emit('blackjackBegForMoney', { message }, (response) => {
                if (response.success) resolve(response);
                else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const blackjackVoteNextHand = useCallback(() => {
        return new Promise((resolve, reject) => {
            socket.emit('blackjackVoteNextHand', null, (response) => {
                if (response.success) resolve(response);
                else {
                    setError(response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const minimalistSubmitScore = useCallback((inkUsed) => {
        return new Promise((resolve, reject) => {
            socket.emit('minimalistSubmitScore', { inkUsed }, (response) => {
                if (response.success) resolve(response);
                else reject(new Error(response.error));
            });
        });
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const leaveGame = useCallback(() => {
        setRoomCode(null);
        setPlayers([]);
        setIsHost(false);
        setGameType(null);
        setGameState(null);
        socket.disconnect();
        socket.connect();
    }, []);

    return {
        isConnected,
        roomCode,
        players,
        isHost,
        gameType,
        gameState,
        error,
        createRoom,
        joinRoom,
        startGame,
        playCard,
        nextLevel,
        voteThrowingStar,
        cancelStarVote,
        blackjackAction,
        blackjackPlaceBet,
        blackjackBegForMoney,
        blackjackVoteNextHand,
        minimalistSubmitScore,
        clearError,
        leaveGame
    };
}
