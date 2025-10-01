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
        this.showSection('overview');
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
        
        // Filters
        document.getElementById('player-filter').addEventListener('change', (e) => {
            this.currentFilters.player = e.target.value;
            this.updateCurrentSection();
        });
        
        document.getElementById('date-filter').addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
            this.updateCurrentSection();
        });
        
        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.updateCurrentSection();
        });
        
        // Leaderboard controls
        document.getElementById('overall-leaderboard').addEventListener('click', () => {
            this.currentFilters.date = '';
            document.getElementById('date-filter').value = '';
            this.updateLeaderboard();
        });
        
        document.getElementById('daily-leaderboard').addEventListener('click', () => {
            this.updateLeaderboard();
        });
    }
    
    async loadData() {
        try {
            const [games, players, dates, analytics] = await Promise.all([
                fetch('/api/data').then(r => r.json()),
                fetch('/api/players').then(r => r.json()),
                fetch('/api/dates').then(r => r.json()),
                fetch('/api/analytics').then(r => r.json())
            ]);
            
            this.data.games = games;
            this.data.players = players;
            this.data.dates = dates;
            this.data.analytics = analytics;
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please refresh the page.');
        }
    }
    
    populateFilters() {
        const playerFilter = document.getElementById('player-filter');
        const dateFilter = document.getElementById('date-filter');
        
        // Populate players
        this.data.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            playerFilter.appendChild(option);
        });
        
        // Populate dates
        this.data.dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = new Date(date).toLocaleDateString();
            dateFilter.appendChild(option);
        });
    }
    
    showSection(sectionName) {
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
        }
    }
    
    async updateOverview() {
        // Update stats
        document.getElementById('total-games').textContent = this.data.analytics.totalGames || 0;
        document.getElementById('total-players').textContent = this.data.analytics.uniquePlayers || 0;
        document.getElementById('perfect-scores').textContent = 
            this.data.analytics.perfectScoreLeaders?.reduce((sum, user) => sum + user.perfectScores, 0) || 0;
        
        const dateRange = this.data.analytics.dateRange;
        if (dateRange) {
            const start = new Date(dateRange.start).toLocaleDateString();
            const end = new Date(dateRange.end).toLocaleDateString();
            document.getElementById('date-range').textContent = `${start} - ${end}`;
        }
        
        // Create overview chart
        await this.createOverviewChart();
    }
    
    async updateLeaderboard() {
        const params = new URLSearchParams();
        if (this.currentFilters.date) params.append('date', this.currentFilters.date);
        
        try {
            const leaderboard = await fetch(`/api/leaderboard?${params}`).then(r => r.json());
            this.data.leaderboard = leaderboard;
            
            // Sort by current sort option
            this.data.leaderboard.sort((a, b) => {
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
            
            this.createLeaderboardChart();
            this.updateLeaderboardTable();
            
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    async updateTrends() {
        const params = new URLSearchParams();
        if (this.currentFilters.player) params.append('player', this.currentFilters.player);
        
        try {
            const trends = await fetch(`/api/trends?${params}`).then(r => r.json());
            this.data.trends = trends;
            this.createTrendsChart();
            
        } catch (error) {
            console.error('Error loading trends:', error);
        }
    }
    
    updateAnalytics() {
        this.createEmojiChart();
        this.createDifficultyChart();
        this.createPerfectLeadersChart();
    }
    
    async createOverviewChart() {
        const ctx = document.getElementById('overview-chart').getContext('2d');
        
        // Destroy existing chart
        if (this.charts.overview) {
            this.charts.overview.destroy();
        }
        
        // Get daily average scores across all players
        const dailyStats = {};
        this.data.games.forEach(game => {
            if (!dailyStats[game.date]) {
                dailyStats[game.date] = {
                    totalScore: 0,
                    gameCount: 0,
                    players: new Set()
                };
            }
            dailyStats[game.date].totalScore += game.total_score;
            dailyStats[game.date].gameCount++;
            dailyStats[game.date].players.add(game.user);
        });
        
        // Get last 10 days
        const sortedDates = this.data.dates.sort().slice(-10);
        const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
        
        // Calculate daily averages
        const avgScores = sortedDates.map(date => {
            const stats = dailyStats[date];
            return stats ? Math.round(stats.totalScore / stats.gameCount) : 0;
        });
        
        const playerCounts = sortedDates.map(date => {
            const stats = dailyStats[date];
            return stats ? stats.players.size : 0;
        });
        
        this.charts.overview = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Average Score',
                    data: avgScores,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y'
                }, {
                    label: 'Players Participating',
                    data: playerCounts,
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b20',
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Average Score'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Players'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
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
    
    createLeaderboardChart() {
        const ctx = document.getElementById('leaderboard-chart').getContext('2d');
        
        if (this.charts.leaderboard) {
            this.charts.leaderboard.destroy();
        }
        
        const topPlayers = this.data.leaderboard.slice(0, 10);
        const labels = topPlayers.map(player => player.user);
        const data = topPlayers.map(player => player.totalScore);
        
        this.charts.leaderboard = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Score',
                    data: data,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
        const colors = ['#8b5cf6', '#a855f7', '#c084fc', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
        
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
    
    createEmojiChart() {
        const ctx = document.getElementById('emoji-chart').getContext('2d');
        
        if (this.charts.emoji) {
            this.charts.emoji.destroy();
        }
        
        const emojiData = this.data.analytics.emojiFrequency?.slice(0, 10) || [];
        const labels = emojiData.map(item => item.emoji);
        const data = emojiData.map(item => item.count);
        
        this.charts.emoji = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#8b5cf6', '#a855f7', '#c084fc', '#f59e0b', '#ef4444',
                        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    createDifficultyChart() {
        const ctx = document.getElementById('difficulty-chart').getContext('2d');
        
        if (this.charts.difficulty) {
            this.charts.difficulty.destroy();
        }
        
        const difficultyData = this.data.analytics.locationDifficulty || [];
        const labels = difficultyData.map(item => `Location ${item.location}`);
        const data = difficultyData.map(item => item.avgScore);
        
        this.charts.difficulty = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Score',
                    data: data,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
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
    
    createPerfectLeadersChart() {
        const ctx = document.getElementById('perfect-leaders-chart').getContext('2d');
        
        if (this.charts.perfectLeaders) {
            this.charts.perfectLeaders.destroy();
        }
        
        const leadersData = this.data.analytics.perfectScoreLeaders?.slice(0, 8) || [];
        const labels = leadersData.map(item => item.user);
        const data = leadersData.map(item => item.perfectScores);
        
        this.charts.perfectLeaders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perfect Scores',
                    data: data,
                    backgroundColor: '#f59e0b',
                    borderColor: '#d97706',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
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
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    
    // Initialize dashboard
    new MaptapDashboard();
});
