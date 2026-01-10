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
 * Sports and their leagues hierarchy
 */
export const SPORTS: SportConfig[] = [
	{
		name: 'Baseball',
		sport: 'baseball',
		slug: 'baseball',
		leagues: [{ name: 'MLB', league: 'mlb', slug: 'mlb' }],
	},
	{
		name: 'Basketball',
		sport: 'basketball',
		slug: 'basketball',
		leagues: [
			{ name: 'NBA', league: 'nba', slug: 'nba' },
			{ name: 'WNBA', league: 'wnba', slug: 'wnba' },
		],
	},
	{
		name: 'Cricket',
		sport: 'cricket',
		slug: 'cricket',
		leagues: [
			{ name: 'International', league: 'international', slug: 'international' },
			{ name: 'Other League', league: 'other', slug: 'other' },
		],
	},
	{
		name: 'Football',
		sport: 'football',
		slug: 'football',
		leagues: [
			{ name: 'NFL', league: 'nfl', slug: 'nfl' },
		],
	},
	{
		name: 'Golf',
		sport: 'golf',
		slug: 'golf',
		leagues: [
			{ name: 'PGA Tour', league: 'pga', slug: 'pga' },
			{ name: 'LPGA Tour', league: 'lpga', slug: 'lpga' },
			{ name: 'European Tour', league: 'eur', slug: 'eur' },
			{ name: 'Champions Tour', league: 'champions-tour', slug: 'champions' },
		],
	},
	{
		name: 'Hockey',
		sport: 'hockey',
		slug: 'hockey',
		leagues: [{ name: 'NHL', league: 'nhl', slug: 'nhl' }],
	},
	{
		name: 'MMA',
		sport: 'mma',
		slug: 'mma',
		leagues: [{ name: 'UFC', league: 'ufc', slug: 'ufc' }],
	},
	{
		name: 'Racing',
		sport: 'racing',
		slug: 'racing',
		leagues: [
			{ name: 'Formula 1', league: 'f1', slug: 'f1' },
			{ name: 'NASCAR Cup', league: 'nascar-premier', slug: 'nascar' },
			{ name: 'IndyCar', league: 'irl', slug: 'indycar' },
		],
	},
	{
		name: 'Rugby',
		sport: 'rugby',
		slug: 'rugby',
		leagues: [{ name: 'Rugby Union', league: 'rugby-union', slug: 'rugby-union' }],
	},
	{
		name: 'Soccer',
		sport: 'soccer',
		slug: 'soccer',
		leagues: [
			{ name: 'Premier League', league: 'eng.1', slug: 'epl' },
			{ name: 'Championship', league: 'eng.2', slug: 'championship' },
			{ name: 'La Liga', league: 'esp.1', slug: 'laliga' },
			{ name: 'Bundesliga', league: 'ger.1', slug: 'bundesliga' },
			{ name: 'Serie A', league: 'ita.1', slug: 'seriea' },
			{ name: 'Ligue 1', league: 'fra.1', slug: 'ligue1' },
			{ name: 'Eredivisie', league: 'ned.1', slug: 'eredivisie' },
			{ name: 'Primeira Liga', league: 'por.1', slug: 'portugal' },
			{ name: 'Scottish Premiership', league: 'sco.1', slug: 'scottish' },
			{ name: 'Brasileirão', league: 'bra.1', slug: 'brazil' },
			{ name: 'Liga MX', league: 'mex.1', slug: 'ligamx' },
			{ name: 'MLS', league: 'usa.1', slug: 'mls' },
			{ name: 'NWSL', league: 'usa.nwsl', slug: 'nwsl' },
			{ name: 'Champions League', league: 'uefa.champions', slug: 'ucl' },
			{ name: 'Europa League', league: 'uefa.europa', slug: 'uel' },
			{ name: 'World Cup', league: 'fifa.world', slug: 'worldcup' },
			{ name: 'Copa Libertadores', league: 'conmebol.libertadores', slug: 'libertadores' },
		],
	},
	{
		name: 'Tennis',
		sport: 'tennis',
		slug: 'tennis',
		leagues: [
			{ name: 'ATP', league: 'atp', slug: 'atp' },
			{ name: 'WTA', league: 'wta', slug: 'wta' },
		],
	},
]

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
 * Get sport config by slug
 */
export function getSportBySlug(slug: string): SportConfig | undefined {
	return SPORTS.find((s) => s.slug === slug.toLowerCase())
}

/**
 * Get league config by sport and league slug
 */
export function getLeagueConfig(
	sportSlug: string,
	leagueSlug: string
): { sport: SportConfig; league: LeagueConfig } | undefined {
	const sport = getSportBySlug(sportSlug)
	if (!sport) return undefined
	const league = sport.leagues.find((l) => l.slug === leagueSlug.toLowerCase())
	if (!league) return undefined
	return { sport, league }
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
