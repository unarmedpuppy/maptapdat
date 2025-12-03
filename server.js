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
                data.user = data.user.toLowerCase().trim();
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
    console.log('Dates Set:', dates);
    console.log('Dates Array:', Array.from(dates));
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
    
    // Calculate location performance (average score per location number)
    const locationStats = {};
    playerData.forEach(game => {
        const locNum = game.location_number;
        if (!locationStats[locNum]) {
            locationStats[locNum] = {
                location: locNum,
                totalScore: 0,
                attempts: 0,
                avgScore: 0,
                minScore: Infinity,
                maxScore: 0
            };
        }
        locationStats[locNum].totalScore += game.location_score;
        locationStats[locNum].attempts++;
        if (game.location_score < locationStats[locNum].minScore) {
            locationStats[locNum].minScore = game.location_score;
        }
        if (game.location_score > locationStats[locNum].maxScore) {
            locationStats[locNum].maxScore = game.location_score;
        }
    });
    
    // Calculate averages and find nemesis location (lowest average)
    const locationStatsArray = Object.values(locationStats).map(loc => {
        loc.avgScore = Math.round(loc.totalScore / loc.attempts);
        loc.minScore = loc.minScore === Infinity ? 0 : loc.minScore;
        return loc;
    }).sort((a, b) => a.avgScore - b.avgScore);
    
    const nemesisLocation = locationStatsArray.length > 0 ? locationStatsArray[0].location : null;
    
    const stats = {
        user: player,
        totalGames: gameDates.length,
        totalScore: totalScore,
        avgScore: Math.round(totalScore / gameDates.length),
        perfectScores: totalPerfectScores,
        lowestScore: Math.min(...allLowestScores),
        highestScore: Math.max(...allHighestScores),
        gamesByDate: gamesByDate,
        emojiCounts: emojiCounts,
        locationStats: locationStatsArray,
        nemesisLocation: nemesisLocation
    };
    
    res.json(stats);
});

app.get('/api/compare', (req, res) => {
    const { players } = req.query;
    
    if (!players) {
        return res.status(400).json({ error: 'players parameter required' });
    }
    
    // Parse players array from query string (comma-separated)
    const playerList = players.split(',').map(p => p.toLowerCase().trim()).filter(p => p);
    
    if (playerList.length < 2 || playerList.length > 3) {
        return res.status(400).json({ error: 'Must compare 2-3 players' });
    }
    
    // Get data for each player
    const comparisonData = playerList.map(playerName => {
        const playerData = gameData.filter(game => game.user === playerName);
        
        if (playerData.length === 0) {
            return null;
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
                    locationScores: []
                };
            }
            
            gamesByDate[game.date].locationScores.push(game.location_score);
            
            if (game.location_score === 100) {
                gamesByDate[game.date].perfectScores++;
            }
            if (game.location_score < gamesByDate[game.date].lowestScore) {
                gamesByDate[game.date].lowestScore = game.location_score;
            }
            if (game.location_score > gamesByDate[game.date].highestScore) {
                gamesByDate[game.date].highestScore = game.location_score;
            }
        });
        
        // Calculate overall statistics
        const gameDates = Object.keys(gamesByDate).sort();
        const totalScore = gameDates.reduce((sum, date) => sum + gamesByDate[date].totalScore, 0);
        const totalPerfectScores = gameDates.reduce((sum, date) => sum + gamesByDate[date].perfectScores, 0);
        const allScores = gameDates.map(date => gamesByDate[date].totalScore);
        const allLowestScores = gameDates.map(date => gamesByDate[date].lowestScore);
        const allHighestScores = gameDates.map(date => gamesByDate[date].highestScore);
        
        // Create trends data (date, score pairs)
        const trends = gameDates.map(date => ({
            date: date,
            score: gamesByDate[date].totalScore
        }));
        
        return {
            user: playerName,
            totalGames: gameDates.length,
            totalScore: totalScore,
            avgScore: Math.round(totalScore / gameDates.length),
            perfectScores: totalPerfectScores,
            lowestScore: Math.min(...allLowestScores),
            highestScore: Math.max(...allHighestScores),
            trends: trends,
            gamesByDate: gamesByDate
        };
    }).filter(p => p !== null);
    
    // Calculate head-to-head records (only for 2 players)
    let headToHead = null;
    if (comparisonData.length === 2) {
        const [p1, p2] = comparisonData;
        const p1Dates = new Set(p1.trends.map(t => t.date));
        const p2Dates = new Set(p2.trends.map(t => t.date));
        const commonDates = [...p1Dates].filter(d => p2Dates.has(d));
        
        let p1Wins = 0;
        let p2Wins = 0;
        let ties = 0;
        
        commonDates.forEach(date => {
            const p1Score = p1.gamesByDate[date].totalScore;
            const p2Score = p2.gamesByDate[date].totalScore;
            
            if (p1Score > p2Score) p1Wins++;
            else if (p2Score > p1Score) p2Wins++;
            else ties++;
        });
        
        headToHead = {
            commonGames: commonDates.length,
            [p1.user]: p1Wins,
            [p2.user]: p2Wins,
            ties: ties
        };
    }
    
    res.json({
        players: comparisonData,
        headToHead: headToHead
    });
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
    
    // Calculate streaks
    const streaks = calculateStreaks(gameGroups);
    
    // Calculate achievements/badges
    const achievements = calculateAchievements(gameGroups, streaks);
    
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
        },
        streaks: streaks,
        achievements: achievements
    });
});

