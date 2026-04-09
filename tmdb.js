// tmdb.js — TMDB API integration for Star Search addon
// Handles person search, movie/TV credits, and IMDB ID lookups

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

// Simple in-memory cache with TTL (5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) {
        return entry.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, time: Date.now() });
    // Prevent unbounded growth — evict oldest if over 500 entries
    if (cache.size > 500) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
}

/**
 * Make a TMDB API request
 */
async function tmdbFetch(path, params = {}) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        throw new Error('TMDB_API_KEY is not set. Please create a .env file.');
    }

    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set('api_key', apiKey);
    for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val);
    }

    const cacheKey = url.toString();
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`TMDB API error: ${res.status} ${res.statusText} for ${path}`);
    }

    const data = await res.json();
    setCache(cacheKey, data);
    return data;
}

/**
 * Search for a person (actor/director) by name
 * Returns the top result (most popular match)
 */
async function searchPerson(query) {
    const data = await tmdbFetch('/search/person', { query });
    if (!data.results || data.results.length === 0) {
        return null;
    }
    // Return the most popular match
    return data.results[0];
}

/**
 * Get movie credits for a person
 * Returns combined cast + directing crew roles, sorted by popularity
 */
async function getMovieCredits(personId) {
    const data = await tmdbFetch(`/person/${personId}/movie_credits`);
    const credits = [];
    const seenIds = new Set();

    // Add cast credits
    if (data.cast) {
        for (const item of data.cast) {
            if (!seenIds.has(item.id) && item.title) {
                seenIds.add(item.id);
                credits.push({
                    tmdbId: item.id,
                    title: item.title,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    releaseDate: item.release_date,
                    popularity: item.popularity || 0,
                    voteAverage: item.vote_average,
                    role: item.character ? `as ${item.character}` : 'Cast',
                    mediaType: 'movie'
                });
            }
        }
    }

    // Add directing credits (crew where job === "Director")
    if (data.crew) {
        for (const item of data.crew) {
            if (!seenIds.has(item.id) && item.title && item.job === 'Director') {
                seenIds.add(item.id);
                credits.push({
                    tmdbId: item.id,
                    title: item.title,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    releaseDate: item.release_date,
                    popularity: item.popularity || 0,
                    voteAverage: item.vote_average,
                    role: 'Director',
                    mediaType: 'movie'
                });
            }
        }
    }

    // Sort by popularity (most popular first), then cap at 50
    credits.sort((a, b) => b.popularity - a.popularity);
    return credits.slice(0, 50);
}

/**
 * Get TV credits for a person
 * Returns combined cast + directing crew roles, sorted by popularity
 */
async function getTvCredits(personId) {
    const data = await tmdbFetch(`/person/${personId}/tv_credits`);
    const credits = [];
    const seenIds = new Set();

    // Add cast credits
    if (data.cast) {
        for (const item of data.cast) {
            if (!seenIds.has(item.id) && item.name) {
                seenIds.add(item.id);
                credits.push({
                    tmdbId: item.id,
                    title: item.name,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    firstAirDate: item.first_air_date,
                    popularity: item.popularity || 0,
                    voteAverage: item.vote_average,
                    role: item.character ? `as ${item.character}` : 'Cast',
                    mediaType: 'tv'
                });
            }
        }
    }

    // Add directing credits
    if (data.crew) {
        for (const item of data.crew) {
            if (!seenIds.has(item.id) && item.name && item.job === 'Director') {
                seenIds.add(item.id);
                credits.push({
                    tmdbId: item.id,
                    title: item.name,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    firstAirDate: item.first_air_date,
                    popularity: item.popularity || 0,
                    voteAverage: item.vote_average,
                    role: 'Director',
                    mediaType: 'tv'
                });
            }
        }
    }

    credits.sort((a, b) => b.popularity - a.popularity);
    return credits.slice(0, 50);
}

/**
 * Batch fetch IMDB IDs for a list of credits
 * Uses concurrency limiting to avoid TMDB rate limits
 */
async function enrichWithImdbIds(credits) {
    const CONCURRENCY = 5;
    const results = [];

    for (let i = 0; i < credits.length; i += CONCURRENCY) {
        const batch = credits.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (credit) => {
            try {
                const endpoint = credit.mediaType === 'movie'
                    ? `/movie/${credit.tmdbId}/external_ids`
                    : `/tv/${credit.tmdbId}/external_ids`;
                const extData = await tmdbFetch(endpoint);
                return {
                    ...credit,
                    imdbId: extData.imdb_id || null
                };
            } catch (err) {
                console.warn(`Failed to get external IDs for ${credit.mediaType}/${credit.tmdbId}: ${err.message}`);
                return { ...credit, imdbId: null };
            }
        });
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
    }

    // Filter out entries without IMDB IDs (Stremio needs them)
    return results.filter(c => c.imdbId);
}

/**
 * Convert a credit object to a Stremio Meta Preview Object
 */
function creditToMeta(credit) {
    const meta = {
        id: credit.imdbId,
        type: credit.mediaType === 'movie' ? 'movie' : 'series',
        name: credit.title,
        posterShape: 'poster',
    };

    // Poster
    if (credit.posterPath) {
        meta.poster = `${TMDB_IMG_BASE}/w500${credit.posterPath}`;
    }

    // Description with role info
    const parts = [];
    if (credit.role) parts.push(credit.role);
    if (credit.overview) parts.push(credit.overview);
    meta.description = parts.join(' — ');

    // Release year
    const dateStr = credit.releaseDate || credit.firstAirDate;
    if (dateStr) {
        meta.releaseInfo = dateStr.substring(0, 4);
    }

    // Rating
    if (credit.voteAverage) {
        meta.imdbRating = String(credit.voteAverage.toFixed(1));
    }

    return meta;
}

/**
 * Get poster URL for a person
 */
function getPersonPoster(person) {
    if (person.profile_path) {
        return `${TMDB_IMG_BASE}/w500${person.profile_path}`;
    }
    return null;
}

module.exports = {
    searchPerson,
    getMovieCredits,
    getTvCredits,
    enrichWithImdbIds,
    creditToMeta,
    getPersonPoster,
};
