#!/usr/bin/env node

// addon.js — Stremio Star Search Addon
// Search for an actor or director to browse their full filmography

require('dotenv').config();

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const {
    searchPerson,
    getMovieCredits,
    getTvCredits,
    enrichWithImdbIds,
    creditToMeta,
    getPersonPoster,
} = require('./tmdb');

// ─── Manifest ────────────────────────────────────────────────────────────────

const manifest = {
    id: 'community.starsearch',
    version: '1.0.0',
    name: 'Star Search',
    description: 'Search by actor or director name to browse their complete filmography — movies and TV shows powered by TMDB.',
    logo: 'https://img.icons8.com/fluency/240/star.png',
    resources: ['catalog'],
    types: ['movie', 'series'],
    catalogs: [
        {
            id: 'star-search-movies',
            type: 'movie',
            name: 'Star Search — Movies',
            extra: [
                { name: 'search', isRequired: true },
                { name: 'skip', isRequired: false }
            ]
        },
        {
            id: 'star-search-series',
            type: 'series',
            name: 'Star Search — TV Shows',
            extra: [
                { name: 'search', isRequired: true },
                { name: 'skip', isRequired: false }
            ]
        }
    ],
    behaviorHints: {
        adult: false,
        p2p: false,
    }
};

// ─── Catalog Handler ─────────────────────────────────────────────────────────

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async (args) => {
    const { type, id, extra } = args;

    // Only respond to our catalog IDs
    if (id !== 'star-search-movies' && id !== 'star-search-series') {
        return { metas: [] };
    }

    // Must have a search query
    const searchQuery = extra && extra.search;
    if (!searchQuery) {
        return { metas: [] };
    }

    console.log(`[Star Search] Searching for "${searchQuery}" (${type})`);

    try {
        // 1. Search for the person on TMDB
        const person = await searchPerson(searchQuery);
        if (!person) {
            console.log(`[Star Search] No person found for "${searchQuery}"`);
            return { metas: [] };
        }

        console.log(`[Star Search] Found: ${person.name} (TMDB ID: ${person.id}, known for: ${person.known_for_department})`);

        // 2. Get credits based on catalog type
        let credits;
        if (type === 'movie' && id === 'star-search-movies') {
            credits = await getMovieCredits(person.id);
        } else if (type === 'series' && id === 'star-search-series') {
            credits = await getTvCredits(person.id);
        } else {
            return { metas: [] };
        }

        if (credits.length === 0) {
            console.log(`[Star Search] No ${type} credits found for ${person.name}`);
            return { metas: [] };
        }

        console.log(`[Star Search] Found ${credits.length} ${type} credits for ${person.name}`);

        // 3. Enrich credits with IMDB IDs (needed for Stremio)
        const enrichedCredits = await enrichWithImdbIds(credits);

        console.log(`[Star Search] ${enrichedCredits.length} credits have IMDB IDs`);

        // 4. Handle pagination (skip)
        const skip = extra.skip ? parseInt(extra.skip, 10) : 0;
        const pageSize = 100;
        const paged = enrichedCredits.slice(skip, skip + pageSize);

        // 5. Convert to Stremio Meta Preview Objects
        const metas = paged.map(creditToMeta);

        return { metas };

    } catch (err) {
        console.error(`[Star Search] Error:`, err.message);
        return { metas: [] };
    }
});

// ─── Export Addon Interface (for serverless / Vercel) ────────────────────────

const addonInterface = builder.getInterface();
module.exports = addonInterface;

// ─── Start Server (local development only) ───────────────────────────────────

if (require.main === module) {
    const PORT = process.env.PORT || 7777;

    serveHTTP(addonInterface, { port: PORT });

    console.log(`
╔══════════════════════════════════════════════════════════╗
║               ⭐ Star Search — Stremio Addon            ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Addon running at:                                       ║
║  http://127.0.0.1:${String(PORT).padEnd(5)}                                ║
║                                                          ║
║  Install in Stremio:                                     ║
║  http://127.0.0.1:${String(PORT).padEnd(5)}/manifest.json                 ║
║                                                          ║
║  Search for any actor or director in Stremio             ║
║  to see their complete filmography!                      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
}