// Helper function to calculate achievements/badges
function calculateAchievements(gameGroups, streaks) {
    const achievements = {};
    
    // Group games by user
    const userGames = {};
    Object.values(gameGroups).forEach(game => {
        if (!userGames[game.user]) {
            userGames[game.user] = [];
        }
        userGames[game.user].push(game);
    });
    
    Object.entries(userGames).forEach(([user, games]) => {
        const userAchievements = [];
        const uniqueDates = [...new Set(games.map(g => g.date))].sort();
        const totalGames = uniqueDates.length;
        
        // Calculate stats
        const totalScore = games.reduce((sum, g) => sum + g.totalScore, 0);
        const avgScore = Math.round(totalScore / totalGames);
        const scores = games.map(g => g.totalScore);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        
        // Achievement: First Game
        if (totalGames >= 1) {
            userAchievements.push({
                id: 'first-game',
                name: 'First Steps',
                description: 'Played your first game',
                icon: '🎮',
                unlocked: true,
                unlockedDate: uniqueDates[0]
            });
        }
        
        // Achievement: 10 Games
        if (totalGames >= 10) {
            userAchievements.push({
                id: '10-games',
                name: 'Getting Started',
                description: 'Played 10 games',
                icon: '🏃',
                unlocked: true,
                unlockedDate: uniqueDates[9]
            });
        }
        
        // Achievement: 50 Games
        if (totalGames >= 50) {
            userAchievements.push({
                id: '50-games',
                name: 'Dedicated Player',
                description: 'Played 50 games',
                icon: '💪',
                unlocked: true,
                unlockedDate: uniqueDates[49]
            });
        }
        
        // Achievement: 100 Games
        if (totalGames >= 100) {
            userAchievements.push({
                id: '100-games',
                name: 'Century Club',
                description: 'Played 100 games',
                icon: '🏆',
                unlocked: true,
                unlockedDate: uniqueDates[99]
            });
        }
        
        // Achievement: Perfect Score
        if (maxScore >= 1000) {
            const perfectGame = games.find(g => g.totalScore >= 1000);
            userAchievements.push({
                id: 'perfect-score',
                name: 'Perfect Game',
                description: 'Scored 1000 points',
                icon: '⭐',
                unlocked: true,
                unlockedDate: perfectGame.date
            });
        }
        
        // Achievement: High Score (950+)
        if (maxScore >= 950) {
            const highScoreGame = games.find(g => g.totalScore === maxScore);
            userAchievements.push({
                id: 'high-score',
                name: 'Elite Scorer',
                description: 'Scored 950+ points',
                icon: '🔥',
                unlocked: true,
                unlockedDate: highScoreGame.date
            });
        }
        
        // Achievement: Consistent Player (low std dev)
        if (totalGames >= 10) {
            const mean = totalScore / totalGames;
            const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / totalGames;
            const stdDev = Math.sqrt(variance);
            if (stdDev < 50) {
                userAchievements.push({
                    id: 'consistent',
                    name: 'Consistent Player',
                    description: 'Low score variance (std dev < 50)',
                    icon: '📊',
                    unlocked: true,
                    unlockedDate: uniqueDates[uniqueDates.length - 1]
                });
            }
        }
        
        // Achievement: Streak Master
        if (streaks && streaks.longestStreaks) {
            const userStreak = streaks.longestStreaks.find(s => s.user === user);
            if (userStreak && userStreak.streak >= 10) {
                userAchievements.push({
                    id: 'streak-master',
                    name: 'Streak Master',
                    description: `10+ day streak (${userStreak.streak} days)`,
                    icon: '🔥',
                    unlocked: true,
                    unlockedDate: userStreak.endDate
                });
            }
        }
        
        // Achievement: Comeback King (low score then high score)
        if (totalGames >= 5) {
            const firstHalf = scores.slice(0, Math.floor(totalGames / 2));
            const secondHalf = scores.slice(Math.floor(totalGames / 2));
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            if (secondAvg - firstAvg >= 100) {
                userAchievements.push({
                    id: 'comeback',
                    name: 'Comeback King',
                    description: 'Improved by 100+ points average',
                    icon: '📈',
                    unlocked: true,
                    unlockedDate: uniqueDates[uniqueDates.length - 1]
                });
            }
        }
        
        // Achievement: Average Ace (900+ avg)
        if (avgScore >= 900) {
            userAchievements.push({
                id: 'average-ace',
                name: 'Average Ace',
                description: '900+ average score',
                icon: '🎯',
                unlocked: true,
                unlockedDate: uniqueDates[uniqueDates.length - 1]
            });
        }
        
        achievements[user] = userAchievements.sort((a, b) => {
            const dateA = new Date(a.unlockedDate);
            const dateB = new Date(b.unlockedDate);
            return dateB - dateA; // Most recent first
        });
    });
    
    return achievements;
}

