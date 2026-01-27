import { useEffect, useState, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameTable from './components/GameTable';
import BlackjackTable from './components/BlackjackTable';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import './index.css';

function AppContent() {
  const {
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
    blackjackVoteNextHand,
    blackjackPlaceBet,
    blackjackBegForMoney,
    clearError,
    leaveGame
  } = useSocket();

  const [pendingJoinCode, setPendingJoinCode] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast Helper
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Watch for socket errors and toast them
  useEffect(() => {
    if (error) {
      addToast(error, 'error');
      clearError();
    }
  }, [error, addToast, clearError]);

  // Handle join code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCodeFromUrl = params.get('join');
    if (joinCodeFromUrl) {
      setPendingJoinCode(joinCodeFromUrl.toUpperCase());
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // In active game
  if (gameState && gameState.status !== 'waiting') {
    // Robust check: If gameType is 'blackjack' OR gameState structure implies Blackjack (has dealer)
    if (gameType === 'blackjack' || gameState.dealer) {
      return (
        <>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
          <BlackjackTable
            gameState={gameState}
            onAction={blackjackAction}
            onVoteNextHand={blackjackVoteNextHand}
            onPlaceBet={blackjackPlaceBet}
            onBeg={blackjackBegForMoney}
            onLeave={leaveGame}
          />
        </>
      );
    }

    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <GameTable
          gameState={gameState}
          onPlayCard={playCard}
          onNextLevel={nextLevel}
          onVoteThrowingStar={voteThrowingStar}
          onCancelStarVote={cancelStarVote}
          onLeave={leaveGame}
        />
      </>
    );
  }

  // In waiting room (room created/joined but game not started)
  if (roomCode && players.length > 0) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <WaitingRoom
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          gameType={gameType}
          onStartGame={startGame}
          onLeave={leaveGame}
          error={null} // Handled by toast now
        />
      </>
    );
  }

  // Lobby (no room yet)
  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Lobby
        isConnected={isConnected}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        error={null} // Handled by toast now
        onClearError={clearError}
        initialJoinCode={pendingJoinCode}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <Analytics />
    </ErrorBoundary>
  );
}
