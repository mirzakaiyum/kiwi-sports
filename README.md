# Kiwi Livescore API

A Deno + Cloudflare Worker API for live sports scores. Currently utilizes the ESPN API to fetch match data across
multiple sports and leagues, with additional support for Cricket via Cricinfo/Cricbuzz.

## Features

- 🏆 **Multiple Sports** - Basketball, Soccer, Football, Hockey, Cricket, MMA, Tennis, and more
- 🏟️ **All Major Leagues** - NBA, NFL, Premier League, La Liga, UFC, F1, etc.
- ⚡ **Status Filtering** - Filter by `done`, `ongoing`, `upcoming`
- 🔍 **Team Search** - Search matches by team name
- 🛡️ **Rate Limiting** - Built-in protection against abuse (Token Bucket)
- ☁️ **Cloudflare Ready** - Deploy directly to Cloudflare Workers

## Quick Start

```bash
# Development server
deno task dev

# Run tests
deno task test

# Deploy to Cloudflare
deno task deploy
```

## API Endpoints

### Get Sports List

```bash
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/sports"
```

### Get Scoreboard

```bash
# All basketball matches today
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/scoreboard?sport=basketball"

# Live soccer only
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/scoreboard?sport=soccer&status=ongoing"

# Search for a team
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/scoreboard?sport=basketball&team=lakers"

# Specific date (YYYYMMDD)
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/scoreboard?sport=football&date=20260105"
```

### Get Teams

```bash
curl -H "User-Agent: MyClient/1.0" "http://localhost:8000/api/teams?sport=basketball"
```

## Rate Limiting

The API implements a **Token Bucket** rate limiter to ensure stability:

- **Limit**: 60 requests per minute (average 1 req/sec)
- **Burst**: Allows up to 10 concurrent/instant requests
- **Requirements**: A valid `User-Agent` header is required.
- **Restrictions**: Automated tools like `curl`, `python-requests`, and `postman` (without custom UA) may be blocked.

## Response Format

```json
{
	"meta": {
		"sport": "Basketball",
		"league": "NBA, WNBA, ...",
		"date": "2026-01-05",
		"count": 5,
		"status": "all"
	},
	"matches": [
		{
			"id": "401234",
			"league": "NBA",
			"home": {
				"id": "13",
				"name": "Lakers",
				"abbrev": "LAL",
				"logo": "https://..."
			},
			"away": {
				"id": "2",
				"name": "Celtics",
				"abbrev": "BOS",
				"logo": "https://..."
			},
			"status": "done",
			"statusDetail": "Final"
		}
	]
}
```

## Available Sports

| Sport        | Leagues                                                            |
| ------------ | ------------------------------------------------------------------ |
| `basketball` | NBA, WNBA, NCAAB, NCAAW                                            |
| `soccer`     | EPL, La Liga, Bundesliga, Serie A, Ligue 1, MLS, UCL, World Cup... |
| `football`   | NFL                                                                |
| `hockey`     | NHL                                                                |
| `baseball`   | MLB                                                                |
| `cricket`    | International, Other                                               |
| `mma`        | UFC                                                                |
| `tennis`     | ATP, WTA                                                           |
| `golf`       | PGA, LPGA, European Tour, Champions Tour                           |
| `rugby`      | Rugby Union                                                        |
| `racing`     | F1, NASCAR, IndyCar                                                |

## Project Structure

```
kiwi-sports/
├── deno.json           # Deno config
├── wrangler.toml       # Cloudflare Worker config
└── src/
    ├── index.ts        # Main entry (Worker handler)
    ├── types.ts        # TypeScript interfaces
    ├── rateLimit.ts    # Rate limiting middleware
    ├── index.test.ts   # Test suite
    └── providers/
        ├── espn.ts     # ESPN API provider
        └── cricinfo.ts # Cricinfo/Cricbuzz provider
```

## Data Providers

| Provider | Status    | Description                     |
| -------- | --------- | ------------------------------- |
| ESPN     | ✅ Active | Primary provider for all sports |
| Cricinfo | ✅ Active | Cricket scores and updates      |

## License

MIT
