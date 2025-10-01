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
                // Skip entries with empty required fields
                if (!data.user || !data.date || !data.location_number || !data.location_score || !data.total_score) {
                    return;
                }
                
                // Clean up the data
                data.location_score = parseInt(data.location_score);
                data.total_score = parseInt(data.total_score);
                data.location_number = parseInt(data.location_number);
                
                // Skip if parsing failed (NaN values)
                if (isNaN(data.location_score) || isNaN(data.total_score) || isNaN(data.location_number)) {
                    return;
                }
                
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
    
    // Group by user and date, then calculate totals
    const userDailyTotals = {};
    filteredData.forEach(game => {
        const key = `${game.user}-${game.date}`;
        if (!userDailyTotals[key]) {
            userDailyTotals[key] = {
                user: game.user,
                date: game.date,
                totalScore: game.total_score, // Use the total_score from the game (same for all locations)
                perfectScores: 0,
                lowestScore: Infinity,
                emojiCounts: {}
            };
        }
        
        // Only count perfect scores and lowest scores from individual locations
        if (game.location_score === 100) {
            userDailyTotals[key].perfectScores++;
        }
        
        if (game.location_score < userDailyTotals[key].lowestScore) {
            userDailyTotals[key].lowestScore = game.location_score;
        }
        
        // Count emojis
        if (game.location_emoji) {
            userDailyTotals[key].emojiCounts[game.location_emoji] = 
                (userDailyTotals[key].emojiCounts[game.location_emoji] || 0) + 1;
        }
    });
    
    // Aggregate by user
    const userTotals = {};
    Object.values(userDailyTotals).forEach(dailyData => {
        if (!userTotals[dailyData.user]) {
            userTotals[dailyData.user] = {
                user: dailyData.user,
                totalScore: 0,
                gamesPlayed: 0,
                avgScore: 0,
                perfectScores: 0,
                lowestScore: Infinity,
                emojiCounts: {}
            };
        }
        
        userTotals[dailyData.user].totalScore += dailyData.totalScore;
        userTotals[dailyData.user].gamesPlayed++;
        userTotals[dailyData.user].perfectScores += dailyData.perfectScores;
        
        if (dailyData.lowestScore < userTotals[dailyData.user].lowestScore) {
            userTotals[dailyData.user].lowestScore = dailyData.lowestScore;
        }
        
        // Merge emoji counts
        Object.entries(dailyData.emojiCounts).forEach(([emoji, count]) => {
            userTotals[dailyData.user].emojiCounts[emoji] = 
                (userTotals[dailyData.user].emojiCounts[emoji] || 0) + count;
        });
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
    
    // Group by date and user, then calculate daily totals
    const dailyTotals = {};
    filteredData.forEach(game => {
        const key = `${game.user}-${game.date}`;
        if (!dailyTotals[key]) {
            dailyTotals[key] = {
                user: game.user,
                date: game.date,
                totalScore: game.total_score, // Use the total_score from the game
                perfectScores: 0
            };
        }
        
        // Only count perfect scores from individual locations
        if (game.location_score === 100) {
            dailyTotals[key].perfectScores++;
        }
    });
    
    // Convert to date-grouped format
    const dateGroupedTotals = {};
    Object.values(dailyTotals).forEach(gameData => {
        if (!dateGroupedTotals[gameData.date]) {
            dateGroupedTotals[gameData.date] = {};
        }
        dateGroupedTotals[gameData.date][gameData.user] = gameData;
    });
    
    // Calculate averages and flatten
    const trends = [];
    Object.values(dailyTotals).forEach(gameData => {
        trends.push({
            user: gameData.user,
            date: gameData.date,
            totalScore: gameData.totalScore,
            perfectScores: gameData.perfectScores
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
    
    // Group by date to get unique games
    const gamesByDate = {};
    playerData.forEach(game => {
        if (!gamesByDate[game.date]) {
            gamesByDate[game.date] = {
                totalScore: game.total_score,
                perfectScores: 0,
                lowestScore: Infinity,
                highestScore: 0,
                emojiCounts: {}
            };
        }
        
        // Track perfect scores and score ranges from individual locations
        if (game.location_score === 100) {
            gamesByDate[game.date].perfectScores++;
        }
        
        if (game.location_score < gamesByDate[game.date].lowestScore) {
            gamesByDate[game.date].lowestScore = game.location_score;
        }
        
        if (game.location_score > gamesByDate[game.date].highestScore) {
            gamesByDate[game.date].highestScore = game.location_score;
        }
        
        // Count emojis
        if (game.location_emoji) {
            gamesByDate[game.date].emojiCounts[game.location_emoji] = 
                (gamesByDate[game.date].emojiCounts[game.location_emoji] || 0) + 1;
        }
    });
    
    // Calculate overall statistics
    const gameDates = Object.keys(gamesByDate);
    const totalScore = gameDates.reduce((sum, date) => sum + gamesByDate[date].totalScore, 0);
    const totalPerfectScores = gameDates.reduce((sum, date) => sum + gamesByDate[date].perfectScores, 0);
    const allLowestScores = gameDates.map(date => gamesByDate[date].lowestScore);
    const allHighestScores = gameDates.map(date => gamesByDate[date].highestScore);
    
    // Merge emoji counts across all games
    const emojiCounts = {};
    gameDates.forEach(date => {
        Object.entries(gamesByDate[date].emojiCounts).forEach(([emoji, count]) => {
            emojiCounts[emoji] = (emojiCounts[emoji] || 0) + count;
        });
    });
    
    const stats = {
        user: player,
        totalGames: gameDates.length,
        totalScore: totalScore,
        avgScore: Math.round(totalScore / gameDates.length),
        perfectScores: totalPerfectScores,
        lowestScore: Math.min(...allLowestScores),
        highestScore: Math.max(...allHighestScores),
        gamesByDate: gamesByDate,
        emojiCounts: emojiCounts
    };
    
    res.json(stats);
});

app.get('/api/analytics', (req, res) => {
    // Emoji frequency analysis
    const emojiCounts = {};
    const locationDifficulty = {};
    const perfectScoreUsers = {};
    
    // Group by user-date to avoid double counting
    const gameGroups = {};
    gameData.forEach(game => {
        const key = `${game.user}-${game.date}`;
        if (!gameGroups[key]) {
            gameGroups[key] = {
                user: game.user,
                date: game.date,
                locations: []
            };
        }
        gameGroups[key].locations.push(game);
    });
    
    Object.values(gameGroups).forEach(game => {
        game.locations.forEach(location => {
            // Count emojis
            if (location.location_emoji) {
                emojiCounts[location.location_emoji] = (emojiCounts[location.location_emoji] || 0) + 1;
            }
            
            // Track location difficulty (lower scores = harder)
            if (!locationDifficulty[location.location_number]) {
                locationDifficulty[location.location_number] = {
                    location: location.location_number,
                    totalScore: 0,
                    attempts: 0,
                    avgScore: 0
                };
            }
            locationDifficulty[location.location_number].totalScore += location.location_score;
            locationDifficulty[location.location_number].attempts++;
            
            // Track perfect scores by user
            if (location.location_score === 100) {
                perfectScoreUsers[game.user] = (perfectScoreUsers[game.user] || 0) + 1;
            }
        });
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
        totalGames: dates.size, // Count unique dates, not individual records
        uniquePlayers: players.size,
        dateRange: {
            start: Array.from(dates).sort()[0],
            end: Array.from(dates).sort().slice(-1)[0]
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
