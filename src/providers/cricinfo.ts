/**
 * Cricbuzz Provider (Using Cricinfo RSS)
 * Fetches live cricket scores from Cricinfo RSS feed as requested by user.
 */

import type { Match, Team, MatchStatus } from '../types.ts'

// User requested to use this specific RSS feed
const RSS_URL = 'https://static.cricinfo.com/rss/livescores.xml'

/**
 * Match type options for Cricket (Legacy export kept for compatibility)
 */
export type CricketMatchType = 'international' | 'league' | 'domestic' | 'women'

/**
 * Cricket leagues/tournaments mapping
 */
export const CRICKET_LEAGUES = [
	{ name: 'International', slug: 'international', type: 'international' },
	{ name: 'Other League', slug: 'other', type: 'league' },
]

/**
 * International cricket team flags mapping
 * Uses flagcdn.com for reliable flag images
 */
const TEAM_FLAGS: Record<string, string> = {
	// Full ICC Member Nations
	'Australia': 'https://flagcdn.com/w40/au.png',
	'England': 'https://flagcdn.com/w40/gb-eng.png',
	'India': 'https://flagcdn.com/w40/in.png',
	'Pakistan': 'https://flagcdn.com/w40/pk.png',
	'South Africa': 'https://flagcdn.com/w40/za.png',
	'New Zealand': 'https://flagcdn.com/w40/nz.png',
	'Sri Lanka': 'https://flagcdn.com/w40/lk.png',
	'West Indies': 'https://flagcdn.com/w40/jm.png', // Using Jamaica flag as WI representative
	'Bangladesh': 'https://flagcdn.com/w40/bd.png',
	'Afghanistan': 'https://flagcdn.com/w40/af.png',
	'Ireland': 'https://flagcdn.com/w40/ie.png',
	'Zimbabwe': 'https://flagcdn.com/w40/zw.png',
	// Associate Nations
	'Scotland': 'https://flagcdn.com/w40/gb-sct.png',
	'Netherlands': 'https://flagcdn.com/w40/nl.png',
	'Namibia': 'https://flagcdn.com/w40/na.png',
	'UAE': 'https://flagcdn.com/w40/ae.png',
	'United Arab Emirates': 'https://flagcdn.com/w40/ae.png',
	'Nepal': 'https://flagcdn.com/w40/np.png',
	'Oman': 'https://flagcdn.com/w40/om.png',
	'USA': 'https://flagcdn.com/w40/us.png',
	'United States': 'https://flagcdn.com/w40/us.png',
	'Canada': 'https://flagcdn.com/w40/ca.png',
	'Kenya': 'https://flagcdn.com/w40/ke.png',
	'Hong Kong': 'https://flagcdn.com/w40/hk.png',
	'Papua New Guinea': 'https://flagcdn.com/w40/pg.png',
}

/**
 * Get flag URL for a team name (case-insensitive partial match)
 */
function getTeamFlag(teamName: string): string | undefined {
	if (!teamName) return undefined
	const normalizedName = teamName.trim()
	
	// Direct match first (optimisation)
	if (TEAM_FLAGS[normalizedName]) {
		return TEAM_FLAGS[normalizedName]
	}
	
	// Check against keys using word boundaries
	// This prevents "Mumbai Indians" from matching "India"
	// and ensures we only catch "India Women", "Australia U19", etc.
	for (const [team, flag] of Object.entries(TEAM_FLAGS)) {
		// regex: \bTeamName\b (case insensitive)
		// escapes special chars if any (though currently our keys are simple)
		if (new RegExp(`\\b${team}\\b`, 'i').test(normalizedName)) {
			return flag
		}
	}
	
	return undefined
}

/**
 * Parse score string like "166/2" or "384/10"
 */
function parseScore(scoreStr: string): string | undefined {
	if (!scoreStr) return undefined
	return scoreStr
}

/**
 * Get abbreviation from name
 */
