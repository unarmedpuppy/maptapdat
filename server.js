const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Parse CSV data
let gameData = [];
let players = new Set();
let dates = new Set();

function loadCSVData() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream('data.csv')
            .pipe(csv())
            .on('data', (data) => {
                // Clean up the data
                data.location_score = parseInt(data.location_score);
                data.total_score = parseInt(data.total_score);
                data.location_number = parseInt(data.location_number);
                
                results.push(data);
                players.add(data.user);
                dates.add(data.date);
            })
            .on('end', () => {
                gameData = results;
                console.log(`Loaded ${gameData.length} game records`);
                resolve();
            })
            .on('error', reject);
    });
}

// API Routes
app.get('/api/data', (req, res) => {
    res.json(gameData);
});

app.get('/api/players', (req, res) => {
    res.json(Array.from(players).sort());
});

app.get('/api/dates', (req, res) => {
    res.json(Array.from(dates).sort());
});

app.get('/api/leaderboard', (req, res) => {
    const { type = 'overall', date } = req.query;
    
    let filteredData = gameData;
    if (date) {
        filteredData = gameData.filter(game => game.date === date);
    }
    
    // Group by user and calculate totals
    const userTotals = {};
    filteredData.forEach(game => {
        if (!userTotals[game.user]) {
            userTotals[game.user] = {
                user: game.user,
                totalScore: 0,
                gamesPlayed: 0,
                avgScore: 0,
                perfectScores: 0,
                lowestScore: Infinity,
                emojiCounts: {}
            };
        }
        
        userTotals[game.user].totalScore += game.total_score;
        userTotals[game.user].gamesPlayed++;
        
        if (game.location_score === 100) {
            userTotals[game.user].perfectScores++;
        }
        
        if (game.location_score < userTotals[game.user].lowestScore) {
            userTotals[game.user].lowestScore = game.location_score;
        }
        
        // Count emojis
        if (game.location_emoji) {
            userTotals[game.user].emojiCounts[game.location_emoji] = 
                (userTotals[game.user].emojiCounts[game.location_emoji] || 0) + 1;
        }
    });
    
    // Calculate averages
    Object.values(userTotals).forEach(user => {
        user.avgScore = Math.round(user.totalScore / user.gamesPlayed);
    });
    
    // Sort by total score
    const leaderboard = Object.values(userTotals).sort((a, b) => b.totalScore - a.totalScore);
    
    res.json(leaderboard);
});

app.get('/api/trends', (req, res) => {
    const { player } = req.query;
    
    let filteredData = gameData;
    if (player) {
        filteredData = gameData.filter(game => game.user === player);
    }
    
    // Group by date and calculate daily totals
    const dailyTotals = {};
    filteredData.forEach(game => {
        if (!dailyTotals[game.date]) {
            dailyTotals[game.date] = {};
        }
        if (!dailyTotals[game.date][game.user]) {
            dailyTotals[game.date][game.user] = {
                user: game.user,
                date: game.date,
                totalScore: 0,
                gamesPlayed: 0,
                avgScore: 0,
                perfectScores: 0
            };
        }
        
        dailyTotals[game.date][game.user].totalScore += game.total_score;
        dailyTotals[game.date][game.user].gamesPlayed++;
        
        if (game.location_score === 100) {
            dailyTotals[game.date][game.user].perfectScores++;
        }
    });
    
    // Calculate averages and flatten
    const trends = [];
    Object.values(dailyTotals).forEach(dateData => {
        Object.values(dateData).forEach(userData => {
            userData.avgScore = Math.round(userData.totalScore / userData.gamesPlayed);
            trends.push(userData);
        });
    });
    
    res.json(trends.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

app.get('/api/player/:player', (req, res) => {
    const player = req.params.player;
    const playerData = gameData.filter(game => game.user === player);
    
    if (playerData.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
    }
    
    // Calculate player statistics
    const stats = {
        user: player,
        totalGames: playerData.length,
        totalScore: playerData.reduce((sum, game) => sum + game.total_score, 0),
        avgScore: Math.round(playerData.reduce((sum, game) => sum + game.total_score, 0) / playerData.length),
        perfectScores: playerData.filter(game => game.location_score === 100).length,
        lowestScore: Math.min(...playerData.map(game => game.location_score)),
        highestScore: Math.max(...playerData.map(game => game.location_score)),
        gamesByDate: {},
        emojiCounts: {}
    };
    
    // Group by date
    playerData.forEach(game => {
        if (!stats.gamesByDate[game.date]) {
            stats.gamesByDate[game.date] = [];
        }
        stats.gamesByDate[game.date].push(game);
        
        // Count emojis
        if (game.location_emoji) {
            stats.emojiCounts[game.location_emoji] = 
                (stats.emojiCounts[game.location_emoji] || 0) + 1;
        }
    });
    
    res.json(stats);
});

app.get('/api/analytics', (req, res) => {
    // Emoji frequency analysis
    const emojiCounts = {};
    const locationDifficulty = {};
    const perfectScoreUsers = {};
    
    gameData.forEach(game => {
        // Count emojis
        if (game.location_emoji) {
            emojiCounts[game.location_emoji] = (emojiCounts[game.location_emoji] || 0) + 1;
        }
        
        // Track location difficulty (lower scores = harder)
        if (!locationDifficulty[game.location_number]) {
            locationDifficulty[game.location_number] = {
                location: game.location_number,
                totalScore: 0,
                attempts: 0,
                avgScore: 0
            };
        }
        locationDifficulty[game.location_number].totalScore += game.location_score;
        locationDifficulty[game.location_number].attempts++;
        
        // Track perfect scores by user
        if (game.location_score === 100) {
            perfectScoreUsers[game.user] = (perfectScoreUsers[game.user] || 0) + 1;
        }
    });
    
    // Calculate location averages
    Object.values(locationDifficulty).forEach(loc => {
        loc.avgScore = Math.round(loc.totalScore / loc.attempts);
    });
    
    // Sort by difficulty (lowest average = hardest)
    const sortedLocations = Object.values(locationDifficulty)
        .sort((a, b) => a.avgScore - b.avgScore);
    
    // Sort perfect score users
    const sortedPerfectUsers = Object.entries(perfectScoreUsers)
        .map(([user, count]) => ({ user, perfectScores: count }))
        .sort((a, b) => b.perfectScores - a.perfectScores);
    
    res.json({
        emojiFrequency: Object.entries(emojiCounts)
            .map(([emoji, count]) => ({ emoji, count }))
            .sort((a, b) => b.count - a.count),
        locationDifficulty: sortedLocations,
        perfectScoreLeaders: sortedPerfectUsers,
        totalGames: gameData.length,
        uniquePlayers: players.size,
        dateRange: {
            start: Math.min(...Array.from(dates)),
            end: Math.max(...Array.from(dates))
        }
    });
});

// Start server
loadCSVData().then(() => {
    app.listen(PORT, () => {
        console.log(`Maptap Data Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Error loading CSV data:', err);
    process.exit(1);
});
