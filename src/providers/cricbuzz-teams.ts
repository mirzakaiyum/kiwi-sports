/**
 * Cricbuzz Teams Provider
 * Scrapes cricket teams from Cricbuzz using regex-based HTML parsing
 * Zero external dependencies.
 * 
 * Sources:
 * - International: https://www.cricbuzz.com/cricket-team
 * - League: https://www.cricbuzz.com/cricket-team/league
 */

// Cricbuzz URLs
const CRICBUZZ_INTERNATIONAL_URL = 'https://www.cricbuzz.com/cricket-team'
const CRICBUZZ_LEAGUE_URL = 'https://www.cricbuzz.com/cricket-team/league'

/**
 * Normalized team for API response
 */
export interface CricbuzzTeam {
	id: string
	name: string
	abbrev: string
	slug: string
	logo?: string
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
}

/**
 * Generate abbreviation from team name
 */
function getAbbrev(name: string): string {
	if (!name) return 'TBD'
	// Common abbreviations
	const abbrevMap: Record<string, string> = {
		'India': 'IND',
		'Australia': 'AUS',
		'England': 'ENG',
		'Pakistan': 'PAK',
		'South Africa': 'SA',
		'New Zealand': 'NZ',
		'Sri Lanka': 'SL',
		'West Indies': 'WI',
		'Bangladesh': 'BAN',
		'Afghanistan': 'AFG',
		'Ireland': 'IRE',
		'Zimbabwe': 'ZIM',
		'United States of America': 'USA',
		'United Arab Emirates': 'UAE',
		'Hong Kong, China': 'HK',
		'Papua New Guinea': 'PNG',
		'Chennai Super Kings': 'CSK',
		'Mumbai Indians': 'MI',
		'Royal Challengers Bengaluru': 'RCB',
		'Kolkata Knight Riders': 'KKR',
		'Delhi Capitals': 'DC',
		'Rajasthan Royals': 'RR',
		'Punjab Kings': 'PBKS',
		'Sunrisers Hyderabad': 'SRH',
		'Gujarat Titans': 'GT',
		'Lucknow Super Giants': 'LSG',
		'Lahore Qalandars': 'LQ',
		'Peshawar Zalmi': 'PZ',
		'Islamabad United': 'IU',
		'Karachi Kings': 'KK',
		'Quetta Gladiators': 'QG',
		'Multan Sultans': 'MS',
	}
	
	if (abbrevMap[name]) return abbrevMap[name]
	
	// Generate from name: take first letter of each word (max 4)
	const words = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/)
	if (words.length === 1) return words[0].substring(0, 3).toUpperCase()
	return words.map(w => w[0]).join('').substring(0, 4).toUpperCase()
}

/**
 * Parse teams from Cricbuzz HTML using regex
 * The page structure is: <a href="/cricket-team/{slug}/{id}"><div>...<img src="logo.jpg"/>...<span>Team Name</span>...</div></a>
 */
function parseTeamsFromHTML(html: string): CricbuzzTeam[] {
	const teams: CricbuzzTeam[] = []
	const seenIds = new Set<string>()
	
	// Navigation labels to skip
	const skipLabels = new Set([
		'International', 'Domestic', 'League', 'Women', 
		'Test Teams', 'Associate Teams', 'League Teams'
	])
	
	// Match full anchor tag with team URL pattern
	const anchorRegex = /<a[^>]*href=["']\/cricket-team\/([a-z0-9-]+)\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi
	
	let match
	while ((match = anchorRegex.exec(html)) !== null) {
		const [, slug, id, innerHtml] = match
		
		// Extract team name from <span> tags first, then fallback to stripping all tags
		let name = ''
		const spanMatch = innerHtml.match(/<span[^>]*>([^<]+)<\/span>/i)
		if (spanMatch) {
			name = decodeHtmlEntities(spanMatch[1].trim())
		} else {
			name = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '').trim())
		}
		
		// Extract logo from <img> tag
		let logo: string | undefined
		const imgMatch = innerHtml.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)
		if (imgMatch) {
			logo = imgMatch[1]
			if (logo.startsWith('/')) {
				logo = 'https://www.cricbuzz.com' + logo
			}
		}
		
		// Skip navigation links, empty names, and duplicates
		if (name && !seenIds.has(id) && !skipLabels.has(name)) {
			seenIds.add(id)
			teams.push({
				id,
				name,
				abbrev: getAbbrev(name),
				slug,
				logo,
			})
		}
	}
	
	// Sort teams alphabetically by name
	teams.sort((a, b) => a.name.localeCompare(b.name))
	
	return teams
}

