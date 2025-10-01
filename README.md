# Maptap Data Dashboard

A beautiful, mobile-friendly web application for visualizing Maptap.gg score data. This dashboard provides comprehensive analytics and visualizations for geography guessing game scores.

## Features

### 📊 Analytics & Visualizations
- **Overview Dashboard**: Key statistics and recent performance trends
- **Leaderboards**: Overall and daily score rankings with multiple sorting options
- **Score Trends**: Time-series analysis of player performance
- **Emoji Analytics**: Frequency analysis of score emojis
- **Location Difficulty**: Analysis of which locations are hardest/easiest
- **Perfect Score Leaders**: Players with the most 100-point scores

### 🎮 Game Data Insights
- Total games played and unique players
- Date range coverage
- Perfect score tracking
- Individual player performance charts
- Lowest score identification
- Emoji sentiment analysis

### 📱 User Experience
- **Mobile-First Design**: Optimized for mobile devices with app-like interface
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **Responsive Layout**: Works seamlessly on all screen sizes
- **Modern UI**: Clean, modern design with Inter font and smooth animations
- **Interactive Filters**: Filter by player, date, and sorting options
- **Real-time Updates**: Dynamic charts and data visualization

## Technical Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript with Chart.js
- **Styling**: Modern CSS with CSS Grid/Flexbox
- **Data**: CSV parsing with real-time API endpoints
- **Containerization**: Docker with multi-stage builds
- **Reverse Proxy**: Traefik with SSL termination
- **Integration**: Homepage dashboard integration

## API Endpoints

- `GET /api/data` - Raw game data
- `GET /api/players` - List of all players
- `GET /api/dates` - List of all game dates
- `GET /api/leaderboard` - Leaderboard data (supports date filtering)
- `GET /api/trends` - Score trends over time (supports player filtering)
- `GET /api/player/:player` - Individual player statistics
- `GET /api/analytics` - Comprehensive analytics data

## Data Structure

The application expects a CSV file with the following columns:
- `user`: Player name
- `date`: Game date (YYYY-MM-DD format)
- `location_number`: Location identifier (1-5)
- `location_score`: Score for that location (0-100)
- `location_emoji`: Emoji representing the score
- `total_score`: Total score for the game

## Deployment

### Using Docker Compose

1. Place your `data.csv` file in the application directory
2. Run the application:
   ```bash
   docker-compose up -d
   ```

### Updating Data

To update the CSV data:
1. Replace the `data.csv` file with new data
2. Rebuild the container:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## Configuration

The application is configured to run on `maptapdat.server.unarmedpuppy.com` with:
- Automatic HTTPS redirect
- SSL certificate management via Traefik
- Homepage dashboard integration
- Health checks and restart policies

## Development

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Access the application at `http://localhost:3000`

### Building for Production

```bash
docker build -t maptapdat .
```

## Features in Detail

### Leaderboard Views
- **Overall**: All-time total scores
- **Daily**: Scores for specific dates
- **Sorting Options**: Total score, average score, perfect scores, games played

### Analytics Dashboard
- **Emoji Frequency**: Most common score emojis
- **Location Difficulty**: Average scores by location number
- **Perfect Score Leaders**: Players with most 100-point scores
- **Performance Trends**: Score progression over time

### Mobile Optimization
- Touch-friendly interface
- Responsive charts and tables
- Optimized loading and performance
- App-like navigation and interactions

## License

MIT License - feel free to use and modify for your own Maptap data!
