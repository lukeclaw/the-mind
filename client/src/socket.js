import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Create socket instance
const socket = io(SERVER_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Debug logging in development
if (import.meta.env.DEV) {
    socket.onAny((event, ...args) => {
        console.log(`[Socket] ${event}:`, args);
    });
}

export default socket;
