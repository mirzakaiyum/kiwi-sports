/**
 * SportsMonk Provider
 * Fetches and caches cricket teams from SportsMonk API
 * Uses Cloudflare KV for caching with 7-day TTL
 */

// Cache configuration
const CACHE_KEY = 'sportsmonk_teams'
const CACHE_TTL_DAYS = 7
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

// SportsMonk API endpoint
const SPORTSMONK_API_URL = 'https://cricket.sportmonks.com/api/v2.0/teams'

/**
 * Team data from SportsMonk API
 */
export interface SportsMonkTeam {
	id: number
	name: string
	code: string
	image_path: string
	country_id: number
	national_team: boolean
	updated_at: string
}

/**
 * Cached data structure
 */
interface CachedTeams {
	teams: SportsMonkTeam[]
	cachedAt: number // timestamp
}

/**
 * Normalized team for API response
 */
export interface NormalizedTeam {
	id: string
	name: string
	abbrev: string
	logo: string
}

/**
 * Environment bindings type
 */
export interface Env {
	TEAMS_CACHE: KVNamespace
	SPORTMONKS_API_KEY: string
}

/**
 * Fetch all teams from SportsMonk API (handles pagination)
 */
async function fetchTeamsFromAPI(apiKey: string): Promise<SportsMonkTeam[]> {
	const allTeams: SportsMonkTeam[] = []
	let page = 1
	let hasMore = true

	while (hasMore) {
		const url = `${SPORTSMONK_API_URL}?api_token=${apiKey}&page=${page}`
		
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/json',
			}
		})

		if (!response.ok) {
			throw new Error(`SportsMonk API error: ${response.status}`)
		}

		const data = await response.json() as {
			data: SportsMonkTeam[]
			meta?: { pagination?: { current_page: number; total_pages: number } }
		}

		if (data.data && Array.isArray(data.data)) {
			allTeams.push(...data.data)
		}

		// Check for more pages
		const pagination = data.meta?.pagination
		if (pagination && pagination.current_page < pagination.total_pages) {
			page++
		} else {
			hasMore = false
		}
	}

	return allTeams
}

/**
 * Get teams from cache or fetch fresh data
 * Implements lazy refresh - fetches new data only if cache is stale (> 7 days)
 * @param env - Environment bindings
 * @param league - 'international' for national teams, 'other' for franchise/club teams
 */
export async function getCachedTeams(env: Env, league: string = 'international'): Promise<NormalizedTeam[]> {
	// Check if API key is configured
	if (!env.SPORTMONKS_API_KEY) {
		console.warn('SPORTMONKS_API_KEY not configured, returning fallback teams')
		return getFallbackTeams(league)
	}

	// Check if KV is available
	if (!env.TEAMS_CACHE) {
		console.warn('TEAMS_CACHE KV not configured, fetching directly')
		const teams = await fetchTeamsFromAPI(env.SPORTMONKS_API_KEY)
		return normalizeTeams(teams, league)
	}

	try {
		// Try to get from cache
		const cachedData = await env.TEAMS_CACHE.get(CACHE_KEY, 'json') as CachedTeams | null

		if (cachedData) {
			const age = Date.now() - cachedData.cachedAt
			
			// If cache is still fresh, return it
			if (age < CACHE_TTL_MS) {
				console.log(`Returning cached teams (age: ${Math.round(age / 1000 / 60)} minutes)`)
				return normalizeTeams(cachedData.teams, league)
			}
			
			console.log('Cache is stale, refreshing...')
		}

		// Fetch fresh data
		console.log('Fetching fresh teams from SportsMonk API...')
		const freshTeams = await fetchTeamsFromAPI(env.SPORTMONKS_API_KEY)

		// Store in cache
		const cacheData: CachedTeams = {
			teams: freshTeams,
			cachedAt: Date.now()
		}
		
		await env.TEAMS_CACHE.put(CACHE_KEY, JSON.stringify(cacheData))
		console.log(`Cached ${freshTeams.length} teams`)

		return normalizeTeams(freshTeams, league)
	} catch (error) {
		console.error('Error fetching teams:', error)
		
		// Try to return stale cache if available
		try {
			const staleCache = await env.TEAMS_CACHE.get(CACHE_KEY, 'json') as CachedTeams | null
			if (staleCache) {
				console.log('Returning stale cache due to API error')
				return normalizeTeams(staleCache.teams, league)
			}
		} catch {
			// Ignore cache read errors
		}

		// Last resort: return fallback
		return getFallbackTeams(league)
	}
}

/**
 * Force refresh the cache (for manual refresh endpoint)
 */