// Helper function to calculate streaks
function calculateStreaks(gameGroups) {
    // Group games by user
    const userGames = {};
    Object.values(gameGroups).forEach(game => {
        if (!userGames[game.user]) {
            userGames[game.user] = [];
        }
        userGames[game.user].push(game.date);
    });
    
    // Get most recent date across all games
    const allDates = Array.from(new Set(Object.values(gameGroups).map(g => g.date))).sort();
    const mostRecentDate = allDates[allDates.length - 1];
    
    // Helper function to add days to a date string
    function addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
    
    // Helper function to check if two dates are consecutive
    function isConsecutive(date1, date2) {
        const nextDay = addDays(date1, 1);
        return date2 === nextDay;
    }
    
    const currentStreaks = [];
    const longestStreaks = [];
    
    Object.entries(userGames).forEach(([user, dates]) => {
        // Remove duplicates and sort dates
        const uniqueDates = [...new Set(dates)].sort();
        
        if (uniqueDates.length === 0) return;
        
        // Calculate longest streak
        let longestStreak = 1;
        let currentStreakLength = 1;
        let longestStartDate = uniqueDates[0];
        let longestEndDate = uniqueDates[0];
        let currentStartDate = uniqueDates[0];
        
        for (let i = 1; i < uniqueDates.length; i++) {
            if (isConsecutive(uniqueDates[i - 1], uniqueDates[i])) {
                currentStreakLength++;
                if (currentStreakLength > longestStreak) {
                    longestStreak = currentStreakLength;
                    longestStartDate = currentStartDate;
                    longestEndDate = uniqueDates[i];
                }
            } else {
                currentStreakLength = 1;
                currentStartDate = uniqueDates[i];
            }
        }
        
        longestStreaks.push({
            user: user,
            streak: longestStreak,
            startDate: longestStartDate,
            endDate: longestEndDate
        });
        
        // Calculate current streak (ending at most recent date)
        let currentStreak = 0;
        let currentStreakStartDate = null;
        
        // Start from most recent date and work backwards
        let checkDate = mostRecentDate;
        let dateIndex = uniqueDates.indexOf(checkDate);
        
        if (dateIndex !== -1) {
            // Found the most recent date, start counting backwards
            currentStreak = 1;
            currentStreakStartDate = checkDate;
            
            for (let i = dateIndex - 1; i >= 0; i--) {
                if (isConsecutive(uniqueDates[i], uniqueDates[i + 1])) {
                    currentStreak++;
                    currentStreakStartDate = uniqueDates[i];
                } else {
                    break;
                }
            }
        }
        
        // Only add to current streaks if streak is active (ends at most recent date)
        if (currentStreak > 0 && uniqueDates.includes(mostRecentDate)) {
            currentStreaks.push({
                user: user,
                streak: currentStreak,
                startDate: currentStreakStartDate,
                endDate: mostRecentDate,
                isActive: true
            });
        }
    });
    
    // Sort streaks
    currentStreaks.sort((a, b) => b.streak - a.streak);
    longestStreaks.sort((a, b) => b.streak - a.streak);
    
    return {
        currentStreaks: currentStreaks,
        longestStreaks: longestStreaks
    };
}

