class MaptapDashboard {
    constructor() {
        this.data = {
            games: [],
            players: [],
            dates: [],
            leaderboard: [],
            trends: [],
            analytics: {}
        };
        
        this.currentSection = 'overview';
        this.currentFilters = {
            player: '',
            date: '',
            sort: 'totalScore'
        };
        
        this.charts = {};
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.populateFilters();
        this.updateOverview();
        this.hideLoading();
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Filters toggle
        document.getElementById('filters-toggle').addEventListener('click', () => {
            this.openFilters();
        });
        
        // Filters close
        document.getElementById('filters-close').addEventListener('click', () => {
            this.closeFilters();
        });
        
        // Filters
        document.getElementById('player-filter').addEventListener('change', (e) => {
            this.currentFilters.player = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('date-filter').addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
            
            // Update URL hash if we're on leaderboard section
            if (this.currentSection === 'leaderboard') {
                if (e.target.value) {
                    window.location.hash = `leaderboard?date=${e.target.value}`;
                } else {
                    window.location.hash = 'leaderboard';
                }
            }
            
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
        });
        
        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
        });
        
        // Raw data controls
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportCSV();
        });
        
        document.getElementById('refresh-data').addEventListener('click', () => {
            this.loadData();
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });
        
        // Leaderboard controls
        document.getElementById('overall-leaderboard').addEventListener('click', () => {
            this.currentFilters.date = '';
            this.currentFilters.sort = 'avgScore';
            document.getElementById('date-filter').value = '';
            document.getElementById('sort-filter').value = 'avgScore';
            this.hideLeaderboardDate();
            this.showLeaderboardSort('avgScore');
            this.applyFilters();
            this.updateLeaderboard();
        });
        
        document.getElementById('daily-leaderboard').addEventListener('click', () => {
            // Set to most recent date
            const mostRecentDate = this.getMostRecentDate();
            this.currentFilters.date = mostRecentDate;
            this.currentFilters.sort = 'totalScore';
            document.getElementById('date-filter').value = mostRecentDate;
            document.getElementById('sort-filter').value = 'totalScore';
            
            // Update URL hash with date parameter
            window.location.hash = `leaderboard?date=${mostRecentDate}`;
            
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
            this.updateLeaderboard();
        });
    }
    
    async loadData() {
        console.log('Starting to load data...');
        try {
            const [games, players, dates, analytics] = await Promise.all([
                fetch('/api/data').then(r => r.json()),
                fetch('/api/players').then(r => r.json()),
                fetch('/api/dates').then(r => r.json()),
                fetch('/api/analytics').then(r => r.json())
            ]);
            
            console.log('Data loaded successfully:', { games: games.length, players: players.length, dates: dates.length });
            
            this.data.games = games;
            this.data.players = players;
            this.data.dates = dates;
            this.data.analytics = analytics;
            
            // Normalize user names to lowercase for consistency
            this.data.games.forEach(game => {
                game.user = game.user.toLowerCase().trim();
            });
            
            // Update players list with normalized names
            this.data.players = [...new Set(this.data.games.map(game => game.user))].sort();
            
            // Set default to daily leaderboard (most recent date)
            const mostRecentDate = this.getMostRecentDate();
            this.currentFilters.date = mostRecentDate;
            this.currentFilters.sort = 'totalScore';
            
            this.populateFilters();
            this.applyFilters();
            this.updateLeaderboardSortIndicator(); // Initialize sort indicator
            this.hideLoading();
            
            // Initialize routing - check URL hash first
            this.handleHashChange();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please refresh the page.');
        }
    }
    
    populateFilters() {
        const playerFilter = document.getElementById('player-filter');
        const dateFilter = document.getElementById('date-filter');
        
        // Clear existing options first
        playerFilter.innerHTML = '<option value="">All Players</option>';
        dateFilter.innerHTML = '<option value="">All Dates</option>';
        
        // Populate players
        this.data.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            playerFilter.appendChild(option);
        });
        
        // Populate dates (remove duplicates and sort)
        console.log('Raw dates from API:', this.data.dates);
        const uniqueDates = [...new Set(this.data.dates)].sort().reverse(); // Most recent first
        console.log('Unique dates after deduplication:', uniqueDates);
        
        uniqueDates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            // Convert YYYY-MM-DD to MM/DD/YYYY format without using Date objects
            const [year, month, day] = date.split('-');
            const displayDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
            option.textContent = displayDate;
            dateFilter.appendChild(option);
        });
        
        // Set default values in UI
        playerFilter.value = this.currentFilters.player;
        dateFilter.value = this.currentFilters.date;
        document.getElementById('sort-filter').value = this.currentFilters.sort;
    }
    
    applyFilters() {
        // Filter the data based on current filters
        let filteredGames = [...this.data.games];
        
        // Apply player filter
        if (this.currentFilters.player) {
            filteredGames = filteredGames.filter(game => game.user.toLowerCase().trim() === this.currentFilters.player.toLowerCase().trim());
        }
        
        // Apply date filter
        if (this.currentFilters.date) {
            filteredGames = filteredGames.filter(game => game.date === this.currentFilters.date);
        }
        
        // Store filtered data
        this.filteredData = {
            games: filteredGames,
            players: this.data.players,
            dates: this.data.dates,
            analytics: this.data.analytics
        };
        
        // Update current section with filtered data
        this.updateCurrentSection();
    }
    
    showSection(sectionName) {
        // Update URL hash
        window.location.hash = sectionName;
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Show section
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');
        
        this.currentSection = sectionName;
        this.updateCurrentSection();
        
        // Scroll to top of the page instead of bottom
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    handleHashChange() {
        const hash = window.location.hash.substring(1); // Remove the #
        const validSections = ['overview', 'leaderboard', 'trends', 'analytics', 'rawdata'];
        
        // Check if hash contains a date parameter for daily leaderboard
        const hashParts = hash.split('?');
        const section = hashParts[0];
        const params = hashParts[1] ? new URLSearchParams(hashParts[1]) : null;
        
        if (hash && validSections.includes(section)) {
            this.showSection(section);
            
            // Handle daily leaderboard with date parameter
            if (section === 'leaderboard' && params && params.has('date')) {
                const date = params.get('date');
                this.currentFilters.date = date;
                this.currentFilters.sort = 'totalScore';
                document.getElementById('date-filter').value = date;
                document.getElementById('sort-filter').value = 'totalScore';
                this.updateLeaderboardSortIndicator();
                this.applyFilters();
                this.updateLeaderboard();
            } else if (section === 'leaderboard') {
                // Default to daily leaderboard if no date parameter
                const mostRecentDate = this.getMostRecentDate();
                this.currentFilters.date = mostRecentDate;
                this.currentFilters.sort = 'totalScore';
                document.getElementById('date-filter').value = mostRecentDate;
                document.getElementById('sort-filter').value = 'totalScore';
                this.updateLeaderboardSortIndicator();
                this.applyFilters();
                this.updateLeaderboard();
            }
        } else {
            // Default to overview if no valid hash
            this.showSection('overview');
        }
    }
    
    updateCurrentSection() {
        switch (this.currentSection) {
            case 'overview':
                this.updateOverview();
                break;
            case 'leaderboard':
                this.updateLeaderboard();
                break;
            case 'trends':
                this.updateTrends();
                break;
            case 'analytics':
                this.updateAnalytics();
                break;
            case 'rawdata':
                this.updateRawData();
                break;
        }
    }
    
    async updateOverview() {
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        // Update stats
        document.getElementById('total-games').textContent = dataToUse.analytics.totalGames || 0;
        document.getElementById('total-players').textContent = dataToUse.analytics.uniquePlayers || 0;
        document.getElementById('perfect-scores').textContent = 
            dataToUse.analytics.perfectScoreLeaders?.reduce((sum, user) => sum + user.perfectScores, 0) || 0;
        
        const dateRange = dataToUse.analytics.dateRange;
        if (dateRange) {
            const start = new Date(dateRange.start).toLocaleDateString();
            const end = new Date(dateRange.end).toLocaleDateString();
            document.getElementById('date-range').textContent = `${start} - ${end}`;
        }
        
        // Update daily winner and loser
        this.updateDailyWinnerLoser(dataToUse.games);
        
        // Update overall stats
        this.updateOverallStats(dataToUse.games);
        
    }
    
    updateDailyWinnerLoser(games) {
        // Get the most recent date
        const mostRecentDate = this.getMostRecentDate(games);
        
        if (mostRecentDate === 'No data available') {
            document.getElementById('daily-winner').textContent = 'No Data';
            document.getElementById('daily-loser').textContent = 'No Data';
            return;
        }
        
        // Group games by user-date to get unique games per user for the most recent date
        const userGames = {};
        
        games.forEach(game => {
            if (game.date === mostRecentDate) {
                const key = `${game.user}-${game.date}`;
                if (!userGames[key]) {
                    userGames[key] = {
                        user: game.user,
                        date: game.date,
                        totalScore: game.total_score
                    };
                }
            }
        });
        
        // Convert to array and sort by total score
        const dailyScores = Object.values(userGames).sort((a, b) => b.totalScore - a.totalScore);
        
        if (dailyScores.length === 0) {
            document.getElementById('daily-winner').textContent = 'No Games';
            document.getElementById('daily-loser').textContent = 'No Games';
            return;
        }
        
        // Get winner (highest score) and loser (lowest score)
        const winner = dailyScores[0];
        const loser = dailyScores[dailyScores.length - 1];
        
        // Format date for display
        const [year, month, day] = mostRecentDate.split('-');
        const displayDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
        
        // Update winner widget
        document.getElementById('daily-winner').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${winner.user}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${winner.totalScore} points</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${displayDate}</div>
        `;
        
        // Update loser widget
        document.getElementById('daily-loser').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${loser.user}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${loser.totalScore} points</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${displayDate}</div>
        `;
    }
    
    updateOverallStats(games) {
        // Calculate overall leaderboard to get average scores
        const leaderboard = this.calculateLeaderboard(games);
        
        if (leaderboard.length === 0) {
            document.getElementById('overall-winner').textContent = 'No Data';
            document.getElementById('overall-loser').textContent = 'No Data';
            document.getElementById('most-games').textContent = 'No Data';
            document.getElementById('least-games').textContent = 'No Data';
            return;
        }
        
        // Sort by average score for winner/loser
        const sortedByAvgScore = [...leaderboard].sort((a, b) => b.avgScore - a.avgScore);
        const overallWinner = sortedByAvgScore[0];
        const overallLoser = sortedByAvgScore[sortedByAvgScore.length - 1];
        
        // Calculate games played correctly - count unique dates per user
        const userGameCounts = {};
        games.forEach(game => {
            if (!userGameCounts[game.user]) {
                userGameCounts[game.user] = new Set();
            }
            userGameCounts[game.user].add(game.date);
        });
        
        // Convert to array with actual game counts
        const gameCounts = Object.entries(userGameCounts).map(([user, dates]) => ({
            user: user,
            gamesPlayed: dates.size
        })).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
        
        const mostGames = gameCounts[0].gamesPlayed;
        const leastGames = gameCounts[gameCounts.length - 1].gamesPlayed;
        
        // Find all players with most games (handle ties)
        const mostGamesPlayers = gameCounts.filter(player => player.gamesPlayed === mostGames);
        const leastGamesPlayers = gameCounts.filter(player => player.gamesPlayed === leastGames);
        
        // Update overall winner widget
        document.getElementById('overall-winner').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${overallWinner.user}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${overallWinner.avgScore} avg</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${overallWinner.gamesPlayed} games</div>
        `;
        
        // Update overall loser widget
        document.getElementById('overall-loser').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${overallLoser.user}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${overallLoser.avgScore} avg</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${overallLoser.gamesPlayed} games</div>
        `;
        
        // Update most games widget (handle ties)
        const mostGamesText = mostGamesPlayers.length > 1 
            ? mostGamesPlayers.map(p => p.user).join(', ')
            : mostGamesPlayers[0].user;
        document.getElementById('most-games').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${mostGamesText}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${mostGames} games</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${mostGamesPlayers.length > 1 ? 'tied' : 'total'}</div>
        `;
        
        // Update least games widget (handle ties)
        const leastGamesText = leastGamesPlayers.length > 1 
            ? leastGamesPlayers.map(p => p.user).join(', ')
            : leastGamesPlayers[0].user;
        document.getElementById('least-games').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold;">${leastGamesText}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${leastGames} games</div>
            <div style="font-size: 0.8rem; opacity: 0.6;">${leastGamesPlayers.length > 1 ? 'tied' : 'total'}</div>
        `;
    }
    
    async updateLeaderboard() {
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        // Calculate leaderboard from filtered data
        const leaderboard = this.calculateLeaderboard(dataToUse.games);
        
        // Sort by current sort option
        leaderboard.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'avgScore':
                    return b.avgScore - a.avgScore;
                case 'perfectScores':
                    return b.perfectScores - a.perfectScores;
                case 'gamesPlayed':
                    return b.gamesPlayed - a.gamesPlayed;
                default:
                    return b.totalScore - a.totalScore;
            }
        });
        
        this.data.leaderboard = leaderboard;
        this.createLeaderboardChart();
        this.updateLeaderboardTable();
    }
    
    calculateLeaderboard(games) {
        console.log('Calculating leaderboard for', games.length, 'games');
        
        // Group games by user-date to get unique games per user
        const userGames = {};
        
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!userGames[key]) {
                userGames[key] = {
                    user: game.user,
                    date: game.date,
                    totalScore: game.total_score,
                    locationScores: []
                };
            }
            userGames[key].locationScores.push(game.location_score);
        });
        
        console.log('Grouped into', Object.keys(userGames).length, 'unique games');
        
        // Check if this is a daily leaderboard (filtered by specific date)
        const isDailyLeaderboard = this.currentFilters.date && this.currentFilters.date !== '';
        if (isDailyLeaderboard) {
            console.log('Daily leaderboard for date:', this.currentFilters.date);
        }
        
        // Calculate stats for each user
        const userStats = {};
        
        Object.values(userGames).forEach(game => {
            const user = game.user;
            if (!userStats[user]) {
                userStats[user] = {
                    user: user,
                    totalScore: 0,
                    gamesPlayed: 0,
                    perfectScores: 0,
                    lowestScore: Infinity,
                    highestScore: 0,
                    locationScores: []
                };
            }
            
            // For daily leaderboard, only count games from the selected date
            if (isDailyLeaderboard) {
                if (game.date === this.currentFilters.date) {
                    userStats[user].totalScore = game.totalScore; // Single day score
                    userStats[user].gamesPlayed = 1; // One game for the day
                    userStats[user].locationScores = [...game.locationScores];
                    
                    // Count perfect scores for this day
                    game.locationScores.forEach(score => {
                        if (score === 100) userStats[user].perfectScores += 1;
                        if (score < userStats[user].lowestScore) userStats[user].lowestScore = score;
                        if (score > userStats[user].highestScore) userStats[user].highestScore = score;
                    });
                }
            } else {
                // Overall leaderboard - sum all games
                userStats[user].totalScore += game.totalScore;
                userStats[user].gamesPlayed += 1;
                userStats[user].locationScores.push(...game.locationScores);
                
                // Count perfect scores
                game.locationScores.forEach(score => {
                    if (score === 100) userStats[user].perfectScores += 1;
                    if (score < userStats[user].lowestScore) userStats[user].lowestScore = score;
                    if (score > userStats[user].highestScore) userStats[user].highestScore = score;
                });
            }
        });
        
        // Convert to array and calculate averages
        const result = Object.values(userStats).map(user => {
            const avgScore = Math.round(user.totalScore / user.gamesPlayed);
            
            // Debug: Show individual game scores for this user
            console.log(`\n=== ${user.user.toUpperCase()} ===`);
            console.log(`Total Score: ${user.totalScore}`);
            console.log(`Games Played: ${user.gamesPlayed}`);
            console.log(`Average Score: ${avgScore}`);
            
            if (isDailyLeaderboard) {
                console.log(`Daily Score for ${this.currentFilters.date}: ${user.totalScore} points`);
            } else {
                console.log('Individual Games:');
                
                // Show each game for this user
                Object.values(userGames)
                    .filter(game => game.user === user.user)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .forEach(game => {
                        console.log(`  ${game.date}: ${game.totalScore} points`);
                    });
            }
            
            return {
                user: user.user,
                totalScore: user.totalScore,
                avgScore: avgScore,
                gamesPlayed: user.gamesPlayed,
                perfectScores: user.perfectScores,
                lowestScore: user.lowestScore === Infinity ? 0 : user.lowestScore,
                highestScore: user.highestScore
            };
        });
        
        console.log('Final leaderboard:', result);
        return result;
    }
    
    async updateTrends() {
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        // Calculate trends from filtered data
        const trends = this.calculateTrends(dataToUse.games);
        this.data.trends = trends;
        this.createTrendsChart();
    }
    
    calculateTrends(games) {
        console.log('Calculating trends for', games.length, 'games');
        
        // Group by user-date to get individual game scores
        const userGameScores = {};
        
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!userGameScores[key]) {
                userGameScores[key] = {
                    user: game.user,
                    date: game.date,
                    totalScore: game.total_score
                };
            }
        });
        
        // Convert to array and sort by date
        const trends = Object.values(userGameScores)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
            
        console.log('Calculated trends:', trends);
        return trends;
    }
    
    updateAnalytics() {
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        this.createEmojiChart(dataToUse.games);
        this.createStreaksChart(dataToUse.games);
        this.createPerfectLeadersChart(dataToUse.games);
    }
    
    
    createLeaderboardChart() {
        const ctx = document.getElementById('leaderboard-chart').getContext('2d');
        
        if (this.charts.leaderboard) {
            this.charts.leaderboard.destroy();
        }
        
        const topPlayers = this.data.leaderboard.slice(0, 10);
        const labels = topPlayers.map(player => player.user);
        
        // Determine what data to show based on sort filter
        let data, label;
        switch (this.currentFilters.sort) {
            case 'avgScore':
                data = topPlayers.map(player => player.avgScore);
                label = 'Average Score';
                break;
            case 'perfectScores':
                data = topPlayers.map(player => player.perfectScores);
                label = 'Perfect Scores';
                break;
            case 'gamesPlayed':
                data = topPlayers.map(player => player.gamesPlayed);
                label = 'Games Played';
                break;
            default:
                data = topPlayers.map(player => player.totalScore);
                label = 'Total Score';
        }
        
        this.charts.leaderboard = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: '#ff00c1',
                    borderColor: '#9600ff',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    updateLeaderboardTable() {
        const tbody = document.querySelector('#leaderboard-table tbody');
        tbody.innerHTML = '';
        
        this.data.leaderboard.forEach((player, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${player.user}</strong></td>
                <td>${player.totalScore.toLocaleString()}</td>
                <td>${player.avgScore}</td>
                <td>${player.gamesPlayed}</td>
                <td>${player.perfectScores}</td>
                <td>${player.lowestScore}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    createTrendsChart() {
        const ctx = document.getElementById('trends-chart').getContext('2d');
        
        if (this.charts.trends) {
            this.charts.trends.destroy();
        }
        
        // Check if trends data exists
        if (!this.data.trends || this.data.trends.length === 0) {
            console.warn('No trends data available');
            return;
        }
        
        // Group trends by player
        const playerTrends = {};
        this.data.trends.forEach(trend => {
            if (!playerTrends[trend.user]) {
                playerTrends[trend.user] = [];
            }
            playerTrends[trend.user].push(trend);
        });
        
        const labels = [...new Set(this.data.trends.map(t => t.date))].sort();
        const datasets = [];
        const colors = ['#ff00c1', '#9600ff', '#4900ff', '#00b8ff', '#00fff9', '#ff00c1', '#9600ff'];
        
        Object.entries(playerTrends).forEach(([player, trends], index) => {
            const data = labels.map(date => {
                const trend = trends.find(t => t.date === date);
                return trend ? trend.totalScore : null;
            });
            
            datasets.push({
                label: player,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                tension: 0.4,
                fill: false
            });
        });
        
        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(date => new Date(date).toLocaleDateString()),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    createEmojiChart(games = this.data.games) {
        const ctx = document.getElementById('emoji-chart').getContext('2d');
        
        if (this.charts.emoji) {
            this.charts.emoji.destroy();
        }
        
        // Calculate emoji frequency from games data
        const emojiCounts = {};
        games.forEach(game => {
            const emoji = game.location_emoji || '🎯';
            emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
        });
        
        const emojiData = Object.entries(emojiCounts)
            .map(([emoji, count]) => ({ emoji, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
            
        const labels = emojiData.map(item => item.emoji);
        const data = emojiData.map(item => item.count);
        
        this.charts.emoji = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#ff00c1', '#9600ff', '#4900ff', '#00b8ff', '#00fff9',
                        '#ff00c1', '#9600ff', '#4900ff', '#00b8ff', '#00fff9'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            font: {
                                size: 10,
                                family: 'Courier New'
                            },
                            color: '#00ff00'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const emoji = context.label;
                                const count = context.parsed;
                                const total = data.reduce((a, b) => a + b, 0);
                                const percentage = ((count / total) * 100).toFixed(1);
                                return `${emoji}: ${count} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    createStreaksChart(games = this.data.games) {
        const ctx = document.getElementById('streaks-chart').getContext('2d');
        
        if (this.charts.streaks) {
            this.charts.streaks.destroy();
        }
        
        // Calculate user streaks (consecutive days played)
        const userStreaks = this.calculateUserStreaks(games);
        
        const streaksData = userStreaks
            .sort((a, b) => b.maxStreak - a.maxStreak)
            .slice(0, 10);
            
        const labels = streaksData.map(item => item.user);
        const data = streaksData.map(item => item.maxStreak);
        
        this.charts.streaks = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Max Streak (Days)',
                    data: data,
                    backgroundColor: '#ff00c1',
                    borderColor: '#9600ff',
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Max Streak: ${context.parsed.y} days`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#00ff00',
                            font: {
                                family: 'Courier New'
                            }
                        },
                        grid: {
                            color: '#00b8ff'
                        },
                        title: {
                            display: true,
                            text: 'Days',
                            color: '#00ff00',
                            font: {
                                family: 'Courier New',
                                size: 12
                            }
                        }
                    },
                    x: {
                        ticks: {
                            color: '#000080',
                            font: {
                                family: 'Courier New',
                                size: 10
                            }
                        },
                        grid: {
                            color: '#00b8ff'
                        }
                    }
                }
            }
        });
    }
    
    calculateUserStreaks(games) {
        // Group games by user and date
        const userGames = {};
        games.forEach(game => {
            if (!userGames[game.user]) {
                userGames[game.user] = [];
            }
            userGames[game.user].push(game.date);
        });
        
        // Calculate streaks for each user
        const userStreaks = [];
        
        Object.entries(userGames).forEach(([user, dates]) => {
            // Remove duplicates and sort dates
            const uniqueDates = [...new Set(dates)].sort();
            
            let maxStreak = 0;
            let currentStreak = 1;
            
            for (let i = 1; i < uniqueDates.length; i++) {
                const prevDate = new Date(uniqueDates[i - 1]);
                const currentDate = new Date(uniqueDates[i]);
                const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
                
                if (dayDiff === 1) {
                    // Consecutive day
                    currentStreak++;
                } else {
                    // Streak broken
                    maxStreak = Math.max(maxStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            
            // Check final streak
            maxStreak = Math.max(maxStreak, currentStreak);
            
            userStreaks.push({
                user: user,
                maxStreak: maxStreak,
                totalDays: uniqueDates.length
            });
        });
        
        return userStreaks;
    }
    
    createPerfectLeadersChart(games = this.data.games) {
        const ctx = document.getElementById('perfect-leaders-chart').getContext('2d');
        
        if (this.charts.perfectLeaders) {
            this.charts.perfectLeaders.destroy();
        }
        
        // Calculate perfect score leaders from games data
        const userPerfectScores = {};
        games.forEach(game => {
            if (game.location_score === 100) {
                userPerfectScores[game.user] = (userPerfectScores[game.user] || 0) + 1;
            }
        });
        
        const leadersData = Object.entries(userPerfectScores)
            .map(([user, count]) => ({ user, perfectScores: count }))
            .sort((a, b) => b.perfectScores - a.perfectScores)
            .slice(0, 8);
            
        const labels = leadersData.map(item => item.user);
        const data = leadersData.map(item => item.perfectScores);
        
        this.charts.perfectLeaders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perfect Scores',
                    data: data,
                    backgroundColor: '#9600ff',
                    borderColor: '#4900ff',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    openFilters() {
        const filtersContent = document.getElementById('filters-content');
        const filtersToggle = document.getElementById('filters-toggle');
        
        filtersContent.classList.remove('hidden');
        filtersToggle.classList.add('hidden');
    }
    
    showLeaderboardDate(dateString) {
        const dateElement = document.getElementById('leaderboard-date');
        // Convert YYYY-MM-DD to MM/DD/YYYY format without using Date objects
        const [year, month, day] = dateString.split('-');
        const formattedDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
        dateElement.textContent = `Daily Leaderboard for ${formattedDate}`;
        dateElement.classList.remove('hidden');
    }
    
    updateLeaderboardSortIndicator() {
        // Check if a specific date is selected
        if (this.currentFilters.date && this.currentFilters.date !== '') {
            // Daily leaderboard - show date banner, hide sort indicator
            this.showLeaderboardDate(this.currentFilters.date);
            this.hideLeaderboardSort();
        } else {
            // Overall leaderboard - hide date banner, show sort indicator
            this.hideLeaderboardDate();
            this.showLeaderboardSort(this.currentFilters.sort);
        }
    }
    
    showLeaderboardSort(sortType) {
        const sortElement = document.getElementById('leaderboard-sort');
        const sortLabels = {
            'avgScore': 'Ranked by Average Score',
            'totalScore': 'Ranked by Total Score',
            'gamesPlayed': 'Ranked by Games Played',
            'perfectScores': 'Ranked by Perfect Scores'
        };
        
        sortElement.textContent = sortLabels[sortType] || 'Ranked by Average Score';
        sortElement.classList.remove('hidden');
    }
    
    hideLeaderboardSort() {
        const sortElement = document.getElementById('leaderboard-sort');
        sortElement.classList.add('hidden');
    }
    
    hideLeaderboardDate() {
        const dateElement = document.getElementById('leaderboard-date');
        dateElement.classList.add('hidden');
    }
    
    closeFilters() {
        const filtersContent = document.getElementById('filters-content');
        const filtersToggle = document.getElementById('filters-toggle');
        
        filtersContent.classList.add('hidden');
        filtersToggle.classList.remove('hidden');
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeIcon = document.querySelector('.theme-icon');
        const themeLabel = document.getElementById('theme-label');
        
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        themeLabel.textContent = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    showError(message) {
        // Simple error display - could be enhanced
        alert(message);
    }
    
    async updateRawData() {
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        // Update info
        document.getElementById('total-records').textContent = dataToUse.games.length;
        
        // Find the most recent date from the CSV data
        const mostRecentDate = this.getMostRecentDateFormatted(dataToUse.games);
        document.getElementById('last-updated').textContent = mostRecentDate;
        
        // Update table
        this.updateRawDataTable(dataToUse.games);
    }
    
    getMostRecentDate(games = this.data.games) {
        if (!games || games.length === 0) {
            return 'No data available';
        }
        
        // Find the most recent date by comparing date strings directly
        // This avoids potential timezone issues with Date parsing
        const dateStrings = games.map(game => game.date);
        const uniqueDates = [...new Set(dateStrings)]; // Remove duplicates
        const sortedDates = uniqueDates.sort().reverse(); // Sort descending (newest first)
        
        console.log('Available dates:', sortedDates);
        console.log('Most recent date:', sortedDates[0]);
        
        // Debug: Check Stephen Alexander's data specifically
        const stephenGames = games.filter(game => game.user.toLowerCase().includes('stephen'));
        console.log('Stephen Alexander games:', stephenGames);
        
        return sortedDates[0]; // Return raw date string (e.g., "2025-10-01")
    }
    
    getMostRecentDateFormatted(games = this.data.games) {
        const rawDate = this.getMostRecentDate(games);
        if (rawDate === 'No data available') {
            return rawDate;
        }
        
        // Convert YYYY-MM-DD to MM/DD/YYYY format without using Date objects
        const [year, month, day] = rawDate.split('-');
        return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }
    
    updateRawDataTable(games = this.data.games) {
        const tbody = document.querySelector('#raw-data-table tbody');
        tbody.innerHTML = '';
        
        // Sort by date (newest first), then by user
        const sortedGames = [...games].sort((a, b) => {
            // Use string comparison to avoid timezone issues
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return a.user.localeCompare(b.user);
        });
        
        console.log('Raw data table - first 5 games:', sortedGames.slice(0, 5));
        console.log('Stephen Alexander games in raw data:', sortedGames.filter(game => game.user.toLowerCase().includes('stephen')));
        
        sortedGames.forEach(game => {
            // Convert YYYY-MM-DD to MM/DD/YYYY format without using Date objects
            const [year, month, day] = game.date.split('-');
            const displayDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
            
            if (game.user.toLowerCase().includes('stephen')) {
                console.log(`Stephen Alexander - Raw: ${game.date}, Display: ${displayDate}`);
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${game.user}</td>
                <td>${displayDate}</td>
                <td>${game.location_number}</td>
                <td>${game.location_score}</td>
                <td>${game.total_score}</td>
                <td>${game.location_emoji || '🎯'}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    exportCSV() {
        const headers = ['user', 'date', 'location_number', 'location_score', 'location_emoji', 'total_score'];
        const csvContent = [
            headers.join(','),
            ...this.data.games.map(game => 
                headers.map(header => {
                    const value = game[header] || '';
                    // Escape commas and quotes in CSV
                    return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `maptap-data-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.querySelector('.theme-icon');
    const themeLabel = document.getElementById('theme-label');
    
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeLabel.textContent = savedTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
    
    // Initialize dashboard
    new MaptapDashboard();
});