/**
 * Fetch and parse teams from Cricbuzz
 */
async function fetchTeamsFromCricbuzz(url: string): Promise<CricbuzzTeam[]> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
			}
		})
		
		if (!response.ok) {
			console.error(`Cricbuzz fetch failed: ${response.status}`)
			return []
		}
		
		const html = await response.text()
		return parseTeamsFromHTML(html)
	} catch (error) {
		console.error('Error fetching from Cricbuzz:', error)
		return []
	}
}

/**
 * Get cricket teams from Cricbuzz
 * @param league - 'international' for national teams, 'other' for franchise/club teams
 */
export async function getTeams(league: string = 'international'): Promise<CricbuzzTeam[]> {
	// Fetch both international and league teams to ensure we have everything
	// The league param is somewhat redundant now if we always fetch all, 
	// but we can filter if needed for optimization broadly.
	// For now, let's just fetch what is requested or all if widely needed.
	
	// Actually, original design was:
	const isLeague = league === 'other'
	const url = isLeague ? CRICBUZZ_LEAGUE_URL : CRICBUZZ_INTERNATIONAL_URL
	
	const teams = await fetchTeamsFromCricbuzz(url)
	
	// Return fallback if scraping fails entirely
	if (teams.length === 0) {
		return getFallbackTeams(league)
	}
	
	return teams
}

// In-memory cache for team logos (name -> logo URL)
let teamLogoCache: Map<string, string> = new Map()
let cacheInitialized = false
let cacheInitPromise: Promise<void> | null = null

/**
 * Initialize the team logo cache by fetching both international and league teams
 */
async function initLogoCache(): Promise<void> {
	if (cacheInitialized) return
	
	// Prevent multiple simultaneous initializations
	if (cacheInitPromise) {
		await cacheInitPromise
		return
	}
	
	cacheInitPromise = (async () => {
		try {
			// Fetch both international and league teams
			const [international, league] = await Promise.all([
				fetchTeamsFromCricbuzz(CRICBUZZ_INTERNATIONAL_URL),
				fetchTeamsFromCricbuzz(CRICBUZZ_LEAGUE_URL)
			])
			
			const allTeams = [...international, ...league]
			
			// Build name -> logo map (case-insensitive)
			for (const team of allTeams) {
				if (team.logo) {
					teamLogoCache.set(team.name.toLowerCase(), team.logo)
					// Also add by slug for partial matching
					teamLogoCache.set(team.slug, team.logo)
				}
			}
			
			console.log(`Logo cache initialized with ${teamLogoCache.size} teams`)
			cacheInitialized = true
		} catch (error) {
			console.error('Failed to initialize logo cache:', error)
		}
	})()
	
	await cacheInitPromise
}

/**
 * Look up a team logo from the cache
 * Uses case-insensitive matching and partial matching
 * Returns undefined if no match found
 */
export async function getTeamLogo(teamName: string): Promise<string | undefined> {
	if (!teamName) return undefined
	
	// Initialize cache if needed
	if (!cacheInitialized) {
		await initLogoCache()
	}
	
	const lowerName = teamName.toLowerCase().trim()
	
	// Exact match first
	if (teamLogoCache.has(lowerName)) {
		return teamLogoCache.get(lowerName)
	}
	
	// Partial match - check if any cached team name is contained in the search name or vice versa
	for (const [cachedName, logo] of teamLogoCache.entries()) {
		if (lowerName.includes(cachedName) || cachedName.includes(lowerName)) {
			return logo
		}
	}
	
	return undefined
}

