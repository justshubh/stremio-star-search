# ⭐ Star Search — Stremio Addon

Search for any **actor or director** by name in Stremio and instantly browse their complete filmography — separated into **Movies** and **TV Shows** catalogs.

Powered by [TMDB](https://www.themoviedb.org/).

## Features

- 🔍 Search by actor or director name
- 🎬 Browse their **Movies** catalog
- 📺 Browse their **TV Shows** catalog
- ⭐ Results sorted by popularity
- 🔗 Uses IMDB IDs so other Stremio addons (Torrentio, etc.) can provide streams
- 💾 In-memory caching to avoid redundant API calls

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (create an account → Settings → API)

## Setup

1. **Clone / download this addon:**

   ```bash
   cd stremio-star-search
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create your environment file:**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and paste your TMDB API key:

   ```
   TMDB_API_KEY=abc123your_key_here
   ```

4. **Start the addon:**

   ```bash
   npm start
   ```

   You'll see output like:

   ```
   ⭐ Star Search — Stremio Addon
   Addon running at: http://127.0.0.1:7000
   ```

## Install in Stremio

1. Open Stremio (desktop app or [web.stremio.com](https://web.stremio.com))
2. Go to the **Addons** section (puzzle piece icon)
3. In the search/URL bar at the top, paste:

   ```
   http://127.0.0.1:7000/manifest.json
   ```

4. Click **Install**

## Usage

1. Open Stremio and use the **Search** bar
2. Type an actor or director name (e.g., "Brad Pitt", "Christopher Nolan")
3. You'll see two new catalogs in the search results:
   - **Star Search — Movies**: All their movies
   - **Star Search — TV Shows**: All their TV shows
4. Click any title to view details and available streams

## How It Works

```
User searches "Brad Pitt"
       │
       ▼
┌─────────────────────┐
│  TMDB: Search Person │ ──▶ Returns person ID + profile
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  TMDB: Get Credits   │ ──▶ Movie credits + TV credits
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  TMDB: External IDs  │ ──▶ Maps each title to an IMDB ID
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Stremio Catalogs    │ ──▶ Movies catalog + TV Shows catalog
└─────────────────────┘
```

## Notes

- This addon provides **catalogs only** (filmography listings). It does NOT provide streams. You need other addons like Torrentio or Cinemeta installed in Stremio to watch content.
- Results are capped at 50 per catalog, sorted by popularity.
- API responses are cached for 5 minutes to reduce TMDB calls.

## License

MIT
=======
# stremio-star-search