function getAbbrev(name: string): string {
	if (!name) return 'TBD'
	const words = name.trim().split(/\s+/)
	if (words.length === 1) return name.substring(0, 3).toUpperCase()
	return words.map(w => w[0]).join('').substring(0, 3).toUpperCase()
}

/**
 * Parse a single RSS item to Match object
 */

/**
 * Decode HTML entities like &amp; -> &
 */
function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
}

/**
 * Format score - hide /10 (all out) for cleaner display
 */
function formatScore(score: string): string {
	if (!score) return score
	return score.replace(/\/10/g, '')
}

function parseMatchFromRSSItem(item: string, matchStatus: MatchStatus): Match | null {
	// Extract basic fields
	const titleMatch = item.match(/<title>([^<]+)<\/title>/)
	const guidMatch = item.match(/<guid>([^<]+)<\/guid>/) || item.match(/match\/(\d+)\.html/)
	
	if (!titleMatch || !guidMatch) return null
	
	// Decode HTML entities in title (e.g., &amp; -> &)
	const title = decodeHtmlEntities(titleMatch[1])
	const guidUrl = guidMatch[1]
	
	// Extract ID from URL (e.g. http://www.cricinfo.com/ci/engine/match/1455615.html)
	const idMatch = guidUrl.match(/match\/(\d+)\.html/)
	const matchId = idMatch ? idMatch[1] : guidUrl // Fallback if GUID is just the ID
	
	if (!matchId) return null
	
	// Parse Title: "Australia 166/2 * v England 384/10"
	// Splitting by ' v '
	const sides = title.split(' v ')
	if (sides.length < 2) return null
	
	const team1Raw = sides[0].trim()
	const team2Raw = sides[1].trim()
	
	// Helper to parse team string: "Team Name 123/4 *" or "Team Name 266/6 &  384/10 *"
	const parseTeamString = (str: string) => {
		// Clean up * marker
		const isBatting = str.includes('*')
		const cleanStr = str.replace('*', '').trim()
		
		// Check for multi-innings score with & (e.g., "England 266/6 &  384/10")
		// RSS format: TeamName currentInnings & completedInnings
		// Display format: completedInnings & currentInnings (first innings first)
		const multiInningsMatch = cleanStr.match(/(.+?)\s+(\d+(?:\/\d+)?)\s*&\s+(\d+(?:\/\d+)?)\s*$/)
		
		if (multiInningsMatch) {
			const name = multiInningsMatch[1].trim()
			// RSS format: TeamName firstInnings & secondInnings (e.g., "England 384/10 &  267/7")
			// First innings is already first, just output as-is
			const firstInnings = multiInningsMatch[2]
			const secondInnings = multiInningsMatch[3]
			return {
				name,
				score: formatScore(`${firstInnings} & ${secondInnings}`),
				isBatting
			}
		}
		
		// Extract score: look for digits at the end (single innings)
		const scoreMatch = cleanStr.match(/(.+?)\s+(\d+(?:\/\d+)?)$/)
		
		let name = cleanStr
		let scoreStr = undefined
		
		if (scoreMatch) {
			name = scoreMatch[1].trim()
			scoreStr = scoreMatch[2]
		}
		
		return {
			name,
			score: formatScore(parseScore(scoreStr || '') || ''),
			isBatting
		}
	}
	
	const t1 = parseTeamString(team1Raw)
	const t2 = parseTeamString(team2Raw)
	
	const home: Team = {
		id: `${matchId}-1`,
		name: t1.name,
		abbrev: getAbbrev(t1.name),
		logo: getTeamFlag(t1.name),
		score: t1.score,
		turn: t1.isBatting
	}
	
	const away: Team = {
		id: `${matchId}-2`,
		name: t2.name,
		abbrev: getAbbrev(t2.name),
		logo: getTeamFlag(t2.name),
		score: t2.score,
		turn: t2.isBatting
	}
	
	// Determine status
	let status = matchStatus
	if (matchStatus === 'ongoing') {
		if (!t1.score && !t2.score) {
			status = 'upcoming'
		}
	}
	
	// Format status detail
	// Use abbreviation instead of full name (e.g., "ENG is batting")
	let detail = title
	if (t1.isBatting) detail = `${getAbbrev(t1.name)} is batting`
	else if (t2.isBatting) detail = `${getAbbrev(t2.name)} is batting`

	// Extract date
	const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/)
	let time = undefined
	if (dateMatch) {
		try {
			// Convert "Sun, 05 Jan 2025 ..." to ISO "2025-01-05T..."
			time = new Date(dateMatch[1]).toISOString()
		} catch (e) {
			// keep undefined if parse fails
		}
	}

	return {
		id: matchId,
		home,
		away,
		status,
		statusDetail: detail,
		time,
		league: 'Cricket'
	}
}

