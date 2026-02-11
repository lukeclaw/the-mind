# Screenshot Pipeline

This repo includes a Playwright screenshot pipeline for visual review/debugging.

## One-time setup

```powershell
npm install
npx playwright install chromium
```

## Generate screenshots

```powershell
npm run screenshots
```

Outputs are written to:

`artifacts/screenshots/latest`

Current captures include:

- Lobby (desktop)
- Lobby (mobile)
- Waiting room (host)
- Waiting room (3 players)
- Blackjack table pre-bet (host)
- Blackjack bet drawer open
- Blackjack multiplayer cards (host view)
- Blackjack multiplayer cards (player 2 view)
- Blackjack mobile (host)
- Blackjack round-over result card
