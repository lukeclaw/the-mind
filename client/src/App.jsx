import { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameTable from './components/GameTable';
import BlackjackTable from './components/BlackjackTable';
import './index.css';

function App() {
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
    blackjackDeal,
    clearError,
    leaveGame
  } = useSocket();

  const [pendingJoinCode, setPendingJoinCode] = useState(null);

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
    if (gameType === 'blackjack') {
      return (
        <BlackjackTable
          gameState={gameState}
          onAction={blackjackAction}
          onDeal={blackjackDeal}
          onLeave={leaveGame}
        />
      );
    }

    return (
      <GameTable
        gameState={gameState}
        onPlayCard={playCard}
        onNextLevel={nextLevel}
        onVoteThrowingStar={voteThrowingStar}
        onCancelStarVote={cancelStarVote}
        onLeave={leaveGame}
      />
    );
  }

  // In waiting room (room created/joined but game not started)
  if (roomCode && players.length > 0) {
    return (
      <WaitingRoom
        roomCode={roomCode}
        players={players}
        isHost={isHost}
        gameType={gameType}
        onStartGame={startGame}
        onLeave={leaveGame}
        error={error}
      />
    );
  }

  // Lobby (no room yet)
  return (
    <Lobby
      isConnected={isConnected}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      error={error}
      onClearError={clearError}
      initialJoinCode={pendingJoinCode}
    />
  );
}

export default App;
