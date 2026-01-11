import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { filterByStatus, filterByTeam, mapEspnStatus } from './types.ts'
import { getSportBySlug, getLeagueConfig, SPORTS_CONFIG } from './sports-config.ts'
import type { Match } from './types.ts'
import * as espn from './providers/espn.ts'

/**
 * Types Tests
 */
Deno.test('SPORTS_CONFIG: contains sports with leagues hierarchy', () => {
	assertEquals(SPORTS_CONFIG.length > 0, true)

	const basketball = SPORTS_CONFIG.find((s) => s.slug === 'basketball')
	assertExists(basketball)
	assertEquals(basketball.name, 'Basketball')
	assertEquals(basketball.sport, 'basketball')
	assertEquals(basketball.leagues.length >= 2, true)
	
	const nba = basketball.leagues.find(l => l.slug === 'nba')
	assertExists(nba)
	assertEquals(nba.name, 'NBA')
})

Deno.test('getSportBySlug: returns correct sport config', () => {
	const soccer = getSportBySlug('soccer')
	assertExists(soccer)
	assertEquals(soccer.name, 'Soccer')
	assertEquals(soccer.leagues.length >= 5, true)

	const invalid = getSportBySlug('invalid-sport')
	assertEquals(invalid, undefined)
})

Deno.test('getLeagueConfig: returns sport and league configs', () => {
	const config = getLeagueConfig('basketball', 'nba')
	assertExists(config)
	assertEquals(config.sport.name, 'Basketball')
	assertEquals(config.league.name, 'NBA')
	assertEquals(config.league.league, 'nba')

	const invalid = getLeagueConfig('basketball', 'invalid')
	assertEquals(invalid, undefined)
})

Deno.test('mapEspnStatus: maps status correctly', () => {
	assertEquals(mapEspnStatus('STATUS_FINAL'), 'done')
	assertEquals(mapEspnStatus('Final'), 'done')
	assertEquals(mapEspnStatus('post'), 'done')
	assertEquals(mapEspnStatus('in progress'), 'ongoing')
	assertEquals(mapEspnStatus('live'), 'ongoing')
	assertEquals(mapEspnStatus('scheduled'), 'upcoming')
	assertEquals(mapEspnStatus('pre'), 'upcoming')
})

Deno.test('filterByStatus: filters correctly', () => {
	const matches: Match[] = [
		{ id: '1', home: { id: '1', name: 'A', abbrev: 'A' }, away: { id: '2', name: 'B', abbrev: 'B' }, status: 'done', statusDetail: '' },
		{ id: '2', home: { id: '3', name: 'C', abbrev: 'C' }, away: { id: '4', name: 'D', abbrev: 'D' }, status: 'ongoing', statusDetail: '' },
		{ id: '3', home: { id: '5', name: 'E', abbrev: 'E' }, away: { id: '6', name: 'F', abbrev: 'F' }, status: 'upcoming', statusDetail: '' },
	]

	assertEquals(filterByStatus(matches, 'done').length, 1)
	assertEquals(filterByStatus(matches, 'ongoing').length, 1)
	assertEquals(filterByStatus(matches, 'all').length, 3)
})

Deno.test('filterByTeam: filters by team name or abbrev', () => {
	const matches: Match[] = [
		{ id: '1', home: { id: '1', name: 'Dallas Cowboys', abbrev: 'DAL' }, away: { id: '2', name: 'New York Giants', abbrev: 'NYG' }, status: 'done', statusDetail: '' },
		{ id: '2', home: { id: '3', name: 'Los Angeles Lakers', abbrev: 'LAL' }, away: { id: '4', name: 'Boston Celtics', abbrev: 'BOS' }, status: 'done', statusDetail: '' },
	]

	assertEquals(filterByTeam(matches, 'dallas').length, 1)
	assertEquals(filterByTeam(matches, 'DAL').length, 1)
	assertEquals(filterByTeam(matches, 'lakers').length, 1)
})

/**
 * ESPN Provider Tests
 */
Deno.test('espn.getSports: returns sports with leagues', () => {
	const sports = espn.getSports()
	assertEquals(sports.length > 0, true)
	
	const basketball = sports.find((s) => s.slug === 'basketball')
	assertExists(basketball)
	assertEquals(basketball.leagues.length >= 2, true)
})

Deno.test('espn.getLeagues: returns leagues for sport', () => {
	const leagues = espn.getLeagues('soccer')
	assertEquals(leagues.length >= 5, true)
	
	const epl = leagues.find(l => l.slug === 'epl')
	assertExists(epl)
	assertEquals(epl.name, 'Premier League')
})

Deno.test({
	name: 'espn.getScoreboard: fetches NBA scoreboard',
	ignore: false,
	async fn() {
		const matches = await espn.getScoreboard('basketball', 'nba')
		assertExists(matches)
		assertEquals(Array.isArray(matches), true)
	},
})

Deno.test({
	name: 'espn.getTeams: fetches NBA teams',
	ignore: false,
	async fn() {
		const teams = await espn.getTeams('basketball', 'nba')
		assertExists(teams)
		assertEquals(teams.length >= 30, true)
	},
})