/**
 * Fetch matches from Cricinfo RSS
 */
export async function getMatches(
	matchStatus: 'live' | 'recent' | 'upcoming' = 'live',
	_matchType: CricketMatchType = 'international'
): Promise<Match[]> {
	try {
		const response = await fetch(RSS_URL, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			}
		})
		
		if (!response.ok) {
			console.error(`Cricinfo RSS fetch failed: ${response.status}`)
			return []
		}
		
		const xml = await response.text()
		const matches: Match[] = []
		
		// Simple Regex Parsing of XML
		// Match <item> blocks
		const itemRegex = /<item>([\s\S]*?)<\/item>/gi
		let itemMatch
		
		// Determine target status for items based on request
		const itemStatus: MatchStatus = matchStatus === 'live' ? 'ongoing' : 
			matchStatus === 'upcoming' ? 'upcoming' : 'done'
		
		while ((itemMatch = itemRegex.exec(xml)) !== null) {
			const itemContent = itemMatch[1]
			const match = parseMatchFromRSSItem(itemContent, itemStatus)
			if (match) {
				matches.push(match)
			}
		}
		
		return matches
	} catch (error) {
		console.error('Cricinfo RSS error:', error)
		return []
	}
}

/**
 * Get all cricket matches
 */
export async function getScoreboard(
	_sport: string,
	leagueSlug: string,
	_date?: string
): Promise<Match[]> {
	const matches = await getMatches('live')

	// Filter for international matches if requested
	if (leagueSlug === 'international') {
		return matches.filter(m => {
			// Check if at least one team is a known international team
			// This filters out domestic matches like "Mashonaland Eagles v Southern Rocks"
			// unless they happen to have a name collision with a country.
			const homeIsIntl = getTeamFlag(m.home.name) !== undefined
			const awayIsIntl = getTeamFlag(m.away.name) !== undefined
			return homeIsIntl || awayIsIntl
		})
	}

	return matches
}

/**
 * Get cricket teams (Specific International List)
 */
export function getTeams(): { id: string; name: string; abbrev: string }[] {
	return [
		{ id: 'ind', name: 'India', abbrev: 'IND' },
		{ id: 'afg', name: 'Afghanistan', abbrev: 'AFG' },
		{ id: 'ire', name: 'Ireland', abbrev: 'IRE' },
		{ id: 'pak', name: 'Pakistan', abbrev: 'PAK' },
		{ id: 'aus', name: 'Australia', abbrev: 'AUS' },
		{ id: 'sl', name: 'Sri Lanka', abbrev: 'SL' },
		{ id: 'ban', name: 'Bangladesh', abbrev: 'BAN' },
		{ id: 'eng', name: 'England', abbrev: 'ENG' },
		{ id: 'wi', name: 'West Indies', abbrev: 'WI' },
		{ id: 'sa', name: 'South Africa', abbrev: 'SA' },
		{ id: 'zim', name: 'Zimbabwe', abbrev: 'ZIM' },
		{ id: 'nz', name: 'New Zealand', abbrev: 'NZ' },
	]
}

/**
 * Get leagues (Legacy)
 */
export function getLeagues() {
	return CRICKET_LEAGUES
}

export default {
	getMatches,
	getScoreboard,
	getTeams,
	getLeagues,
	CRICKET_LEAGUES,
}
