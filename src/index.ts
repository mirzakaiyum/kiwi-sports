/**
 * Kiwi Livescore API
 * Deno + Cloudflare Worker API for live sports scores
 */

import * as espn from './providers/espn.ts'
import * as cricbuzz from './providers/cricinfo.ts'
import type { ApiResponse, MatchStatus, Match } from './types.ts'
import { filterByStatus, filterByTeam, getSportBySlug, SPORTS } from './types.ts'
import { rateLimiter } from './rateLimit.ts'

// Import HTML as string for landing page
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Kiwi Livescore API</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			background: #0a0e1a;
			color: #a8b3c1;
			line-height: 1.6;
		}
		.container { max-width: 1400px; margin: 0 auto; padding: 0 20px; }
		.header {
			padding: 10px 0;
			margin-bottom: 32px;
			border-bottom: 1px solid #2a3447;
			background-color: #0e1425;
		}
		h1 { color: #e8ecf1; font-size: 24px; font-weight: 600; }
		.subtitle { color: #6b7785; font-size: 14px; margin-bottom: 6px; }
		h2 { color: #e8ecf1; font-size: 18px; font-weight: 600; margin-bottom: 12px; }
		
		.columns { display: grid; grid-template-columns: 480px 1fr; gap: 32px; }
		.left-column { display: flex; flex-direction: column; gap: 24px; }
		.right-column { display: flex; flex-direction: column; gap: 24px; }
		
		@media (max-width: 968px) { .columns { grid-template-columns: 1fr; } }
		
		.section {
			background: #151b2b;
			border-radius: 8px;
			padding: 20px;
			margin-bottom: 24px;
		}
		
		label {
			display: block;
			color: #a8b3c1;
			font-size: 13px;
			margin-bottom: 6px;
			font-weight: 500;
		}
		
		.form-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 16px;
			margin-bottom: 20px;
		}
		.form-grid > div:first-child { grid-column: 1 / -1; }
		
		input[type="text"], input[type="date"], select {
			width: 100%;
			background: #1e2639;
			border: 1px solid #2a3447;
			border-radius: 6px;
			padding: 10px 12px;
			color: #ffffff;
			font-size: 14px;
			outline: none;
			transition: all 0.2s;
		}
		input[type="text"]:focus, input[type="date"]:focus, select:focus {
			border-color: #4a90e2;
			background: #232c42;
		}
		input::placeholder { color: #5a6578; }
		select option { background: #1e2639; color: #ffffff; }
		
		.btn-group { display: flex; gap: 12px; margin-top: 16px; }
		
		button {
			background: #4a90e2;
			color: #ffffff;
			border: none;
			border-radius: 6px;
			padding: 10px 20px;
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			transition: background 0.2s;
		}
		button:hover:not(:disabled) { background: #5a9ff2; }
		button:disabled { opacity: 0.5; cursor: not-allowed; }
		button.secondary { background: #2a3447; }
		button.secondary:hover:not(:disabled) { background: #35405a; }
		
		.status-filters { display: flex; gap: 8px; margin-bottom: 16px; }
		.status-btn {
			flex: 1;
			padding: 10px;
			background: #1e2639;
			border: 1px solid #2a3447;
			color: #a8b3c1;
			border-radius: 6px;
			cursor: pointer;
			font-size: 13px;
			transition: all 0.2s;
		}
		.status-btn:hover { background: #232c42; color: #e8ecf1; }
		.status-btn.active { border-color: #4a90e2; color: #4a90e2; background: rgba(74,144,226,0.1); }
		
		.path-box {
			background: #1e2639;
			border: 1px solid #2a3447;
			border-radius: 6px;
			padding: 12px 14px;
			font-family: "Monaco", "Menlo", "Courier New", monospace;
			font-size: 13px;
			color: #6b94ce;
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 16px;
			min-height: 44px;
		}
		.path-box code { flex: 1; word-break: break-all; }
		.copy-btn {
			background: transparent;
			border: 1px solid #2a3447;
			padding: 6px 12px;
			margin-left: 12px;
			border-radius: 4px;
			font-size: 12px;
			color: #a8b3c1;
			cursor: pointer;
			transition: all 0.2s;
		}
		.copy-btn:hover { border-color: #4a90e2; color: #4a90e2; background: #1e2639; }
		
		.matches { display: flex; flex-direction: column; gap: 12px; }
		.match-card {
			background: #1e2639;
			border: 1px solid #2a3447;
			border-radius: 8px;
			padding: 16px;
			transition: border-color 0.2s;
		}
		.match-card:hover { border-color: #4a90e2; }
		.match-card.live { border-left: 3px solid #ff4444; }
		
		.match-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid #2a3447;
		}
		.match-league {
			font-size: 11px;
			color: #4a90e2;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			font-weight: 600;
		}
		.match-status {
			font-size: 10px;
			padding: 3px 8px;
			border-radius: 4px;
			font-weight: 600;
			text-transform: uppercase;
		}
		.match-status.ongoing { background: #ff4444; color: white; animation: pulse 2s infinite; }
		.match-status.done { background: #5a6578; color: white; }
		.match-status.upcoming { background: #4a90e2; color: white; }
		
		.match-teams { display: flex; flex-direction: column; gap: 8px; }
		.team-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
		.team-info { display: flex; align-items: center; gap: 10px; flex: 1; }
		.team-logo { width: 28px; height: 28px; object-fit: contain; border-radius: 4px; background: #151b2b; }
		.team-name { font-weight: 500; font-size: 14px; color: #e8ecf1; }
		.team-score { font-size: 18px; font-weight: 700; color: #4a90e2; min-width: 32px; text-align: right; }
		
		.match-footer { margin-top: 8px; font-size: 12px; color: #6b7785; }
		
		@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
		
		.loading, .empty { text-align: center; padding: 32px; color: #6b7785; }
		.loading::after {
			content: '';
			display: inline-block;
			width: 16px;
			height: 16px;
			border: 2px solid #4a90e2;
			border-top-color: transparent;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin-left: 8px;
			vertical-align: middle;
		}
		@keyframes spin { to { transform: rotate(360deg); } }
		
		.json-output {
			background: #1e2639;
			border: 1px solid #2a3447;
			border-radius: 6px;
			padding: 16px;
			font-family: "Monaco", "Menlo", "Courier New", monospace;
			font-size: 13px;
			color: #e8ecf1;
			white-space: pre-wrap;
			overflow-x: auto;
			min-height: 200px;
			max-height: 500px;
			overflow-y: auto;
		}
		.json-output:empty::before { content: "Response will appear here..."; color: #5a6578; }
		
		table { width: 100%; border-collapse: collapse; margin-top: 12px; }
		th, td { text-align: left; padding: 12px; border-bottom: 1px solid #2a3447; }
		th { color: #a8b3c1; font-weight: 600; font-size: 13px; background: #1a2132; }
		td { color: #8895a7; font-size: 13px; }
		td:first-child { color: #e8ecf1; font-family: "Monaco", "Menlo", "Courier New", monospace; font-size: 12px; }
		tr:last-child td { border-bottom: none; }
		
		.tag {
			display: inline-block;
			background: #2a3447;
			color: #6b94ce;
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 11px;
			font-weight: 500;
		}
		.tag.required { background: #4a3535; color: #e88484; }
		
		.hidden { display: none; }
		.refresh-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 13px; color: #6b7785; }
	</style>
</head>
<body>
	<div class="header">
		<div class="container">
			<h1>Kiwi Livescore API</h1>
			<p class="subtitle">Live sports scores API for Kiwi Tab. Powered by ESPN.</p>
		</div>
	</div>
	
	<div class="container">
		<div class="columns">
			<div class="left-column">
				<div class="section">
					<div class="form-grid">
						<div>
							<label for="sport">Sport</label>
							<select id="sport"></select>
						</div>
						<div>
							<label for="league">League</label>
							<select id="league"></select>
						</div>
						<div>
							<label for="team">Teams (hold Ctrl/Cmd to select multiple)</label>
							<select id="team" multiple style="height: 120px;"></select>
							<input id="teamInput" type="text" placeholder="Enter team names (comma-separated)" class="hidden" style="margin-top: 8px;">
						</div>
						<div>
							<label for="date">Date</label>
							<input id="date" type="date">
						</div>
					</div>
					
					<div class="status-filters">
						<button class="status-btn active" data-status="all">All</button>
						<button class="status-btn" data-status="ongoing">🔴 Live</button>
						<button class="status-btn" data-status="upcoming">⏰ Upcoming</button>
						<button class="status-btn" data-status="done">✓ Finished</button>
					</div>
					
					<div class="btn-group">
						<button id="fetchBtn">Fetch Scores</button>
						<button id="clearBtn" class="secondary">Clear</button>
					</div>
				</div>
				
				<div>
					<h2>End Point</h2>
					<div class="path-box">
						<code id="endpointUrl">/api/scoreboard?sport=basketball</code>
						<button class="copy-btn" id="copyBtn">Copy</button>
					</div>
				</div>
				
				<div>
					<h2>Response Body</h2>
					<div class="section">
						<pre id="responseBody" class="json-output"></pre>
					</div>
				</div>
			</div>
			
			<div class="right-column">
				<div>
					<h2>Live Matches</h2>
					<div class="refresh-bar">
						<span id="lastUpdate">Last updated: --</span>
						<button class="secondary" onclick="loadScoreboard()">↻ Refresh</button>
					</div>
					<div id="matches" class="matches">
						<div class="loading">Loading matches</div>
					</div>
				</div>
				
				<div>
					<h2>API Endpoints</h2>
					<div class="section">
						<table>
							<thead>
								<tr>
									<th>Endpoint</th>
									<th>Method</th>
									<th>Description</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>/api/sports</td>
									<td>GET</td>
									<td>Returns all available sports with their leagues configuration</td>
								</tr>
								<tr>
									<td>/api/sports/{sport}</td>
									<td>GET</td>
									<td>Returns leagues for a specific sport<br><small>Example: /api/sports/basketball</small></td>
								</tr>
								<tr>
									<td>/api/teams?sport={sport}&league={league}</td>
									<td>GET</td>
									<td>Returns teams for a sport/league<br><small>Example: /api/teams?sport=basketball&league=nba</small></td>
								</tr>
								<tr>
									<td>/api/scoreboard?sport={sport}</td>
									<td>GET</td>
									<td>Returns live scores and matches<br><small>Example: /api/scoreboard?sport=soccer&league=epl&status=ongoing</small></td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
				
				<div>
					<h2>Query Parameters for /api/teams</h2>
					<div class="section">
						<table>
							<thead>
								<tr>
									<th>Parameter</th>
									<th>Required</th>
									<th>Default</th>
									<th>Description</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>sport</td>
									<td><span class="tag">optional</span></td>
									<td>basketball</td>
									<td>Sport slug (basketball, soccer, football, hockey, cricket, etc.)</td>
								</tr>
								<tr>
									<td>league</td>
									<td><span class="tag">optional</span></td>
									<td>first league</td>
									<td>League slug (nba, epl, nfl, etc.). Defaults to first league of the sport</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
				
				<div>
					<h2>Query Parameters for /api/scoreboard</h2>
					<div class="section">
						<table>
							<thead>
								<tr>
									<th>Parameter</th>
									<th>Required</th>
									<th>Default</th>
									<th>Description</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>sport</td>
									<td><span class="tag">optional</span></td>
									<td>basketball</td>
									<td>Sport slug (basketball, soccer, football, hockey, cricket, etc.)</td>
								</tr>
								<tr>
									<td>league</td>
									<td><span class="tag">optional</span></td>
									<td>all leagues</td>
									<td>League slug (nba, epl, nfl, etc.). If omitted, fetches all leagues for the sport</td>
								</tr>
								<tr>
									<td>team</td>
									<td><span class="tag">optional</span></td>
									<td>-</td>
									<td>Filter by team names or abbreviations (comma-separated for multiple)</td>
								</tr>
								<tr>
									<td>status</td>
									<td><span class="tag">optional</span></td>
									<td>all</td>
									<td>Match status filter (ongoing, done, upcoming, all)</td>
								</tr>
								<tr>
									<td>date</td>
									<td><span class="tag">optional</span></td>
									<td>today</td>
									<td>Date in YYYYMMDD format (e.g., 20260106)</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>
	
	<script>
		const sportSelect = document.getElementById('sport');
		const leagueSelect = document.getElementById('league');
		const teamSelect = document.getElementById('team');
		const teamInput = document.getElementById('teamInput');
		const dateInput = document.getElementById('date');
		const matchesContainer = document.getElementById('matches');
		const statusBtns = document.querySelectorAll('.status-btn');
		const lastUpdateEl = document.getElementById('lastUpdate');
		const responseBody = document.getElementById('responseBody');
		const endpointUrlEl = document.getElementById('endpointUrl');
		const copyBtn = document.getElementById('copyBtn');
		const fetchBtn = document.getElementById('fetchBtn');
		const clearBtn = document.getElementById('clearBtn');
		
		let currentStatus = 'all';
		let sportsData = [];
		
		dateInput.value = new Date().toISOString().split('T')[0];
		
		async function loadSports() {
			const res = await fetch('/api/sports');
			sportsData = await res.json();
			sportSelect.innerHTML = sportsData.map(s => 
				\`<option value="\${s.slug}">\${s.name}</option>\`
			).join('');
			updateLeagues();
			updateEndpoint();
			loadScoreboard();
		}
		
		function updateLeagues() {
			const sport = sportsData.find(s => s.slug === sportSelect.value);
			if (!sport) return;
			leagueSelect.innerHTML = '<option value="all">All Leagues</option>' + 
				sport.leagues.map(l => \`<option value="\${l.slug}">\${l.name}</option>\`).join('');
			updateTeams();
		}
		
		async function updateTeams() {
			const sport = sportSelect.value;
			const league = leagueSelect.value;
			
			// Special logic for Cricket 'Other League'
			if (sport === 'cricket' && league === 'other') {
				teamSelect.classList.add('hidden');
				teamInput.classList.remove('hidden');
				teamInput.value = ''; // Reset
				return;
			} else {
				teamSelect.classList.remove('hidden');
				teamInput.classList.add('hidden');
			}
			
			teamSelect.innerHTML = '<option value="">All Teams</option><option value="" disabled>Loading...</option>';
			
			try {
				let url = \`/api/teams?sport=\${sport}\`;
				if (league && league !== 'all') url += \`&league=\${league}\`;
				const res = await fetch(url);
				const data = await res.json();
				const teams = data.teams || [];
				teamSelect.innerHTML = 
					teams.map(t => \`<option value="\${t.abbrev}">\${t.name}</option>\`).join('');
			} catch (err) {
				teamSelect.innerHTML = '<option value="">All Teams</option>';
			}
		}
		
		function updateEndpoint() {
			const sport = sportSelect.value;
			const league = leagueSelect.value;
			// Get selected teams from multiselect
			let teamVal = '';
			if (!teamInput.classList.contains('hidden')) {
				teamVal = teamInput.value;
			} else {
				const selectedOptions = Array.from(teamSelect.selectedOptions).map(opt => opt.value).filter(v => v);
				teamVal = selectedOptions.join(',');
			}
			const date = dateInput.value.replace(/-/g, '');
			const status = currentStatus;
			
			let url = \`/api/scoreboard?sport=\${sport}\`;
			if (league && league !== 'all') url += \`&league=\${league}\`;
			// Only add date for non-cricket sports (ESPN uses it, Cricket RSS ignores it)
			if (date && sport !== 'cricket') url += \`&date=\${date}\`;
			if (teamVal) url += \`&team=\${teamVal}\`;
			if (status !== 'all') url += \`&status=\${status}\`;
			
			endpointUrlEl.textContent = url;
		}
		
		async function loadScoreboard() {
			const url = endpointUrlEl.textContent;
			matchesContainer.innerHTML = '<div class="loading">Loading matches</div>';
			fetchBtn.disabled = true;
			fetchBtn.textContent = 'Loading...';
			
			try {
				const res = await fetch(url);
				const data = await res.json();
				renderMatches(data.matches || []);
				responseBody.textContent = JSON.stringify(data, null, 2);
				lastUpdateEl.textContent = \`Last updated: \${new Date().toLocaleTimeString()}\`;
			} catch (err) {
				matchesContainer.innerHTML = '<div class="empty">Failed to load matches</div>';
				responseBody.textContent = \`Error: \${err.message}\`;
			} finally {
				fetchBtn.disabled = false;
				fetchBtn.textContent = 'Fetch Scores';
			}
		}
		
		function renderMatches(matches) {
			if (matches.length === 0) {
				matchesContainer.innerHTML = '<div class="empty">No matches found</div>';
				return;
			}
			
			matchesContainer.innerHTML = matches.map(m => \`
				<div class="match-card \${m.status === 'ongoing' ? 'live' : ''}">
					<div class="match-header">
						<span class="match-league">\${m.league || 'Unknown'}</span>
						<span class="match-status \${m.status}">\${m.status === 'ongoing' ? 'LIVE' : m.status.toUpperCase()}</span>
					</div>
					<div class="match-teams">
						<div class="team-row">
							<div class="team-info">
								\${m.home.logo ? \`<img src="\${m.home.logo}" class="team-logo" alt="">\` : ''}
								<span class="team-name">\${m.home.name}</span>
							</div>
							<span class="team-score">\${m.home.score ?? '-'}</span>
						</div>
						<div class="team-row">
							<div class="team-info">
								\${m.away.logo ? \`<img src="\${m.away.logo}" class="team-logo" alt="">\` : ''}
								<span class="team-name">\${m.away.name}</span>
							</div>
							<span class="team-score">\${m.away.score ?? '-'}</span>
						</div>
					</div>
					\${m.statusDetail ? \`<div class="match-footer">\${m.statusDetail}</div>\` : ''}
				</div>
			\`).join('');
		}
		
		sportSelect.addEventListener('change', () => { updateLeagues(); updateEndpoint(); loadScoreboard(); });
		leagueSelect.addEventListener('change', () => { updateTeams(); updateEndpoint(); loadScoreboard(); });
		teamSelect.addEventListener('change', () => { updateEndpoint(); loadScoreboard(); });
		teamInput.addEventListener('input', debounce(() => { updateEndpoint(); loadScoreboard(); }, 500));
		dateInput.addEventListener('change', () => { updateEndpoint(); loadScoreboard(); });
		fetchBtn.addEventListener('click', loadScoreboard);
		
		clearBtn.addEventListener('click', () => {
			Array.from(teamSelect.options).forEach(opt => opt.selected = false);
			teamInput.value = '';
			dateInput.value = new Date().toISOString().split('T')[0];
			currentStatus = 'all';
			statusBtns.forEach(b => b.classList.remove('active'));
			statusBtns[0].classList.add('active');
			responseBody.textContent = '';
			updateEndpoint();
			loadScoreboard();
		});
		
		statusBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				statusBtns.forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				currentStatus = btn.dataset.status;
				updateEndpoint();
				loadScoreboard();
			});
		});
		
		function debounce(fn, ms) {
			let timeout;
			return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), ms); };
		}
		
		copyBtn.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(window.location.origin + endpointUrlEl.textContent);
				copyBtn.textContent = 'Copied!';
				setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
			} catch (err) {
				console.error('Failed to copy:', err);
			}
		});
		
		loadSports();
		setInterval(loadScoreboard, 60000);
	</script>
</body>
</html>`

/**
 * Main fetch handler
 */
export default { fetch: main }

async function main(request: Request): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname

	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Content-Type': 'application/json',
	}

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers })
	}

	// Rate Limit Check
	// In Cloudflare Workers, client IP is in 'cf-connecting-ip' header
	// In local dev/Deno, we might need a fallback or it might vary
	const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1'
	const userAgent = request.headers.get('user-agent')
	
	const limitResult = rateLimiter.check(clientIp, userAgent)
	if (!limitResult.allowed) {
		console.log(`Rate limit blocked: ${clientIp} (${limitResult.reason})`)
		return jsonResponse({ error: limitResult.reason }, headers, 429)
	}

	try {
		// Landing page
		if (path === '/' || path === '') {
			return new Response(HTML_PAGE, { headers: { 'Content-Type': 'text/html' } })
		}

		// API: List sports
		if (path === '/api/sports') {
			return jsonResponse(SPORTS, headers)
		}

		// API: Get leagues for a specific sport
		if (path.startsWith('/api/sports/')) {
			const sportSlug = path.split('/')[3]
			if (!sportSlug) {
				return jsonResponse({ error: 'Sport slug is required' }, headers, 400)
			}
			
			const sport = getSportBySlug(sportSlug)
			if (!sport) {
				return jsonResponse({ error: 'Unknown sport' }, headers, 404)
			}
			
			return jsonResponse({
				sport: sport.name,
				slug: sport.slug,
				leagues: sport.leagues
			}, headers)
		}

		// API: Get teams for a sport/league
		if (path === '/api/teams') {
			const sportSlug = url.searchParams.get('sport') || 'basketball'
			const leagueSlug = url.searchParams.get('league') || ''
			const sport = getSportBySlug(sportSlug)
			if (!sport || sport.leagues.length === 0) {
				return jsonResponse({ error: 'Unknown sport' }, headers, 400)
			}
			
			// Use Cricbuzz for cricket, ESPN for other sports
			if (sportSlug === 'cricket') {
				const teams = cricbuzz.getTeams()
				return jsonResponse({ sport: sport.name, league: 'All', teams }, headers)
			}
			
			// Use specified league or default to first one
			const targetLeague = leagueSlug 
				? sport.leagues.find(l => l.slug === leagueSlug) || sport.leagues[0]
				: sport.leagues[0]
			const teams = await espn.getTeams(sportSlug, targetLeague.slug)
			return jsonResponse({ sport: sport.name, league: targetLeague.name, teams }, headers)
		}

		// API: Get scoreboard - fetches league(s) for a sport
		if (path === '/api/scoreboard') {
			const sportSlug = url.searchParams.get('sport') || 'basketball'
			const leagueSlug = url.searchParams.get('league') || ''
			const team = url.searchParams.get('team') || ''
			const status = (url.searchParams.get('status') || 'all') as MatchStatus | 'all'
			const date = url.searchParams.get('date') || undefined

			const sport = getSportBySlug(sportSlug)
			if (!sport) {
				return jsonResponse({ error: 'Unknown sport' }, headers, 400)
			}

			// Use Cricbuzz for cricket, ESPN for other sports
			let matches: Match[]
			
			if (sportSlug === 'cricket') {
				// Cricbuzz handles fetching all match types internally
				matches = await cricbuzz.getScoreboard(sportSlug, leagueSlug || 'international', date)
			} else {
				// ESPN: If specific league provided, fetch only that; otherwise fetch all
				let leaguesToFetch = sport.leagues
				if (leagueSlug) {
					const specificLeague = sport.leagues.find(l => l.slug === leagueSlug)
					if (specificLeague) {
						leaguesToFetch = [specificLeague]
					}
				}

				const leaguePromises = leaguesToFetch.map((league) =>
					espn.getScoreboard(sportSlug, league.slug, date).catch(() => [] as Match[])
				)
				const leagueResults = await Promise.all(leaguePromises)
				matches = leagueResults.flat()
			}

			// Apply filters
			if (team) {
				const filteredMatches = filterByTeam(matches, team)
				
				// Special logic for Cricket (RSS):
				// If filter returns no matches, fallback to the first match
				if (sportSlug === 'cricket' && filteredMatches.length === 0 && matches.length > 0) {
					matches = [matches[0]]
				} else {
					matches = filteredMatches
				}
			}
			if (status !== 'all') {
				matches = filterByStatus(matches, status)
			}

			// Sort: ongoing first, then upcoming, then done
			matches.sort((a, b) => {
				const order = { ongoing: 0, upcoming: 1, done: 2 }
				return order[a.status] - order[b.status]
			})

			const response: ApiResponse = {
				meta: {
					sport: sport.name,
					league: sport.leagues.map((l) => l.name).join(', '),
					time: new Date().toISOString(),
					count: matches.length,
					status: status,
				},
				matches,
			}

			return jsonResponse(response, headers)
		}

		return jsonResponse({ error: 'Not found' }, headers, 404)
	} catch (error) {
		return jsonResponse({ error: (error as Error).message }, headers, 500)
	}
}

function jsonResponse(data: unknown, headers: Record<string, string>, status = 200): Response {
	return new Response(JSON.stringify(data, null, 2), { status, headers })
}

// @ts-ignore - Deno-specific startup (not bundled by Wrangler)
if (typeof Deno !== "undefined") {
	const port = parseInt(Deno.env.get("PORT") || "8000")
	console.log("🥝 Kiwi Livescore API running on http://localhost:" + port)
	Deno.serve({ port }, main)
}
