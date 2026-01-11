/**
 * ESPN Public API Provider
 * Uses the free ESPN API endpoints for sports data
 * @see https://github.com/pseudo-r/Public-ESPN-API
 */

import type { Match, Team, SportConfig, LeagueConfig, MatchStatus } from '../types.ts'
import { getLeagueConfig, SPORTS_CONFIG } from '../sports-config.ts'

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports'

/**
 * ESPN API response types (simplified)
 */
interface EspnTeam {
	id: string
	name: string
	abbreviation: string
	displayName: string
	logo?: string
	logos?: { href: string }[]
	score?: string
}

interface EspnCompetitor {
	id: string
	team: EspnTeam
	score?: string
	homeAway: 'home' | 'away'
}

interface EspnStatus {
	type: {
		name: string
		state: string
		completed: boolean
		description: string
		detail: string
		shortDetail: string
	}
}

interface EspnCompetition {
	id: string
	competitors: EspnCompetitor[]
	status: EspnStatus
	venue?: { fullName: string }
	broadcasts?: { names: string[] }[]
}

interface EspnEvent {
	id: string
	name: string
	competitions: EspnCompetition[]
}

interface EspnScoreboardResponse {
	events: EspnEvent[]
	leagues?: { name: string; abbreviation: string }[]
}

interface EspnTeamsResponse {
	sports: {
		leagues: {
			teams: { team: EspnTeam }[]
		}[]
	}[]
}

/**
 * Fetch from ESPN API
 */
async function fetchEspn<T>(path: string): Promise<T> {
	const url = `${BASE_URL}/${path}`
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
	}
	return response.json()
}

/**
 * Get list of sports with their leagues
 */
export function getSports(): SportConfig[] {
	return SPORTS_CONFIG
}

/**
 * Get leagues for a specific sport
 */
export function getLeagues(sportSlug: string): LeagueConfig[] {
	const sport = SPORTS_CONFIG.find((s) => s.slug === sportSlug.toLowerCase())
	return sport?.leagues || []
}

/**
 * Get teams for a specific sport/league
 */
export async function getTeams(
	sportSlug: string,
	leagueSlug: string
): Promise<{ id: string; name: string; abbrev: string; logo?: string }[]> {
	const config = getLeagueConfig(sportSlug, leagueSlug)
	if (!config) {
		throw new Error(`Unknown sport/league: ${sportSlug}/${leagueSlug}`)
	}

	const path = `${config.sport.sport}/${config.league.league}/teams`
	const data = await fetchEspn<EspnTeamsResponse>(path)

	const teams: { id: string; name: string; abbrev: string; logo?: string }[] = []

	// Handle different response structures
	if (data.sports?.[0]?.leagues?.[0]?.teams) {
		for (const item of data.sports[0].leagues[0].teams) {
			const t = item.team
			teams.push({
				id: t.id,
				name: t.displayName || t.name,
				abbrev: t.abbreviation,
				logo: t.logos?.[0]?.href || t.logo,
			})
		}
	}

	return teams.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get today's scoreboard for a sport/league
 */
export async function getScoreboard(sportSlug: string, leagueSlug: string, date?: string): Promise<Match[]> {
	const config = getLeagueConfig(sportSlug, leagueSlug)
	if (!config) {
		throw new Error(`Unknown sport/league: ${sportSlug}/${leagueSlug}`)
	}

	// Build path with optional date parameter
	let path = `${config.sport.sport}/${config.league.league}/scoreboard`
	if (date) {
		path += `?dates=${date.replace(/-/g, '')}`
	}

	const data = await fetchEspn<EspnScoreboardResponse>(path)
	const matches: Match[] = []

	for (const event of data.events || []) {
		const competition = event.competitions[0]
		if (!competition) continue

		const homeCompetitor = competition.competitors.find((c) => c.homeAway === 'home')
		const awayCompetitor = competition.competitors.find((c) => c.homeAway === 'away')

		if (!homeCompetitor || !awayCompetitor) continue

		const statusType = competition.status?.type
		const espnState = statusType?.state || 'pre'
		const status: MatchStatus = mapEspnStatusState(espnState, statusType?.completed)

		const home: Team = {
			id: homeCompetitor.team.id,
			name: homeCompetitor.team.displayName || homeCompetitor.team.name,
			abbrev: homeCompetitor.team.abbreviation,
			logo: homeCompetitor.team.logos?.[0]?.href || homeCompetitor.team.logo,
			score: homeCompetitor.score,
		}

		const away: Team = {
			id: awayCompetitor.team.id,
			name: awayCompetitor.team.displayName || awayCompetitor.team.name,
			abbrev: awayCompetitor.team.abbreviation,
			logo: awayCompetitor.team.logos?.[0]?.href || awayCompetitor.team.logo,
			score: awayCompetitor.score,
		}

		matches.push({
			id: event.id,
			home,
			away,
			status,
			statusDetail: statusType?.shortDetail || statusType?.description || '',
			time: statusType?.detail || '',
			venue: competition.venue?.fullName,
			broadcast: competition.broadcasts?.[0]?.names?.join(', '),
			league: config.league.name,
		})
	}

	return matches
}

/**
 * Map ESPN state to our status
 */
function mapEspnStatusState(state: string, completed?: boolean): MatchStatus {
	if (completed) return 'done'
	switch (state.toLowerCase()) {
		case 'post':
			return 'done'
		case 'in':
			return 'ongoing'
		case 'pre':
		default:
			return 'upcoming'
	}
}

export default {
	getSports,
	getLeagues,
	getTeams,
	getScoreboard,
}
