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
            sort: 'avgScore'
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
        
        // Raw data controls
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportCSV();
        });
        
        document.getElementById('refresh-data').addEventListener('click', () => {
            this.loadData();
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
            case 'rawdata':
                this.updateRawData();
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
                                size: 10
                            }
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
                    backgroundColor: '#00fff9',
                    borderColor: '#00b8ff',
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
    
    async updateRawData() {
        // Update info
        document.getElementById('total-records').textContent = this.data.games.length;
        
        // Find the most recent date from the CSV data
        const mostRecentDate = this.getMostRecentDate();
        document.getElementById('last-updated').textContent = mostRecentDate;
        
        // Update table
        this.updateRawDataTable();
    }
    
    getMostRecentDate() {
        if (!this.data.games || this.data.games.length === 0) {
            return 'No data available';
        }
        
        // Find the most recent date
        const dates = this.data.games.map(game => new Date(game.date));
        const mostRecent = new Date(Math.max(...dates));
        
        return mostRecent.toLocaleDateString();
    }
    
    updateRawDataTable() {
        const tbody = document.querySelector('#raw-data-table tbody');
        tbody.innerHTML = '';
        
        // Sort by date (newest first), then by user
        const sortedGames = [...this.data.games].sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            return a.user.localeCompare(b.user);
        });
        
        sortedGames.forEach(game => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${game.user}</td>
                <td>${new Date(game.date).toLocaleDateString()}</td>
                <td>${game.location_number}</td>
                <td>${game.location_score}</td>
                <td>${game.total_score}</td>
                <td>${game.emoji || '🎯'}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    exportCSV() {
        const headers = ['user', 'date', 'location_number', 'location_score', 'total_score', 'emoji'];
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
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    
    // Initialize dashboard
    new MaptapDashboard();
});
