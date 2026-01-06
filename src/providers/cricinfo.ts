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
function parseMatchFromRSSItem(item: string, matchStatus: MatchStatus): Match | null {
	// Extract basic fields
	const titleMatch = item.match(/<title>([^<]+)<\/title>/)
	const guidMatch = item.match(/<guid>([^<]+)<\/guid>/) || item.match(/match\/(\d+)\.html/)
	
	if (!titleMatch || !guidMatch) return null
	
	const title = titleMatch[1]
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
	
	// Helper to parse team string: "Team Name 123/4 *"
	const parseTeamString = (str: string) => {
		// Clean up * marker
		const isBatting = str.includes('*')
		const cleanStr = str.replace('*', '').trim()
		
		// Extract score: look for digits at the end
		const scoreMatch = cleanStr.match(/(.+?)\s+(\d+(?:\/\d+)?)$/)
		
		let name = cleanStr
		let scoreStr = undefined
		
		if (scoreMatch) {
			name = scoreMatch[1].trim()
			scoreStr = scoreMatch[2]
		}
		
		return {
			name,
			score: parseScore(scoreStr || ''),
			isBatting
		}
	}
	
	const t1 = parseTeamString(team1Raw)
	const t2 = parseTeamString(team2Raw)
	
	const home: Team = {
		id: `${matchId}-1`,
		name: t1.name,
		abbrev: getAbbrev(t1.name),
		score: t1.score,
		turn: t1.isBatting
	}
	
	const away: Team = {
		id: `${matchId}-2`,
		name: t2.name,
		abbrev: getAbbrev(t2.name),
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
	// User requested to add this info to statusDetail
	let detail = title
	if (t1.isBatting) detail = `${t1.name} is batting`
	else if (t2.isBatting) detail = `${t2.name} is batting`

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
	_leagueSlug: string,
	_date?: string
): Promise<Match[]> {
	// The RSS feed contains a mix. We just return it.
	return getMatches('live')
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
