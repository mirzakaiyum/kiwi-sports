/**
 * Match status types
 */
export type MatchStatus = 'upcoming' | 'ongoing' | 'done'

/**
 * Team information
 */
export interface Team {
	id: string
	name: string
	abbrev: string
	logo?: string
	score?: string
	turn?: boolean
}

/**
 * Single match/event data
 */
export interface Match {
	id: string
	home: Team
	away: Team
	status: MatchStatus
	statusDetail: string
	time?: string
	venue?: string
	broadcast?: string
	league?: string
}

/**
 * League configuration (under a sport)
 */
export interface LeagueConfig {
	name: string
	league: string // ESPN league code
	slug: string
}

/**
 * Sport configuration with nested leagues
 */
export interface SportConfig {
	name: string
	sport: string // ESPN sport path
	slug: string
	leagues: LeagueConfig[]
}

/**
 * Query parameters for API requests
 */
export interface QueryParams {
	sport?: string
	league?: string
	team?: string
	status?: MatchStatus | 'all'
	date?: string
}

/**
 * API Response structure
 */
export interface ApiResponse {
	meta: {
		sport: string
		league: string
		time: string
		count: number
		status?: string
	}
	matches: Match[]
}

/**
 * Map ESPN status to our status type
 */
export function mapEspnStatus(espnStatus: string): MatchStatus {
	const status = espnStatus.toLowerCase()
	if (status.includes('final') || status.includes('end') || status.includes('ft') || status.includes('post')) {
		return 'done'
	}
	if (
		status.includes('progress') ||
		status.includes('live') ||
		status.includes('halftime') ||
		status.includes('in ')
	) {
		return 'ongoing'
	}
	return 'upcoming'
}

/**
 * Filter matches by status
 */
export function filterByStatus(matches: Match[], status: MatchStatus | 'all'): Match[] {
	if (status === 'all') return matches
	return matches.filter((m) => m.status === status)
}

/**
 * Filter matches by team(s) (case-insensitive, exact match)
 * Supports comma-separated team names/abbreviations for multiselect
 */
export function filterByTeam(matches: Match[], teamSearch: string): Match[] {
	// Split by comma and trim each team, filter out empty strings
	const teams = teamSearch.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
	
	if (teams.length === 0) return matches
	
	return matches.filter((m) => {
		const homeName = m.home.name
		const homeAbbrev = m.home.abbrev
		const awayName = m.away.name
		const awayAbbrev = m.away.abbrev
		
		// Match if search term appears as a whole word in names
		// This allows "Bangladesh" to match "Bangladesh Under-19s"
		// But prevents "India" from matching "Mumbai Indians"
		return teams.some(search => {
			// Escape special characters in search string
			const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			const regex = new RegExp(`\\b${escapedSearch}\\b`, 'i')
			
			return regex.test(homeName) || 
				   regex.test(homeAbbrev) || 
				   regex.test(awayName) || 
				   regex.test(awayAbbrev)
		})
	})
}