export async function refreshCache(env: Env): Promise<{ success: boolean; count: number; error?: string }> {
	if (!env.SPORTMONKS_API_KEY) {
		return { success: false, count: 0, error: 'SPORTMONKS_API_KEY not configured' }
	}

	if (!env.TEAMS_CACHE) {
		return { success: false, count: 0, error: 'TEAMS_CACHE KV not configured' }
	}

	try {
		const freshTeams = await fetchTeamsFromAPI(env.SPORTMONKS_API_KEY)
		
		const cacheData: CachedTeams = {
			teams: freshTeams,
			cachedAt: Date.now()
		}
		
		await env.TEAMS_CACHE.put(CACHE_KEY, JSON.stringify(cacheData))
		
		return { success: true, count: freshTeams.length }
	} catch (error) {
		return { success: false, count: 0, error: (error as Error).message }
	}
}

/**
 * Get cache status (for debugging)
 */
export async function getCacheStatus(env: Env): Promise<{
	exists: boolean
	teamCount: number
	cachedAt: string | null
	ageMinutes: number | null
	isStale: boolean
}> {
	if (!env.TEAMS_CACHE) {
		return { exists: false, teamCount: 0, cachedAt: null, ageMinutes: null, isStale: true }
	}

	try {
		const cachedData = await env.TEAMS_CACHE.get(CACHE_KEY, 'json') as CachedTeams | null
		
		if (!cachedData) {
			return { exists: false, teamCount: 0, cachedAt: null, ageMinutes: null, isStale: true }
		}

		const age = Date.now() - cachedData.cachedAt
		
		return {
			exists: true,
			teamCount: cachedData.teams.length,
			cachedAt: new Date(cachedData.cachedAt).toISOString(),
			ageMinutes: Math.round(age / 1000 / 60),
			isStale: age >= CACHE_TTL_MS
		}
	} catch {
		return { exists: false, teamCount: 0, cachedAt: null, ageMinutes: null, isStale: true }
	}
}

/**
 * Normalize SportsMonk teams to our API format
 * @param teams - Raw teams from SportsMonk
 * @param league - 'international' for national teams, 'other' for franchise/club teams
 */
function normalizeTeams(teams: SportsMonkTeam[], league: string = 'international'): NormalizedTeam[] {
	// Filter based on league type
	const isNationalTeam = league !== 'other'
	
	return teams
		.filter(t => t.national_team === isNationalTeam)
		.map(team => ({
			id: team.id.toString(),
			name: team.name,
			abbrev: team.code || team.name.substring(0, 3).toUpperCase(),
			logo: team.image_path
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Fallback teams when API/cache is unavailable
 */
function getFallbackTeams(league: string = 'international'): NormalizedTeam[] {
	if (league === 'other') {
		// Return empty for franchise teams - no sensible fallback
		return []
	}
	
	// National teams fallback
	return [
		{ id: 'ind', name: 'India', abbrev: 'IND', logo: 'https://flagcdn.com/w40/in.png' },
		{ id: 'aus', name: 'Australia', abbrev: 'AUS', logo: 'https://flagcdn.com/w40/au.png' },
		{ id: 'eng', name: 'England', abbrev: 'ENG', logo: 'https://flagcdn.com/w40/gb-eng.png' },
		{ id: 'pak', name: 'Pakistan', abbrev: 'PAK', logo: 'https://flagcdn.com/w40/pk.png' },
		{ id: 'sa', name: 'South Africa', abbrev: 'SA', logo: 'https://flagcdn.com/w40/za.png' },
		{ id: 'nz', name: 'New Zealand', abbrev: 'NZ', logo: 'https://flagcdn.com/w40/nz.png' },
		{ id: 'sl', name: 'Sri Lanka', abbrev: 'SL', logo: 'https://flagcdn.com/w40/lk.png' },
		{ id: 'wi', name: 'West Indies', abbrev: 'WI', logo: 'https://flagcdn.com/w40/jm.png' },
		{ id: 'ban', name: 'Bangladesh', abbrev: 'BAN', logo: 'https://flagcdn.com/w40/bd.png' },
		{ id: 'afg', name: 'Afghanistan', abbrev: 'AFG', logo: 'https://flagcdn.com/w40/af.png' },
		{ id: 'ire', name: 'Ireland', abbrev: 'IRE', logo: 'https://flagcdn.com/w40/ie.png' },
		{ id: 'zim', name: 'Zimbabwe', abbrev: 'ZIM', logo: 'https://flagcdn.com/w40/zw.png' },
	]
}

export default {
	getCachedTeams,
	refreshCache,
	getCacheStatus,
}
