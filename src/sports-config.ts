/**
 * Sports configuration - the single source of truth for supported sports and leagues.
 * Edit this file to add/remove/modify sports and their leagues.
 * 
 * This configuration is loaded dynamically and served via the /api/sports endpoint.
 */

import type { SportConfig } from './types.ts'

export const SPORTS_CONFIG: SportConfig[] = [
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
 * Get sport config by slug
 */
export function getSportBySlug(slug: string): SportConfig | undefined {
	return SPORTS_CONFIG.find((s) => s.slug === slug.toLowerCase())
}

/**
 * Get league config by sport and league slug
 */
export function getLeagueConfig(
	sportSlug: string,
	leagueSlug: string
): { sport: SportConfig; league: SportConfig['leagues'][0] } | undefined {
	const sport = getSportBySlug(sportSlug)
	if (!sport) return undefined
	const league = sport.leagues.find((l) => l.slug === leagueSlug.toLowerCase())
	if (!league) return undefined
	return { sport, league }
}
