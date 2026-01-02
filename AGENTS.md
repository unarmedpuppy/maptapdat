# Maptapdat - Agent Instructions

Web dashboard for Maptap.gg geography game score analytics.

## Overview

Mobile-friendly analytics dashboard for tracking Maptap game scores:
- Leaderboards (overall/daily)
- Score trends and player comparisons
- Emoji and location analytics
- Achievement system and streak tracking
- Dark/light theme support

**URL**: https://maptapdat.server.unarmedpuppy.com  
**Port**: 3000

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Frontend | Vanilla JS + Chart.js |
| Styling | CSS Grid/Flexbox |
| Data | CSV file parsing |
| Container | Docker |

## Project Structure

```
maptapdat/
├── server.js              # Express server + all API logic
├── public/                # Static frontend files
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data.csv               # Game data (source of truth)
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Quick Commands

```bash
# Local development
npm install
npm run dev                # Starts on port 3000

# Docker
docker compose up -d --build

# View at http://localhost:3000
```

## Data Format

The `data.csv` file must have these columns:
```csv
user,date,location_number,location_score,location_emoji,total_score
josh,2025-01-02,1,95,🎯,475
josh,2025-01-02,2,100,💯,475
...
```

| Column | Description |
|--------|-------------|
| user | Player name (lowercase) |
| date | Game date (YYYY-MM-DD) |
| location_number | Location 1-5 |
| location_score | Score 0-100 |
| location_emoji | Emoji representing score |
| total_score | Total for that game day |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/data` | Raw game data |
| `GET /api/players` | All player names |
| `GET /api/dates` | All game dates |
| `GET /api/leaderboard` | Rankings (supports `?date=`) |
| `GET /api/trends` | Score trends (supports `?player=`) |
| `GET /api/player/:player` | Individual player stats |
| `GET /api/compare` | Head-to-head comparison |
| `GET /api/analytics` | Comprehensive analytics |
| `GET /api/aggregations` | Period-based aggregations |

## Updating Data

1. Replace `data.csv` with new data
2. Rebuild container:
```bash
docker compose down
docker compose up -d --build
```

Data is loaded into memory on server start. No database required.

## Configuration

### Environment Variables
```bash
PORT=3000               # Server port (default: 3000)
```

### Docker Compose
```yaml
services:
  maptapdat:
    build: .
    ports:
      - "3000:3000"
```

## Deployment

### Via home-server
```bash
# Deployed at: home-server/apps/maptapdat/
cd ~/server/apps/maptapdat
docker compose build --no-cache && docker compose up -d
```

### Traefik Routing
- Host: maptapdat.server.unarmedpuppy.com
- SSL: Via Traefik with Let's Encrypt

## Features Detail

### Leaderboards
- Overall total scores
- Daily scores with date filtering
- Sort by: total score, average, perfect scores, games played

### Analytics
- Emoji frequency analysis
- Location difficulty (avg score per location)
- Perfect score leaders
- Playing streaks (current and longest)
- Player achievements/badges

### Achievements System
Automatic badges for:
- First Steps (1 game)
- Getting Started (10 games)
- Dedicated Player (50 games)
- Century Club (100 games)
- Perfect Game (1000 points)
- Elite Scorer (950+ points)
- Streak Master (10+ day streak)
- And more...

## Boundaries

### Always Do
- Validate CSV format before updating
- Use `--no-cache` when rebuilding after data changes
- Keep usernames lowercase in CSV

### Ask First
- Adding new API endpoints
- Changing data schema
- Modifying achievement criteria

### Never Do
- Commit personal game data
- Remove existing API endpoints (may break frontend)
- Change CSV column names without updating server.js

## Data Collection

Data is collected via:
1. `parse_imessage.py` - Parse iMessage group chats for scores
2. `parse_entries.py` - Manual entry parsing

See scripts for usage details.

## See Also

- [Root AGENTS.md](../AGENTS.md) - Cross-project conventions
- [README.md](./README.md) - Feature details
