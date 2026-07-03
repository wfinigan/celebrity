# Celebrity 🌟

A tiny web app for playing the Celebrity name game with friends — no paper
needed.

## How the game works

1. Everyone submits a celebrity name from their own phone.
2. The host reads the full list aloud once or twice.
3. You won't see or hear the names again — remember them!
4. Go around the room guessing who submitted which name.

## How the app works

- **Host** taps "Start a new game" and gets a 4-letter room code + share link.
- **Players** open the link (or enter the code) and submit names anonymously.
  You can submit more than one.
- The host watches the submission count tick up, then hits
  **"Close submissions & reveal"** — submissions lock and the host gets the
  shuffled list to read aloud.
- Games expire automatically after 6 hours.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Locally, game state is kept in memory — no setup
needed.

## Deploying to Vercel

1. Import this repo into Vercel (it's a standard Next.js app, no config
   needed).
2. **Add Redis storage** — required in production, since Vercel serverless
   functions don't share memory:
   - In your Vercel project, go to **Storage → Create Database → Upstash
     Redis** (free tier is plenty).
   - Connect it to the project. This sets the
     `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or
     `KV_REST_API_URL`/`KV_REST_API_TOKEN`) environment variables, which the
     app picks up automatically.
3. Redeploy. Done!

Without Redis the app will still load, but games will randomly "disappear"
because each serverless invocation may land on a different instance.

## Ideas for later

- Multiple rounds / re-open submissions
- Score tracking
- A "read one name at a time" mode with big flashcards
- Kick out duplicate submissions
