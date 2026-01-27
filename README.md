# The Mind - Multiplayer Card Game

A web-based multiplayer implementation of "The Mind" cooperative card game.

## 🎮 How to Play

1. Create a room and share the code with friends
2. Each level, players receive N cards (Level 1 = 1 card, Level 2 = 2 cards, etc.)
3. Play cards in ascending order **without communicating**
4. If someone plays a card while lower cards exist → lose a life
5. Complete all levels to win!

## 🚀 Quick Start

### Local Development

```bash
# Start the server
cd server
npm install
npm start

# Start the client (in another terminal)
cd client
npm install
npm run dev
```

Open http://localhost:5173

## 🌐 Deployment

See deployment instructions in the server and client READMEs.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Hosting**: Fly.io (backend) + Vercel/Netlify (frontend)
