## Quick Start

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

Open `http://localhost:5173`.

## Visual Review Workflow

For UI changes, generate and review screenshots before opening or updating a PR.

```bash
# One-time
npm install
npx playwright install chromium

# Generate screenshots
npm run screenshots
```

Artifacts are written to:

`artifacts/screenshots/latest`

Use these screenshots for design QA/regression checks and summarize relevant visual changes in the PR.

See `tests/SCREENSHOTS.md` for scenario details.

## Deployment

See deployment instructions in the server and client READMEs.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Hosting**: Fly.io (backend) + Vercel/Netlify (frontend)
