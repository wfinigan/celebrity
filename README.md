# Celebrity 🌟

A tiny web app for playing the Celebrity name game with friends — no paper
needed. There's exactly one game at a time; everyone plays together in the
same room.

## How the game works

1. Everyone submits a celebrity name from their own phone.
2. One person (the host) reads the list aloud, once or twice.
3. You won't see or hear the names again — remember them!
4. Go around the room guessing who submitted which name. The guessing all
   happens in person — the app is just the hat.

## How the app works

- **Players** just open the site and put names in the hat, anonymously.
  You can submit more than one.
- **The host** goes to `/host`, taps "Start a new game", watches the
  submission count tick up, then hits **"Close submissions & start
  reading"**.
- The host reads the names as flashcards, **one at a time, never the whole
  list at once**, and can go through the shuffled list **at most twice**.
  Progress is enforced server-side, so refreshing the page doesn't reset it —
  the host is playing too and gets no unfair advantage. After the second
  pass the list is gone for good.
- "Start a new game" empties the hat for the next round. The game expires on
  its own after 6 hours.
- Want someone other than the host to read? Just hand them the host's phone.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 (players) and http://localhost:3000/host (host).
Locally, game state is kept in memory — no setup needed.

## Deploying to Vercel

1. Import this repo into Vercel (it's a standard Next.js app, no config
   needed).
2. **Add Redis storage** — required in production, since Vercel serverless
   functions don't share memory:
   - In your Vercel project, go to **Storage → Create Database → Upstash
     Redis** (free tier is plenty).
   - Connect it to the project. This sets the
     `KV_REST_API_URL`/`KV_REST_API_TOKEN` environment variables, which the
     app picks up automatically.
3. Redeploy. Done!

On Vercel the app refuses to start without those variables (a clear error
beats games silently disappearing). Locally it uses an in-memory store, so
no setup is needed for development.

## Ideas for later

- A random-reader picker
- Score tracking
- Kick out duplicate submissions