app.get('/api/aggregations', (req, res) => {
    const { period = 'day', startDate, endDate } = req.query;
    
    // Helper function to get period key from date
    function getPeriodKey(dateStr, periodType) {
        const date = new Date(dateStr + 'T00:00:00');
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const week = getWeekNumber(date);
        
        switch(periodType) {
            case 'week':
                return `${year}-W${week.toString().padStart(2, '0')}`;
            case 'month':
                return `${year}-${month.toString().padStart(2, '0')}`;
            case 'quarter':
                const quarter = Math.floor(month / 3) + 1;
                return `${year}-Q${quarter}`;
            case 'year':
                return year.toString();
            default: // 'day'
                return dateStr;
        }
    }
    
    // Helper function to get week number
    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    // Filter by date range if provided
    let filteredData = gameData;
    if (startDate || endDate) {
        filteredData = gameData.filter(game => {
            if (startDate && game.date < startDate) return false;
            if (endDate && game.date > endDate) return false;
            return true;
        });
    }
    
    // Group games by user-date to get unique games
    const gameGroups = {};
    filteredData.forEach(game => {
        const key = `${game.user}-${game.date}`;
        if (!gameGroups[key]) {
            gameGroups[key] = {
                user: game.user,
                date: game.date,
                totalScore: game.total_score,
                periodKey: getPeriodKey(game.date, period)
            };
        }
    });
    
    // Group by period and user
    const periodData = {};
    Object.values(gameGroups).forEach(game => {
        const key = `${game.periodKey}-${game.user}`;
        if (!periodData[key]) {
            periodData[key] = {
                period: game.periodKey,
                user: game.user,
                totalScore: 0,
                gamesPlayed: 0,
                dates: []
            };
        }
        periodData[key].totalScore += game.totalScore;
        periodData[key].gamesPlayed++;
        periodData[key].dates.push(game.date);
    });
    
    // Calculate rolling averages (7-day and 30-day)
    const rollingAverages = calculateRollingAverages(gameGroups, period === 'day');
    
    // Convert to array and sort by period
    const aggregatedData = Object.values(periodData).sort((a, b) => {
        return a.period.localeCompare(b.period);
    });
    
    res.json({
        period: period,
        aggregations: aggregatedData,
        rollingAverages: rollingAverages
    });
});

// Helper function to calculate rolling averages
function calculateRollingAverages(gameGroups, isDaily) {
    if (!isDaily) {
        return { sevenDay: [], thirtyDay: [] };
    }
    
    // Convert to array and sort by date
    const games = Object.values(gameGroups)
        .map(g => ({ date: g.date, totalScore: g.totalScore }))
        .sort((a, b) => a.date.localeCompare(b.date));
    
    // Get unique dates
    const uniqueDates = [...new Set(games.map(g => g.date))].sort();
    
    // Calculate daily totals
    const dailyTotals = {};
    games.forEach(game => {
        if (!dailyTotals[game.date]) {
            dailyTotals[game.date] = { totalScore: 0, count: 0 };
        }
        dailyTotals[game.date].totalScore += game.totalScore;
        dailyTotals[game.date].count++;
    });
    
    // Calculate rolling averages
    const sevenDay = [];
    const thirtyDay = [];
    
    for (let i = 0; i < uniqueDates.length; i++) {
        const currentDate = uniqueDates[i];
        const date = new Date(currentDate + 'T00:00:00');
        
        // 7-day rolling average
        if (i >= 6) {
            let sum = 0;
            let count = 0;
            for (let j = i - 6; j <= i; j++) {
                const dayData = dailyTotals[uniqueDates[j]];
                if (dayData) {
                    sum += dayData.totalScore / dayData.count; // Average score for that day
                    count++;
                }
            }
            sevenDay.push({
                date: currentDate,
                avgScore: Math.round(sum / count)
            });
        }
        
        // 30-day rolling average
        if (i >= 29) {
            let sum = 0;
            let count = 0;
            for (let j = i - 29; j <= i; j++) {
                const dayData = dailyTotals[uniqueDates[j]];
                if (dayData) {
                    sum += dayData.totalScore / dayData.count;
                    count++;
                }
            }
            thirtyDay.push({
                date: currentDate,
                avgScore: Math.round(sum / count)
            });
        }
    }
    
    return { sevenDay, thirtyDay };
}

// Start server
loadCSVData().then(() => {
    app.listen(PORT, () => {
        console.log(`Maptap Data Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Error loading CSV data:', err);
    process.exit(1);
});
