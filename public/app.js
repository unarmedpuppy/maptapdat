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
            players: [], // Array for multi-select
            date: '',
            dateRangeStart: '',
            dateRangeEnd: '',
            scoreMin: '',
            scoreMax: '',
            searchQuery: '',
            sort: 'totalScore'
        };
        this.filterPresets = this.loadFilterPresets();
        
        this.charts = {};
        this.comparisonData = null; // Store comparison data
        this.comparingPlayers = []; // Array of player names being compared
        this.currentPeriod = 'day'; // Current time period for trends
        this.showRollingAverage = false; // Toggle for rolling averages
        
        // Pagination state
        this.currentPage = 1;
        this.rowsPerPage = 50;
        
        // Chart visibility tracking
        this.chartsLoaded = new Set();
        
        // Debounce timer
        this.debounceTimer = null;
        
        // Mobile swipe tracking
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.swipeThreshold = 50;
        
        // Pull-to-refresh state
        this.pullToRefreshState = {
            startY: 0,
            currentY: 0,
            isPulling: false,
            threshold: 80
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        
        // Show skeleton loading for charts
        this.showSkeletonLoading('leaderboard-chart', 'chart');
        this.showSkeletonLoading('trends-chart', 'chart');
        
        try {
        await this.loadData();
        this.populateFilters();
        this.updateOverview();
        this.hideLoading();
            
            // Add tooltips to stat cards
            setTimeout(() => this.addTooltipsToStats(), 500);
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to load data. Please refresh the page.');
            console.error('Error initializing dashboard:', error);
        }
    }
    
    addTooltipsToStats() {
        // Add tooltips to overview stat cards
        const statCards = document.querySelectorAll('.stat-card');
        const tooltips = {
            'daily-winner': 'Player with the highest total score today. Each game consists of 5 location scores.',
            'daily-loser': 'Player with the lowest total score today. Each game consists of 5 location scores.',
            'overall-winner': 'Player with the highest average score across all their games. Calculated as total score divided by number of games.',
            'overall-loser': 'Player with the lowest average score across all their games. Calculated as total score divided by number of games.',
            'most-games': 'Player who has played the most unique games. Each game is counted once per day per player.',
            'least-games': 'Player who has played the fewest unique games. Each game is counted once per day per player.',
            'total-games': 'Total number of unique games played across all players. Each game is counted once per day per player.',
            'total-players': 'Number of unique players who have played at least one game.',
            'perfect-scores': 'Total number of perfect scores achieved. A perfect score is 1000 points (100 points × 5 locations).',
            'date-range': 'The date range covering all games in the dataset, from the first game to the most recent game.',
            'games-today': 'Number of unique games played today. Each player can have one game per day.'
        };
        
        statCards.forEach(card => {
            const statValue = card.querySelector('.stat-value');
            if (statValue) {
                const id = statValue.id;
                if (tooltips[id]) {
                    this.addTooltip(card, tooltips[id], 'top');
                }
            }
        });
        
        // Also add tooltips to profile stat cards
        const profileStatCards = document.querySelectorAll('.profile-stat-card');
        const profileTooltips = {
            'Total Games': 'Total number of unique games this player has played. Each game is counted once per day.',
            'Average Score': 'Average total score across all games. Calculated as sum of all scores divided by number of games.',
            'Perfect Scores': 'Number of perfect scores (1000 points) this player has achieved.',
            'Highest Score': 'The player\'s personal best (PB) - their highest total score ever achieved.',
            'Lowest Score': 'The player\'s worst score - their lowest total score ever achieved.',
            'Current Streak': 'Number of consecutive days the player has played games. Resets if they miss a day.',
            'Longest Streak': 'The longest consecutive day streak this player has achieved.'
        };
        
        profileStatCards.forEach(card => {
            const statLabel = card.querySelector('.stat-label');
            if (statLabel) {
                const labelText = statLabel.textContent.trim();
                if (profileTooltips[labelText]) {
                    this.addTooltip(card, profileTooltips[labelText], 'top');
                }
            }
        });
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
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        }
        
        // High contrast toggle
        const highContrastToggle = document.getElementById('high-contrast-toggle');
        if (highContrastToggle) {
            highContrastToggle.addEventListener('click', () => {
                this.toggleHighContrast();
            });
        }
        
        // Keyboard shortcuts button
        const keyboardShortcutsBtn = document.getElementById('keyboard-shortcuts-btn');
        if (keyboardShortcutsBtn) {
            keyboardShortcutsBtn.addEventListener('click', () => {
                this.showKeyboardShortcutsModal();
            });
        }
        
        // Keyboard navigation
        this.setupKeyboardNavigation();
        
        // Filters toggle
        const filtersToggle = document.getElementById('filters-toggle');
        if (filtersToggle) {
            filtersToggle.addEventListener('click', () => {
            this.openFilters();
        });
        }
        
        // Filters close
        const filtersClose = document.getElementById('filters-close');
        if (filtersClose) {
            filtersClose.addEventListener('click', () => {
            this.closeFilters();
        });
        }
        
        // Enhanced Filters
        // Player search (fuzzy matching) - debounced
        const playerSearch = document.getElementById('player-search');
        if (playerSearch) {
            playerSearch.addEventListener('input', (e) => {
                this.currentFilters.searchQuery = e.target.value.toLowerCase();
                this.filterPlayerOptions();
                this.debounceApplyFilters();
            });
        }
        
        // Multi-select player filter
        const playerFilter = document.getElementById('player-filter');
        if (playerFilter) {
            playerFilter.addEventListener('change', (e) => {
                const selected = Array.from(e.target.selectedOptions).map(opt => opt.value).filter(v => v);
                this.currentFilters.players = selected;
            this.applyFilters();
        });
        }
        
        // Date range picker
        const dateRangeStart = document.getElementById('date-range-start');
        if (dateRangeStart) {
            dateRangeStart.addEventListener('change', (e) => {
                this.currentFilters.dateRangeStart = e.target.value;
                this.currentFilters.date = ''; // Clear quick date when using range
                const dateFilter = document.getElementById('date-filter');
                if (dateFilter) dateFilter.value = '';
                this.applyFilters();
            });
        }
        
        const dateRangeEnd = document.getElementById('date-range-end');
        if (dateRangeEnd) {
            dateRangeEnd.addEventListener('change', (e) => {
                this.currentFilters.dateRangeEnd = e.target.value;
                this.currentFilters.date = ''; // Clear quick date when using range
                const dateFilter = document.getElementById('date-filter');
                if (dateFilter) dateFilter.value = '';
                this.applyFilters();
            });
        }
        
        // Quick date filter
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
                // Clear date range when using quick date
                if (e.target.value) {
                    this.currentFilters.dateRangeStart = '';
                    this.currentFilters.dateRangeEnd = '';
                    const startEl = document.getElementById('date-range-start');
                    const endEl = document.getElementById('date-range-end');
                    if (startEl) startEl.value = '';
                    if (endEl) endEl.value = '';
                }
            
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
        }
        
        // Score range filter - debounced
        const scoreRangeMin = document.getElementById('score-range-min');
        if (scoreRangeMin) {
            scoreRangeMin.addEventListener('input', (e) => {
                this.currentFilters.scoreMin = e.target.value ? parseInt(e.target.value) : '';
                this.debounceApplyFilters();
            });
        }
        
        const scoreRangeMax = document.getElementById('score-range-max');
        if (scoreRangeMax) {
            scoreRangeMax.addEventListener('input', (e) => {
                this.currentFilters.scoreMax = e.target.value ? parseInt(e.target.value) : '';
                this.debounceApplyFilters();
            });
        }
        
        // Sort filter
        const sortFilter = document.getElementById('sort-filter');
        if (sortFilter) {
            sortFilter.addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
        });
        }
        
        // Clear filters button
        const clearFilters = document.getElementById('clear-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
        
        // Save filter preset
        const saveFilterPreset = document.getElementById('save-filter-preset');
        if (saveFilterPreset) {
            saveFilterPreset.addEventListener('click', () => {
                this.saveFilterPreset();
            });
        }
        
        // Load filter preset
        const filterPresets = document.getElementById('filter-presets');
        if (filterPresets) {
            filterPresets.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadFilterPreset(e.target.value);
                }
            });
        }
        
        // Raw data controls
        const exportCsv = document.getElementById('export-csv');
        if (exportCsv) {
            exportCsv.addEventListener('click', () => {
            this.exportCSV();
        });
        }
        
        const exportFilteredCsv = document.getElementById('export-filtered-csv');
        if (exportFilteredCsv) {
            exportFilteredCsv.addEventListener('click', () => {
                this.exportFilteredCSV();
            });
        }
        
        const refreshData = document.getElementById('refresh-data');
        if (refreshData) {
            refreshData.addEventListener('click', () => {
            this.loadData();
        });
        }
        
        // Export chart buttons
        const exportLeaderboardChart = document.getElementById('export-leaderboard-chart');
        if (exportLeaderboardChart) {
            exportLeaderboardChart.addEventListener('click', () => {
                this.exportChart('leaderboard');
            });
        }
        
        const exportTrendsChart = document.getElementById('export-trends-chart');
        if (exportTrendsChart) {
            exportTrendsChart.addEventListener('click', () => {
                this.exportChart('trends');
            });
        }
        
        const exportAllCharts = document.getElementById('export-all-charts');
        if (exportAllCharts) {
            exportAllCharts.addEventListener('click', () => {
                this.exportAllCharts();
            });
        }
        
        // Share link buttons
        const shareLeaderboardLink = document.getElementById('share-leaderboard-link');
        if (shareLeaderboardLink) {
            shareLeaderboardLink.addEventListener('click', () => {
                this.shareLink('leaderboard');
            });
        }
        
        const shareTrendsLink = document.getElementById('share-trends-link');
        if (shareTrendsLink) {
            shareTrendsLink.addEventListener('click', () => {
                this.shareLink('trends');
            });
        }
        
        const shareAnalyticsLink = document.getElementById('share-analytics-link');
        if (shareAnalyticsLink) {
            shareAnalyticsLink.addEventListener('click', () => {
                this.shareLink('analytics');
            });
        }
        
        const shareRawdataLink = document.getElementById('share-rawdata-link');
        if (shareRawdataLink) {
            shareRawdataLink.addEventListener('click', () => {
                this.shareLink('rawdata');
            });
        }
        
        // Pagination controls
        const prevPage = document.getElementById('prev-page');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.updateRawDataTable();
                }
            });
        }
        
        const nextPage = document.getElementById('next-page');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                const dataToUse = this.filteredData || this.data;
                const totalPages = Math.ceil(dataToUse.games.length / this.rowsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.updateRawDataTable();
                }
            });
        }
        
        const rowsPerPage = document.getElementById('rows-per-page');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', (e) => {
                this.rowsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.updateRawDataTable();
            });
        }
        
        // Intersection Observer for lazy loading charts
        // Initialize chartsLoaded Set if not already initialized
        if (!this.chartsLoaded) {
            this.chartsLoaded = new Set();
        }
        this.setupLazyChartLoading();
        
        // Handle browser back/forward buttons
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });
        
        // Leaderboard controls
        const overallLeaderboard = document.getElementById('overall-leaderboard');
        if (overallLeaderboard) {
            overallLeaderboard.addEventListener('click', () => {
            this.currentFilters.date = '';
            this.currentFilters.sort = 'avgScore';
                const dateFilter = document.getElementById('date-filter');
                const sortFilter = document.getElementById('sort-filter');
                if (dateFilter) dateFilter.value = '';
                if (sortFilter) sortFilter.value = 'avgScore';
            this.hideLeaderboardDate();
            this.showLeaderboardSort('avgScore');
            this.applyFilters();
            this.updateLeaderboard();
        });
        }
        
        const dailyLeaderboard = document.getElementById('daily-leaderboard');
        if (dailyLeaderboard) {
            dailyLeaderboard.addEventListener('click', () => {
            // Set to most recent date
            const mostRecentDate = this.getMostRecentDate();
            this.currentFilters.date = mostRecentDate;
            this.currentFilters.sort = 'totalScore';
                const dateFilter = document.getElementById('date-filter');
                const sortFilter = document.getElementById('sort-filter');
                if (dateFilter) dateFilter.value = mostRecentDate;
                if (sortFilter) sortFilter.value = 'totalScore';
            
            // Update URL hash with date parameter
            window.location.hash = `leaderboard?date=${mostRecentDate}`;
            
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
            this.updateLeaderboard();
        });
        }
        
        // Comparison feature event listeners
        const comparePlayersBtn = document.getElementById('compare-players-btn');
        if (comparePlayersBtn) {
            comparePlayersBtn.addEventListener('click', () => {
                this.openComparisonModal();
            });
        }
        
        const comparisonModalClose = document.getElementById('comparison-modal-close');
        if (comparisonModalClose) {
            comparisonModalClose.addEventListener('click', () => {
                this.closeComparisonModal();
            });
        }
        
        const cancelComparison = document.getElementById('cancel-comparison');
        if (cancelComparison) {
            cancelComparison.addEventListener('click', () => {
                this.closeComparisonModal();
            });
        }
        
        const applyComparison = document.getElementById('apply-comparison');
        if (applyComparison) {
            applyComparison.addEventListener('click', () => {
                this.applyComparison();
            });
        }
        
        const clearComparison = document.getElementById('clear-comparison');
        if (clearComparison) {
            clearComparison.addEventListener('click', () => {
                this.clearComparison();
            });
        }
        
        // Time-based aggregation event listeners (legacy - check if exists)
        const legacyPeriodSelector = document.getElementById('period-selector');
        if (legacyPeriodSelector) {
            legacyPeriodSelector.addEventListener('change', (e) => {
                this.currentPeriod = e.target.value;
                this.updateTrends();
            });
        }
        
        const rollingAverageToggle = document.getElementById('show-rolling-average');
        if (rollingAverageToggle) {
            rollingAverageToggle.addEventListener('change', (e) => {
                this.showRollingAverage = e.target.checked;
                this.createTrendsChart();
            });
        }
        
        const last7Days = document.getElementById('last-7-days');
        if (last7Days) {
            last7Days.addEventListener('click', () => {
                this.setDateRange(7);
            });
        }
        
        const last30Days = document.getElementById('last-30-days');
        if (last30Days) {
            last30Days.addEventListener('click', () => {
                this.setDateRange(30);
            });
        }
        
        // Player profile navigation
        const backToLeaderboard = document.getElementById('back-to-leaderboard');
        if (backToLeaderboard) {
            backToLeaderboard.addEventListener('click', () => {
                this.showSection('leaderboard');
                window.location.hash = 'leaderboard';
                const profileNavItem = document.getElementById('profile-nav-item');
                if (profileNavItem) {
                    profileNavItem.classList.add('hidden');
                }
            });
        }
        
        // Make player names clickable in leaderboard
        setTimeout(() => {
            this.makePlayerNamesClickable();
        }, 1000);
    }
    
    setupLazyChartLoading() {
        // Use Intersection Observer to load charts only when visible
        const observerOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    if (!this.chartsLoaded.has(sectionId)) {
                        this.chartsLoaded.add(sectionId);
                        this.loadChartsForSection(sectionId);
                    }
                }
            });
        }, observerOptions);
        
        // Observe all sections
        document.querySelectorAll('.section').forEach(section => {
            observer.observe(section);
        });
    }
    
    loadChartsForSection(sectionId) {
        switch(sectionId) {
            case 'leaderboard':
                if (this.data && this.data.leaderboard) {
                    this.createLeaderboardChart();
                }
                break;
            case 'trends':
                if (this.data && (this.data.trends || this.data.aggregations)) {
                    this.createTrendsChart();
                }
                break;
            case 'analytics':
                if (this.data && this.data.analytics) {
                    const dataToUse = this.filteredData || this.data;
                    this.createEmojiChart(dataToUse.games);
                    this.createStreaksChart(dataToUse.games);
                    this.createPerfectLeadersChart(dataToUse.games);
                    this.createLocationDifficultyChart();
                    this.createLocationHeatmap();
                    this.createScoreDistributionChart(dataToUse.games);
                    this.createImprovementTrendsChart();
                    this.updatePlayerAnalytics();
                }
                break;
        }
    }
    
    makePlayerNamesClickable() {
        const tbody = document.querySelector('#leaderboard-table tbody');
        if (!tbody) return;
        
        tbody.querySelectorAll('td:nth-child(2)').forEach(cell => {
            const playerName = cell.textContent.trim();
            if (playerName && !cell.querySelector('a')) {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = playerName;
                link.style.cursor = 'pointer';
                link.style.color = 'inherit';
                link.style.textDecoration = 'none';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showPlayerProfile(playerName);
                });
                cell.innerHTML = '';
                cell.appendChild(link);
            }
        });
    }
    
    setDateRange(days) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = today.toISOString().split('T')[0];
        
        this.currentFilters.date = '';
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) dateFilter.value = '';
        this.currentPeriod = 'day';
        const periodSelector = document.getElementById('period-selector');
        if (periodSelector) periodSelector.value = 'day';
        
        // Update trends with date range
        this.updateTrendsWithDateRange(startDateStr, endDateStr);
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
        
        // Update filter presets dropdown
        this.updateFilterPresetsDropdown();
        
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
        // Multi-select doesn't use .value, handled separately
        dateFilter.value = this.currentFilters.date;
        document.getElementById('sort-filter').value = this.currentFilters.sort;
    }
    
    applyFilters() {
        // Filter the data based on current filters
        let filteredGames = [...this.data.games];
        
        // Apply multi-select player filter
        if (this.currentFilters.players && this.currentFilters.players.length > 0) {
            const playerSet = new Set(this.currentFilters.players.map(p => p.toLowerCase().trim()));
            filteredGames = filteredGames.filter(game => 
                playerSet.has(game.user.toLowerCase().trim())
            );
        }
        
        // Apply date filter (quick date)
        if (this.currentFilters.date) {
            filteredGames = filteredGames.filter(game => game.date === this.currentFilters.date);
        }
        
        // Apply date range filter
        if (this.currentFilters.dateRangeStart || this.currentFilters.dateRangeEnd) {
            filteredGames = filteredGames.filter(game => {
                if (this.currentFilters.dateRangeStart && game.date < this.currentFilters.dateRangeStart) {
                    return false;
                }
                if (this.currentFilters.dateRangeEnd && game.date > this.currentFilters.dateRangeEnd) {
                    return false;
                }
                return true;
            });
        }
        
        // Apply score range filter
        if (this.currentFilters.scoreMin !== '' || this.currentFilters.scoreMax !== '') {
            filteredGames = filteredGames.filter(game => {
                const score = game.total_score;
                if (this.currentFilters.scoreMin !== '' && score < this.currentFilters.scoreMin) {
                    return false;
                }
                if (this.currentFilters.scoreMax !== '' && score > this.currentFilters.scoreMax) {
                    return false;
                }
                return true;
            });
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
    
    filterPlayerOptions() {
        const playerFilter = document.getElementById('player-filter');
        const searchQuery = this.currentFilters.searchQuery;
        
        // Show/hide options based on search
        Array.from(playerFilter.options).forEach(option => {
            if (option.value === '') {
                option.style.display = 'block'; // Always show "All Players"
            } else {
                const playerName = option.textContent.toLowerCase();
                if (searchQuery === '' || playerName.includes(searchQuery)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            }
        });
    }
    
    clearAllFilters() {
        this.currentFilters = {
            players: [],
            date: '',
            dateRangeStart: '',
            dateRangeEnd: '',
            scoreMin: '',
            scoreMax: '',
            searchQuery: '',
            sort: 'totalScore'
        };
        
        // Reset UI elements
        document.getElementById('player-search').value = '';
        document.getElementById('player-filter').selectedIndex = 0;
        document.getElementById('date-filter').value = '';
        document.getElementById('date-range-start').value = '';
        document.getElementById('date-range-end').value = '';
        document.getElementById('score-range-min').value = '';
        document.getElementById('score-range-max').value = '';
        document.getElementById('sort-filter').value = 'totalScore';
        
        // Clear multi-select
        Array.from(document.getElementById('player-filter').options).forEach(opt => {
            opt.selected = false;
        });
        document.getElementById('player-filter').options[0].selected = true;
        
        this.filterPlayerOptions();
        this.applyFilters();
    }
    
    saveFilterPreset() {
        const name = prompt('Enter a name for this filter preset:');
        if (!name) return;
        
        const preset = {
            name: name,
            filters: { ...this.currentFilters }
        };
        
        this.filterPresets.push(preset);
        this.saveFilterPresets();
        this.updateFilterPresetsDropdown();
        
        alert(`Filter preset "${name}" saved!`);
    }
    
    loadFilterPreset(presetName) {
        const preset = this.filterPresets.find(p => p.name === presetName);
        if (!preset) return;
        
        this.currentFilters = { ...preset.filters };
        
        // Update UI elements
        document.getElementById('player-search').value = this.currentFilters.searchQuery || '';
        document.getElementById('date-filter').value = this.currentFilters.date || '';
        document.getElementById('date-range-start').value = this.currentFilters.dateRangeStart || '';
        document.getElementById('date-range-end').value = this.currentFilters.dateRangeEnd || '';
        document.getElementById('score-range-min').value = this.currentFilters.scoreMin || '';
        document.getElementById('score-range-max').value = this.currentFilters.scoreMax || '';
        document.getElementById('sort-filter').value = this.currentFilters.sort || 'totalScore';
        
        // Update multi-select
        const playerFilter = document.getElementById('player-filter');
        Array.from(playerFilter.options).forEach(opt => {
            opt.selected = this.currentFilters.players.includes(opt.value);
        });
        
        this.filterPlayerOptions();
        this.applyFilters();
    }
    
    updateFilterPresetsDropdown() {
        const presetsSelect = document.getElementById('filter-presets');
        presetsSelect.innerHTML = '<option value="">Load Preset...</option>';
        
        this.filterPresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = preset.name;
            presetsSelect.appendChild(option);
        });
    }
    
    loadFilterPresets() {
        try {
            const stored = localStorage.getItem('maptapdat_filter_presets');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }
    
    saveFilterPresets() {
        try {
            localStorage.setItem('maptapdat_filter_presets', JSON.stringify(this.filterPresets));
        } catch (e) {
            console.error('Failed to save filter presets:', e);
        }
    }
    
    showSection(sectionName) {
        // Update URL hash
        window.location.hash = sectionName;
        
        // Hide profile nav item unless we're viewing a profile
        const profileNavItem = document.getElementById('profile-nav-item');
        if (profileNavItem) {
            if (sectionName === 'player-profile') {
                profileNavItem.classList.remove('hidden');
            } else {
                profileNavItem.classList.add('hidden');
                // Clear profile content if switching away from profile
                if (this.currentSection === 'player-profile') {
                    const profileContent = document.getElementById('profile-content');
                    if (profileContent) {
                        profileContent.innerHTML = '';
                    }
                }
            }
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        // Show section
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        this.currentSection = sectionName;
        
        // Load charts for this section if not already loaded
        if (!this.chartsLoaded.has(sectionName)) {
            this.chartsLoaded.add(sectionName);
            this.loadChartsForSection(sectionName);
        }
        
        this.updateCurrentSection();
        
        // Scroll to top of the page instead of bottom
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    handleHashChange() {
        const hash = window.location.hash.substring(1); // Remove the #
        const validSections = ['overview', 'leaderboard', 'trends', 'analytics', 'rawdata', 'player-profile'];
        
        // Parse hash for section and params
        const hashParts = hash.split('?');
        const section = hashParts[0];
        const params = hashParts[1] ? new URLSearchParams(hashParts[1]) : null;
        
        // Check for player profile route: player-profile?player=name
        if (section === 'player-profile' && params && params.has('player')) {
            const playerName = params.get('player');
            this.showPlayerProfile(playerName);
            return;
        }
        
        if (hash && validSections.includes(section)) {
            this.showSection(section);
            
            // Apply filters from URL params
            if (params) {
                if (params.has('players')) {
                    const players = params.get('players').split(',');
                    this.currentFilters.players = players;
                    const playerFilter = document.getElementById('player-filter');
                    Array.from(playerFilter.options).forEach(opt => {
                        opt.selected = players.includes(opt.value);
                    });
                }
                if (params.has('date')) {
                    this.currentFilters.date = params.get('date');
                    document.getElementById('date-filter').value = params.get('date');
                }
                if (params.has('dateStart')) {
                    this.currentFilters.dateRangeStart = params.get('dateStart');
                    document.getElementById('date-range-start').value = params.get('dateStart');
                }
                if (params.has('dateEnd')) {
                    this.currentFilters.dateRangeEnd = params.get('dateEnd');
                    document.getElementById('date-range-end').value = params.get('dateEnd');
                }
                if (params.has('scoreMin')) {
                    this.currentFilters.scoreMin = parseInt(params.get('scoreMin'));
                    document.getElementById('score-range-min').value = params.get('scoreMin');
                }
                if (params.has('scoreMax')) {
                    this.currentFilters.scoreMax = parseInt(params.get('scoreMax'));
                    document.getElementById('score-range-max').value = params.get('scoreMax');
                }
                if (params.has('sort')) {
                    this.currentFilters.sort = params.get('sort');
                    document.getElementById('sort-filter').value = params.get('sort');
                }
            }
            
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
            case 'player-profile':
                // Profile content is loaded dynamically
                break;
        }
    }
    
    async showPlayerProfile(playerName) {
        // Update URL hash
        window.location.hash = `player-profile?player=${encodeURIComponent(playerName)}`;
        
        // Show profile section
        this.showSection('player-profile');
        
        // Show profile nav item
        document.getElementById('profile-nav-item').classList.remove('hidden');
        
        // Load and display profile data
        await this.loadPlayerProfile(playerName);
    }
    
    async loadPlayerProfile(playerName) {
        try {
            const response = await fetch(`/api/player/${encodeURIComponent(playerName)}`);
            if (!response.ok) {
                throw new Error('Player not found');
            }
            
            const playerData = await response.json();
            this.renderPlayerProfile(playerData);
        } catch (error) {
            console.error('Error loading player profile:', error);
            document.getElementById('profile-content').innerHTML = 
                '<p style="color: var(--error);">Error loading player profile. Please try again.</p>';
        }
    }
    
    renderPlayerProfile(playerData) {
        const content = document.getElementById('profile-content');
        const nameElement = document.getElementById('profile-player-name');
        
        nameElement.textContent = playerData.user;
        
        // Format dates
        const formatDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${parseInt(month)}/${parseInt(day)}/${year}`;
        };
        
        // Get streak info
        const streaks = this.data.analytics?.streaks;
        const currentStreak = streaks?.currentStreaks?.find(s => s.user === playerData.user);
        const longestStreak = streaks?.longestStreaks?.find(s => s.user === playerData.user);
        
        content.innerHTML = `
            <div class="profile-stats-grid">
                <div class="profile-stat-card">
                    <div class="stat-icon">🎮</div>
                    <div class="stat-value">${playerData.totalGames}</div>
                    <div class="stat-label">Total Games</div>
                </div>
                <div class="profile-stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-value">${playerData.avgScore}</div>
                    <div class="stat-label">Average Score</div>
                </div>
                <div class="profile-stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-value">${playerData.perfectScores}</div>
                    <div class="stat-label">Perfect Scores</div>
                </div>
                <div class="profile-stat-card personal-best-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">
                        <span class="pb-badge-large" title="Personal Best">🏆</span>
                        ${playerData.highestScore}
                    </div>
                    <div class="stat-label">Highest Score (PB)</div>
                </div>
                <div class="profile-stat-card">
                    <div class="stat-icon">📉</div>
                    <div class="stat-value">${playerData.lowestScore}</div>
                    <div class="stat-label">Lowest Score</div>
                </div>
                ${currentStreak ? `
                <div class="profile-stat-card active-streak">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-value">${currentStreak.streak}</div>
                    <div class="stat-label">Current Streak</div>
                </div>
                ` : ''}
                ${longestStreak ? `
                <div class="profile-stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-value">${longestStreak.streak}</div>
                    <div class="stat-label">Longest Streak</div>
                </div>
                ` : ''}
            </div>
            
            ${playerData.nemesisLocation ? `
            <div class="profile-nemesis">
                <h3>🎯 Nemesis Location</h3>
                <p>Location ${playerData.nemesisLocation} is your toughest challenge!</p>
            </div>
            ` : ''}
            
            <div class="profile-location-performance">
                <h3>Location Performance</h3>
                <div class="location-breakdown">
                    ${playerData.locationStats?.map(loc => `
                        <div class="location-stat ${loc.location === playerData.nemesisLocation ? 'nemesis' : ''}">
                            <div class="location-number">Location ${loc.location}</div>
                            <div class="location-avg">Avg: ${loc.avgScore}</div>
                            <div class="location-range">Range: ${loc.minScore} - ${loc.maxScore}</div>
                        </div>
                    `).join('') || '<p>No location data available</p>'}
                </div>
            </div>
            
            <div class="profile-performance-calendar">
                <h3>Performance Calendar</h3>
                <div id="performance-calendar" class="calendar-grid"></div>
            </div>
            
            <div class="profile-achievements">
                <h3>🏅 Achievements</h3>
                <div id="profile-achievements-grid" class="achievements-grid"></div>
            </div>
        `;
        
        // Render performance calendar
        this.renderPerformanceCalendar(playerData);
        
        // Render achievements
        this.renderProfileAchievements(playerData.user);
        
        // Add tooltips to profile stat cards
        setTimeout(() => this.addTooltipsToStats(), 100);
    }
    
    renderProfileAchievements(playerName) {
        const container = document.getElementById('profile-achievements-grid');
        if (!container) return;
        
        const achievements = this.data.analytics?.achievements?.[playerName] || [];
        
        if (achievements.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No achievements unlocked yet. Keep playing!</p>';
            return;
        }
        
        container.innerHTML = '';
        
        achievements.forEach(achievement => {
            const badge = document.createElement('div');
            badge.className = 'achievement-badge';
            badge.title = `${achievement.name}: ${achievement.description}`;
            
            const formatDate = (dateStr) => {
                const [year, month, day] = dateStr.split('-');
                return `${parseInt(month)}/${parseInt(day)}/${year}`;
            };
            
            badge.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    <div class="achievement-date">Unlocked: ${formatDate(achievement.unlockedDate)}</div>
                </div>
            `;
            
            container.appendChild(badge);
        });
    }
    
    renderPerformanceCalendar(playerData) {
        const calendarContainer = document.getElementById('performance-calendar');
        if (!calendarContainer || !playerData.gamesByDate) return;
        
        const games = Object.entries(playerData.gamesByDate)
            .map(([date, game]) => ({ date, ...game }))
            .sort((a, b) => a.date.localeCompare(b.date));
        
        calendarContainer.innerHTML = '';
        
        games.forEach(game => {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            
            // Color code by score
            const score = game.totalScore;
            if (score >= 900) {
                cell.classList.add('score-excellent');
            } else if (score >= 800) {
                cell.classList.add('score-good');
            } else if (score >= 700) {
                cell.classList.add('score-average');
            } else {
                cell.classList.add('score-poor');
            }
            
            const [year, month, day] = game.date.split('-');
            const displayDate = `${parseInt(month)}/${parseInt(day)}`;
            
            cell.innerHTML = `
                <div class="calendar-date">${displayDate}</div>
                <div class="calendar-score">${score}</div>
            `;
            
            cell.title = `${game.date}: ${score} points`;
            calendarContainer.appendChild(cell);
        });
    }
    
    async updateOverview() {
        // Check if data is loaded
        if (!this.data || !this.data.games || this.data.games.length === 0) {
            return;
        }
        
        // Update last updated timestamp
        this.updateLastUpdatedTimestamp();
        
        // For overview page, use overall stats (unfiltered data) for most widgets
        // except daily winner/loser which should use current day's data
        
        // Update overall stats using unfiltered data
        if (this.data.analytics) {
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
        
        // Update games today counter
        this.updateGamesTodayCounter();
        
        // Update daily winner and loser using current day's data
        this.updateDailyWinnerLoser(this.data.games);
        
        // Update overall stats using unfiltered data
        this.updateOverallStats(this.data.games);
        
        // Update streaks
        this.updateStreaks();
        
        // Update achievements leaderboard
        this.updateAchievementsLeaderboard();
        
        // Add tooltips to stat cards
        setTimeout(() => this.addTooltipsToStats(), 100);
        
        // Update insights and predictions (only if overview section is active)
        if (this.currentSection === 'overview') {
            try {
                this.updateInsights();
                this.updatePredictions();
                this.updateDataQuality();
            } catch (error) {
                console.error('Error updating insights/predictions:', error);
            }
        }
    }
    
    updateDataQuality() {
        const container = document.getElementById('data-quality-container');
        if (!container) return;
        
        if (!this.data || !this.data.games || this.data.games.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No data available</p>';
            return;
        }
        
        const qualityInfo = this.calculateDataQuality();
        
        container.innerHTML = '';
        
        // Last updated timestamp
        const lastUpdatedCard = document.createElement('div');
        lastUpdatedCard.className = 'quality-card quality-info';
        lastUpdatedCard.innerHTML = `
            <div class="quality-icon">🕐</div>
            <div class="quality-content">
                <div class="quality-title">Last Updated</div>
                <div class="quality-value" id="last-updated-time">${qualityInfo.lastUpdated}</div>
                <div class="quality-details">${qualityInfo.lastUpdatedRelative}</div>
            </div>
        `;
        container.appendChild(lastUpdatedCard);
        
        // Missing data days
        if (qualityInfo.missingDays.length > 0) {
            const missingCard = document.createElement('div');
            missingCard.className = 'quality-card quality-warning';
            const missingCount = qualityInfo.missingDays.length;
            const missingText = missingCount === 1 
                ? `1 missing day detected`
                : `${missingCount} missing days detected`;
            
            missingCard.innerHTML = `
                <div class="quality-icon">⚠️</div>
                <div class="quality-content">
                    <div class="quality-title">Missing Data</div>
                    <div class="quality-value">${missingText}</div>
                    <div class="quality-details">${qualityInfo.missingDays.slice(0, 5).join(', ')}${missingCount > 5 ? '...' : ''}</div>
                </div>
            `;
            container.appendChild(missingCard);
        }
        
        // Data anomalies
        if (qualityInfo.anomalies.length > 0) {
            const anomaliesCard = document.createElement('div');
            anomaliesCard.className = 'quality-card quality-alert';
            anomaliesCard.innerHTML = `
                <div class="quality-icon">🔍</div>
                <div class="quality-content">
                    <div class="quality-title">Data Anomalies</div>
                    <div class="quality-value">${qualityInfo.anomalies.length} detected</div>
                    <div class="quality-details">${qualityInfo.anomalies.slice(0, 3).map(a => a.description).join(', ')}${qualityInfo.anomalies.length > 3 ? '...' : ''}</div>
                </div>
            `;
            container.appendChild(anomaliesCard);
        }
        
        // Data freshness
        const freshnessCard = document.createElement('div');
        freshnessCard.className = `quality-card quality-${qualityInfo.freshness.status}`;
        freshnessCard.innerHTML = `
            <div class="quality-icon">${qualityInfo.freshness.icon}</div>
            <div class="quality-content">
                <div class="quality-title">Data Freshness</div>
                <div class="quality-value">${qualityInfo.freshness.statusText}</div>
                <div class="quality-details">${qualityInfo.freshness.description}</div>
            </div>
        `;
        container.appendChild(freshnessCard);
        
        // Data completeness
        const completenessCard = document.createElement('div');
        completenessCard.className = 'quality-card quality-info';
        completenessCard.innerHTML = `
            <div class="quality-icon">📈</div>
            <div class="quality-content">
                <div class="quality-title">Data Completeness</div>
                <div class="quality-value">${qualityInfo.completeness}%</div>
                <div class="quality-details">${qualityInfo.totalDays} days with data out of ${qualityInfo.expectedDays} expected</div>
            </div>
        `;
        container.appendChild(completenessCard);
    }
    
    updateLastUpdatedTimestamp() {
        const timestampElement = document.getElementById('last-updated-timestamp');
        if (!timestampElement) return;
        
        if (!this.data || !this.data.games || this.data.games.length === 0) {
            timestampElement.querySelector('.timestamp-text').textContent = 'Last updated: No data';
            return;
        }
        
        const games = this.data.games;
        const dates = [...new Set(games.map(g => g.date))].sort();
        
        // Last updated - most recent game date
        const mostRecentDate = dates[dates.length - 1];
        const lastUpdatedDate = new Date(mostRecentDate + 'T00:00:00');
        const now = new Date();
        const diffMs = now - lastUpdatedDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        let lastUpdatedRelative;
        if (diffDays > 0) {
            lastUpdatedRelative = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            lastUpdatedRelative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
            lastUpdatedRelative = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
            lastUpdatedRelative = 'Just now';
        }
        
        timestampElement.querySelector('.timestamp-text').textContent = `Last updated: ${lastUpdatedRelative}`;
        
        // Update every minute
        if (this.lastUpdatedInterval) {
            clearInterval(this.lastUpdatedInterval);
        }
        this.lastUpdatedInterval = setInterval(() => {
            this.updateLastUpdatedTimestamp();
        }, 60000); // Update every minute
    }
    
    updateGamesTodayCounter() {
        const gamesTodayElement = document.getElementById('games-today');
        if (!gamesTodayElement) return;
        
        if (!this.data || !this.data.games || this.data.games.length === 0) {
            gamesTodayElement.textContent = '0';
            return;
        }
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Count unique games for today (group by user-date)
        const todayGames = new Set();
        this.data.games.forEach(game => {
            if (game.date === todayStr) {
                const key = `${game.user}-${game.date}`;
                todayGames.add(key);
            }
        });
        
        const count = todayGames.size;
        gamesTodayElement.textContent = count;
        
        // Update every minute to catch new games
        if (this.gamesTodayInterval) {
            clearInterval(this.gamesTodayInterval);
        }
        this.gamesTodayInterval = setInterval(() => {
            this.updateGamesTodayCounter();
        }, 60000); // Update every minute
    }
    
    calculateDataQuality() {
        const games = this.data.games;
        const dates = [...new Set(games.map(g => g.date))].sort();
        
        // Last updated - most recent game date
        const mostRecentDate = dates[dates.length - 1];
        const lastUpdatedDate = new Date(mostRecentDate + 'T00:00:00');
        const now = new Date();
        const diffMs = now - lastUpdatedDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        let lastUpdatedRelative;
        if (diffDays > 0) {
            lastUpdatedRelative = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            lastUpdatedRelative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
            lastUpdatedRelative = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
            lastUpdatedRelative = 'Just now';
        }
        
        const formatDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${parseInt(month)}/${parseInt(day)}/${year}`;
        };
        
        // Detect missing data days
        const missingDays = [];
        if (dates.length > 1) {
            const startDate = new Date(dates[0] + 'T00:00:00');
            const endDate = new Date(dates[dates.length - 1] + 'T00:00:00');
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                if (!dates.includes(dateStr)) {
                    // Check if it's a weekend (optional - you might want data every day)
                    const dayOfWeek = d.getDay();
                    // Only flag weekdays as missing (0 = Sunday, 6 = Saturday)
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        missingDays.push(formatDate(dateStr));
                    }
                }
            }
        }
        
        // Detect anomalies
        const anomalies = [];
        
        // Anomaly 1: Unusually high scores (potential data entry errors)
        const allScores = [];
        const gameScores = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gameScores[key]) {
                gameScores[key] = game.total_score;
                allScores.push(game.total_score);
            }
        });
        
        if (allScores.length > 0) {
            const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
            const variance = allScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / allScores.length;
            const stdDev = Math.sqrt(variance);
            const threshold = mean + (3 * stdDev); // 3 standard deviations
            
            const highScores = allScores.filter(s => s > threshold);
            if (highScores.length > 0) {
                anomalies.push({
                    type: 'high-score',
                    description: `${highScores.length} unusually high score${highScores.length > 1 ? 's' : ''} (>${Math.round(threshold)})`
                });
            }
        }
        
        // Anomaly 2: Duplicate entries (same user, same date, same score)
        const duplicateCheck = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}-${game.total_score}`;
            duplicateCheck[key] = (duplicateCheck[key] || 0) + 1;
        });
        
        const duplicates = Object.entries(duplicateCheck).filter(([key, count]) => count > 5);
        if (duplicates.length > 0) {
            anomalies.push({
                type: 'duplicate',
                description: `${duplicates.length} potential duplicate${duplicates.length > 1 ? 's' : ''} detected`
            });
        }
        
        // Anomaly 3: Missing location scores (incomplete games)
        const incompleteGames = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!incompleteGames[key]) {
                incompleteGames[key] = [];
            }
            incompleteGames[key].push(game);
        });
        
        const incomplete = Object.values(incompleteGames).filter(gameSet => gameSet.length < 5);
        if (incomplete.length > 0) {
            anomalies.push({
                type: 'incomplete',
                description: `${incomplete.length} incomplete game${incomplete.length > 1 ? 's' : ''} (<5 locations)`
            });
        }
        
        // Data freshness
        let freshnessStatus, freshnessIcon, freshnessStatusText, freshnessDescription;
        if (diffDays === 0) {
            freshnessStatus = 'fresh';
            freshnessIcon = '✅';
            freshnessStatusText = 'Fresh';
            freshnessDescription = 'Data is up to date';
        } else if (diffDays <= 2) {
            freshnessStatus = 'recent';
            freshnessIcon = '🟡';
            freshnessStatusText = 'Recent';
            freshnessDescription = `Last update was ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffDays <= 7) {
            freshnessStatus = 'stale';
            freshnessIcon = '🟠';
            freshnessStatusText = 'Stale';
            freshnessDescription = `Last update was ${diffDays} days ago`;
        } else {
            freshnessStatus = 'outdated';
            freshnessIcon = '🔴';
            freshnessStatusText = 'Outdated';
            freshnessDescription = `Last update was ${diffDays} days ago`;
        }
        
        // Data completeness
        const startDate = new Date(dates[0] + 'T00:00:00');
        const endDate = new Date(dates[dates.length - 1] + 'T00:00:00');
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const completeness = Math.round((dates.length / totalDays) * 100);
        
        return {
            lastUpdated: formatDate(mostRecentDate),
            lastUpdatedRelative: lastUpdatedRelative,
            missingDays: missingDays,
            anomalies: anomalies,
            freshness: {
                status: freshnessStatus,
                icon: freshnessIcon,
                statusText: freshnessStatusText,
                description: freshnessDescription
            },
            completeness: completeness,
            totalDays: dates.length,
            expectedDays: totalDays
        };
    }
    
    updateInsights() {
        const container = document.getElementById('insights-container');
        if (!container) return;
        
        // Check if data is loaded
        if (!this.data || !this.data.games || this.data.games.length === 0 || !this.data.players || this.data.players.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">Loading insights...</p>';
            return;
        }
        
        const insights = [];
        const dataToUse = this.filteredData || this.data;
        
        // Insight 1: Most improved player
        const playerImprovements = [];
        (this.data.players || []).forEach(player => {
            const playerGames = dataToUse.games.filter(g => g.user === player);
            if (playerGames.length < 10) return;
            
            const dates = [...new Set(playerGames.map(g => g.date))].sort();
            const scores = dates.map(date => {
                const game = playerGames.find(g => g.date === date);
                return game ? game.total_score : null;
            }).filter(s => s !== null);
            
            if (scores.length < 10) return;
            
            const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
            const secondHalf = scores.slice(Math.floor(scores.length / 2));
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            const improvement = secondAvg - firstAvg;
            
            playerImprovements.push({ player, improvement, recentAvg: secondAvg });
        });
        
        playerImprovements.sort((a, b) => b.improvement - a.improvement);
        if (playerImprovements.length > 0 && playerImprovements[0].improvement > 50) {
            insights.push({
                type: 'improvement',
                icon: '📈',
                title: 'Most Improved Player',
                message: `${playerImprovements[0].player} has improved by ${Math.round(playerImprovements[0].improvement)} points on average!`,
                color: 'positive'
            });
        }
        
        // Insight 2: Most consistent player
        const playerConsistency = [];
        (this.data.players || []).forEach(player => {
            const playerGames = dataToUse.games.filter(g => g.user === player);
            if (playerGames.length < 10) return;
            
            const dates = [...new Set(playerGames.map(g => g.date))].sort();
            const scores = dates.map(date => {
                const game = playerGames.find(g => g.date === date);
                return game ? game.total_score : null;
            }).filter(s => s !== null);
            
            if (scores.length < 10) return;
            
            const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
            const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
            const stdDev = Math.sqrt(variance);
            
            playerConsistency.push({ player, stdDev, avgScore: mean });
        });
        
        playerConsistency.sort((a, b) => a.stdDev - b.stdDev);
        if (playerConsistency.length > 0 && playerConsistency[0].stdDev < 60) {
            insights.push({
                type: 'consistency',
                icon: '📊',
                title: 'Most Consistent Player',
                message: `${playerConsistency[0].player} has the most consistent scores (std dev: ${Math.round(playerConsistency[0].stdDev)})`,
                color: 'positive'
            });
        }
        
        // Insight 3: Hot streak
        const streaks = this.data.analytics?.streaks;
        if (streaks && streaks.currentStreaks && streaks.currentStreaks.length > 0) {
            const longestCurrent = streaks.currentStreaks.reduce((max, s) => s.streak > max.streak ? s : max, streaks.currentStreaks[0]);
            if (longestCurrent.streak >= 5) {
                insights.push({
                    type: 'streak',
                    icon: '🔥',
                    title: 'Hot Streak',
                    message: `${longestCurrent.player} is on a ${longestCurrent.streak}-day streak!`,
                    color: 'accent'
                });
            }
        }
        
        // Insight 4: Location difficulty insight
        const locationDifficulty = this.data.analytics?.locationDifficulty;
        if (locationDifficulty && locationDifficulty.length > 0) {
            const hardest = locationDifficulty[locationDifficulty.length - 1];
            const easiest = locationDifficulty[0];
            insights.push({
                type: 'location',
                icon: '🎯',
                title: 'Location Insights',
                message: `Location ${hardest.location_number} is the hardest (avg: ${hardest.avgScore}), Location ${easiest.location_number} is the easiest (avg: ${easiest.avgScore})`,
                color: 'info'
            });
        }
        
        // Display insights
        if (insights.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No insights available yet. Keep playing to generate insights!</p>';
            return;
        }
        
        container.innerHTML = '';
        insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = `insight-card insight-${insight.color}`;
            card.innerHTML = `
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }
    
    updatePredictions() {
        const container = document.getElementById('predictions-container');
        if (!container) return;
        
        // Check if data is loaded
        if (!this.data || !this.data.games || this.data.games.length === 0 || !this.data.players || this.data.players.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">Loading predictions...</p>';
            return;
        }
        
        const predictions = [];
        const dataToUse = this.filteredData || this.data;
        
        // Prediction 1: Next score prediction for each player
        (this.data.players || []).forEach(player => {
            const playerGames = dataToUse.games.filter(g => g.user === player);
            if (playerGames.length < 5) return;
            
            const dates = [...new Set(playerGames.map(g => g.date))].sort();
            const scores = dates.map(date => {
                const game = playerGames.find(g => g.date === date);
                return game ? game.total_score : null;
            }).filter(s => s !== null);
            
            if (scores.length < 5) return;
            
            // Use linear regression to predict next score
            const n = scores.length;
            const x = scores.map((_, i) => i);
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = scores.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, xi, i) => sum + xi * scores[i], 0);
            const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
            
            const denominator = (n * sumXX - sumX * sumX);
            if (Math.abs(denominator) < 0.0001) {
                // Use simple average if denominator is too small
                const avgScore = Math.round(sumY / n);
                predictions.push({
                    player: player,
                    predictedScore: avgScore,
                    confidence: 'medium',
                    trend: 'stable'
                });
                return;
            }
            
            const slope = (n * sumXY - sumX * sumY) / denominator;
            const intercept = (sumY - slope * sumX) / n;
            
            const predictedScore = Math.round(slope * n + intercept);
            const recentAvg = scores.slice(-5).reduce((a, b) => a + b, 0) / 5;
            
            // Use weighted average: 70% prediction, 30% recent average
            const finalPrediction = Math.round(predictedScore * 0.7 + recentAvg * 0.3);
            
            // Clamp to reasonable range
            const clampedPrediction = Math.max(0, Math.min(1000, finalPrediction));
            
            predictions.push({
                player: player,
                predictedScore: clampedPrediction,
                confidence: scores.length >= 10 ? 'high' : 'medium',
                trend: slope > 0 ? 'improving' : slope < 0 ? 'declining' : 'stable'
            });
        });
        
        // Sort by predicted score
        predictions.sort((a, b) => b.predictedScore - a.predictedScore);
        
        // Display top 5 predictions
        if (predictions.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">Not enough data for predictions yet. Keep playing!</p>';
            return;
        }
        
        container.innerHTML = '';
        predictions.slice(0, 5).forEach(pred => {
            const card = document.createElement('div');
            card.className = 'prediction-card';
            const trendIcon = pred.trend === 'improving' ? '📈' : pred.trend === 'declining' ? '📉' : '➡️';
            const confidenceBadge = pred.confidence === 'high' ? '<span class="confidence-badge high">High Confidence</span>' : '<span class="confidence-badge medium">Medium Confidence</span>';
            
            card.innerHTML = `
                <div class="prediction-player">${pred.player}</div>
                <div class="prediction-score">
                    <span class="predicted-value">${pred.predictedScore}</span>
                    <span class="predicted-label">predicted</span>
                </div>
                <div class="prediction-trend">
                    ${trendIcon} ${pred.trend}
                </div>
                ${confidenceBadge}
            `;
            
            card.addEventListener('click', () => {
                this.showPlayerProfile(pred.player);
            });
            
            container.appendChild(card);
        });
        
        // Add recommendation
        if (predictions.length > 0) {
            const topPrediction = predictions[0];
            const recommendationCard = document.createElement('div');
            recommendationCard.className = 'recommendation-card';
            recommendationCard.innerHTML = `
                <div class="recommendation-icon">💡</div>
                <div class="recommendation-content">
                    <div class="recommendation-title">Recommendation</div>
                    <div class="recommendation-message">
                        ${topPrediction.trend === 'improving' 
                            ? `Keep up the great work, ${topPrediction.player}! Your scores are trending upward.`
                            : topPrediction.trend === 'declining'
                            ? `${topPrediction.player}, consider focusing on your weaker locations to improve your scores.`
                            : `${topPrediction.player} is maintaining consistent performance.`}
                    </div>
                </div>
            `;
            container.appendChild(recommendationCard);
        }
    }
    
    updateAchievementsLeaderboard() {
        const container = document.getElementById('achievements-leaderboard');
        if (!container) return;
        
        const achievements = this.data.analytics?.achievements || {};
        
        // Calculate achievement counts per player
        const playerAchievements = Object.entries(achievements).map(([player, playerAchievements]) => ({
            player: player,
            count: playerAchievements.length,
            achievements: playerAchievements
        })).sort((a, b) => b.count - a.count);
        
        if (playerAchievements.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No achievements unlocked yet.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        playerAchievements.forEach(({ player, count, achievements: playerAchievementsList }, index) => {
            const card = document.createElement('div');
            card.className = 'achievement-leaderboard-card';
            
            const rank = index + 1;
            const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            // Get recent achievements (last 3)
            const recentAchievements = playerAchievementsList.slice(0, 3);
            
            card.innerHTML = `
                <div class="achievement-rank">${rankIcon}</div>
                <div class="achievement-player-info">
                    <div class="achievement-player-name">${player}</div>
                    <div class="achievement-count">${count} achievement${count !== 1 ? 's' : ''}</div>
                </div>
                <div class="achievement-badges-preview">
                    ${recentAchievements.map(a => `<span class="badge-icon" title="${a.name}">${a.icon}</span>`).join('')}
                    ${count > 3 ? `<span class="badge-more">+${count - 3}</span>` : ''}
                </div>
            `;
            
            // Make clickable to go to profile
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                this.showPlayerProfile(player);
            });
            
            container.appendChild(card);
        });
    }
    
    updateStreaks() {
        const streaks = this.data.analytics.streaks;
        if (!streaks) return;
        
        // Render current streaks
        const currentStreaksContainer = document.getElementById('current-streaks');
        currentStreaksContainer.innerHTML = '';
        
        if (streaks.currentStreaks && streaks.currentStreaks.length > 0) {
            streaks.currentStreaks.slice(0, 6).forEach(streak => {
                const streakCard = this.createStreakCard(streak, true);
                currentStreaksContainer.appendChild(streakCard);
            });
        } else {
            currentStreaksContainer.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No active streaks</p>';
        }
        
        // Render longest streaks
        const longestStreaksContainer = document.getElementById('longest-streaks');
        longestStreaksContainer.innerHTML = '';
        
        if (streaks.longestStreaks && streaks.longestStreaks.length > 0) {
            streaks.longestStreaks.slice(0, 6).forEach(streak => {
                const streakCard = this.createStreakCard(streak, false);
                longestStreaksContainer.appendChild(streakCard);
            });
        }
    }
    
    createStreakCard(streak, isActive) {
        const card = document.createElement('div');
        card.className = `streak-card ${isActive ? 'active' : ''}`;
        
        const icon = isActive ? '🔥' : '🏆';
        const label = isActive ? 'Days Active' : 'Days';
        
        // Format dates
        const formatDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${parseInt(month)}/${parseInt(day)}/${year}`;
        };
        
        card.innerHTML = `
            <div class="streak-icon">${icon}</div>
            <div class="streak-value">${streak.streak}</div>
            <div class="streak-label">${label}</div>
            <div class="streak-player">${streak.user}</div>
            <div class="streak-dates">${formatDate(streak.startDate)} - ${formatDate(streak.endDate)}</div>
        `;
        
        return card;
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
        // Only create chart if section is visible or already loaded
        if (this.currentSection !== 'trends' && !this.chartsLoaded.has('trends')) {
            return;
        }
        
        // Apply current filters
        const filteredGames = this.getFilteredTrendsGames();
        
        // If period is 'day', use existing logic
        if (this.currentPeriod === 'day') {
            const trends = this.calculateTrends(filteredGames);
        this.data.trends = trends;
            
            // Load rolling averages if checkbox is checked
            if (this.showRollingAverage) {
                try {
                    const response = await fetch('/api/aggregations?period=day');
                    if (response.ok) {
                        const aggregationData = await response.json();
                        this.data.aggregations = aggregationData;
                    }
                } catch (error) {
                    console.error('Error loading rolling averages:', error);
                }
            } else {
                this.data.aggregations = null;
            }
            
        this.createTrendsChart();
            this.renderTrendInsights(filteredGames);
            this.renderPlayerMiniCharts(filteredGames);
        } else {
            // Fetch aggregated data for other periods
            await this.updateTrendsWithAggregation();
        }
    }
    
    getFilteredTrendsGames() {
        let games = this.data.games || [];
        
        // Filter by selected players
        const trendsPlayerSelect = document.getElementById('trends-player-select');
        if (trendsPlayerSelect) {
            const selectedOptions = Array.from(trendsPlayerSelect.selectedOptions);
            const selectedPlayers = selectedOptions.map(opt => opt.value);
            
            if (!selectedPlayers.includes('all') && selectedPlayers.length > 0) {
                games = games.filter(g => selectedPlayers.includes(g.user));
            }
        }
        
        // Filter by date range
        const trendsDateStart = document.getElementById('trends-date-start');
        const trendsDateEnd = document.getElementById('trends-date-end');
        
        if (trendsDateStart && trendsDateStart.value) {
            games = games.filter(g => g.date >= trendsDateStart.value);
        }
        if (trendsDateEnd && trendsDateEnd.value) {
            games = games.filter(g => g.date <= trendsDateEnd.value);
        }
        
        return games;
    }
    
    populateTrendsPlayerSelect() {
        const select = document.getElementById('trends-player-select');
        if (!select || !this.data || !this.data.players) return;
        
        select.innerHTML = '<option value="all" selected>All Players</option>';
        this.data.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            select.appendChild(option);
        });
    }
    
    applyTrendsFilters() {
        this.updateTrends();
    }
    
    resetTrendsFilters() {
        const trendsPlayerSelect = document.getElementById('trends-player-select');
        const trendsDateStart = document.getElementById('trends-date-start');
        const trendsDateEnd = document.getElementById('trends-date-end');
        const rollingAverageToggle = document.getElementById('show-rolling-average');
        
        if (trendsPlayerSelect) {
            trendsPlayerSelect.value = 'all';
            Array.from(trendsPlayerSelect.options).forEach(opt => {
                opt.selected = opt.value === 'all';
            });
        }
        
        if (trendsDateStart && trendsDateEnd) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            trendsDateEnd.value = endDate.toISOString().split('T')[0];
            trendsDateStart.value = startDate.toISOString().split('T')[0];
        }
        
        if (rollingAverageToggle) {
            rollingAverageToggle.checked = false;
            this.showRollingAverage = false;
        }
        
        this.currentPeriod = 'day';
        const trendsPeriodSelector = document.getElementById('trends-period-selector');
        if (trendsPeriodSelector) {
            trendsPeriodSelector.value = 'day';
        }
        
        this.updateTrends();
    }
    
    renderTrendInsights(games) {
        const container = document.getElementById('trend-insights');
        if (!container) return;
        
        if (!games || games.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // Group by user-date
        const gameScores = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gameScores[key]) {
                gameScores[key] = {
                    user: game.user,
                    date: game.date,
                    totalScore: game.total_score
                };
            }
        });
        
        const scores = Object.values(gameScores).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (scores.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // Calculate insights
        const bestDay = scores.reduce((best, current) => 
            current.totalScore > best.totalScore ? current : best
        );
        
        const worstDay = scores.reduce((worst, current) => 
            current.totalScore < worst.totalScore ? current : worst
        );
        
        // Calculate improvement trend
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        
        const firstHalfAvg = firstHalf.length > 0 
            ? firstHalf.reduce((sum, s) => sum + s.totalScore, 0) / firstHalf.length 
            : 0;
        const secondHalfAvg = secondHalf.length > 0 
            ? secondHalf.reduce((sum, s) => sum + s.totalScore, 0) / secondHalf.length 
            : 0;
        
        const improvement = secondHalfAvg - firstHalfAvg;
        const improvementPercent = firstHalfAvg > 0 ? ((improvement / firstHalfAvg) * 100).toFixed(1) : 0;
        
        // Calculate current streak
        const recentScores = scores.slice(-10);
        const avgRecent = recentScores.length > 0
            ? recentScores.reduce((sum, s) => sum + s.totalScore, 0) / recentScores.length
            : 0;
        
        container.innerHTML = `
            <div class="insight-card insight-best">
                <div class="insight-icon">🏆</div>
                <div class="insight-content">
                    <div class="insight-label">Best Day</div>
                    <div class="insight-value">${bestDay.totalScore} pts</div>
                    <div class="insight-details">${bestDay.user} • ${this.formatDate(bestDay.date)}</div>
                </div>
            </div>
            <div class="insight-card insight-worst">
                <div class="insight-icon">📉</div>
                <div class="insight-content">
                    <div class="insight-label">Worst Day</div>
                    <div class="insight-value">${worstDay.totalScore} pts</div>
                    <div class="insight-details">${worstDay.user} • ${this.formatDate(worstDay.date)}</div>
                </div>
            </div>
            <div class="insight-card insight-trend ${improvement >= 0 ? 'trend-up' : 'trend-down'}">
                <div class="insight-icon">${improvement >= 0 ? '📈' : '📉'}</div>
                <div class="insight-content">
                    <div class="insight-label">Trend</div>
                    <div class="insight-value">${improvement >= 0 ? '+' : ''}${improvementPercent}%</div>
                    <div class="insight-details">${improvement >= 0 ? 'Improving' : 'Declining'} over time</div>
                </div>
            </div>
            <div class="insight-card insight-recent">
                <div class="insight-icon">⚡</div>
                <div class="insight-content">
                    <div class="insight-label">Recent Avg</div>
                    <div class="insight-value">${Math.round(avgRecent)} pts</div>
                    <div class="insight-details">Last 10 games</div>
                </div>
            </div>
        `;
    }
    
    renderPlayerMiniCharts(games) {
        const container = document.getElementById('player-mini-charts');
        if (!container) return;
        
        if (!games || games.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // Group by player
        const playerGames = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!playerGames[game.user]) {
                playerGames[game.user] = [];
            }
            if (!playerGames[game.user].find(g => `${g.user}-${g.date}` === key)) {
                playerGames[game.user].push({
                    user: game.user,
                    date: game.date,
                    totalScore: game.total_score
                });
            }
        });
        
        // Limit to top 6 players by game count
        const players = Object.entries(playerGames)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 6);
        
        container.innerHTML = '';
        
        players.forEach(([player, playerScores]) => {
            const scores = playerScores.sort((a, b) => new Date(a.date) - new Date(b.date));
            const card = document.createElement('div');
            card.className = 'mini-chart-card';
            
            const avgScore = scores.length > 0
                ? Math.round(scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length)
                : 0;
            
            const trend = scores.length >= 2
                ? scores[scores.length - 1].totalScore - scores[0].totalScore
                : 0;
            
            card.innerHTML = `
                <div class="mini-chart-header">
                    <h4>${player}</h4>
                    <div class="mini-chart-stats">
                        <span>Avg: ${avgScore}</span>
                        <span class="trend-indicator ${trend >= 0 ? 'trend-up' : 'trend-down'}">
                            ${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}
                        </span>
                    </div>
                </div>
                <div class="mini-chart-container">
                    <canvas class="mini-chart" data-player="${player}"></canvas>
                </div>
            `;
            
            container.appendChild(card);
            
            // Create mini chart
            setTimeout(() => {
                this.createMiniChart(player, scores, card.querySelector('.mini-chart'));
            }, 100);
        });
    }
    
    createMiniChart(player, scores, canvas) {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const labels = scores.map(s => {
            const [year, month, day] = s.date.split('-');
            return `${parseInt(month)}/${parseInt(day)}`;
        });
        const data = scores.map(s => s.totalScore);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: player,
                    data: data,
                    borderColor: '#ff00c1',
                    backgroundColor: 'rgba(255, 0, 193, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 3,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    formatDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }
    
    async updateTrendsWithAggregation() {
        try {
            const response = await fetch(`/api/aggregations?period=${this.currentPeriod}`);
            if (!response.ok) throw new Error('Failed to load aggregations');
            
            const aggregationData = await response.json();
            this.data.aggregations = aggregationData;
            this.createTrendsChart();
            this.renderPeriodSummaries(aggregationData.aggregations);
        } catch (error) {
            console.error('Error loading aggregations:', error);
        }
    }
    
    async updateTrendsWithDateRange(startDate, endDate) {
        try {
            const response = await fetch(`/api/aggregations?period=${this.currentPeriod}&startDate=${startDate}&endDate=${endDate}`);
            if (!response.ok) throw new Error('Failed to load aggregations');
            
            const aggregationData = await response.json();
            this.data.aggregations = aggregationData;
            this.createTrendsChart();
            this.renderPeriodSummaries(aggregationData.aggregations);
        } catch (error) {
            console.error('Error loading aggregations:', error);
        }
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
    
    renderPeriodSummaries(aggregations) {
        const container = document.getElementById('period-summaries');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group by period and calculate totals
        const periodTotals = {};
        aggregations.forEach(agg => {
            if (!periodTotals[agg.period]) {
                periodTotals[agg.period] = {
                    period: agg.period,
                    totalScore: 0,
                    totalGames: 0,
                    players: new Set(),
                    scores: []
                };
            }
            periodTotals[agg.period].totalScore += agg.totalScore;
            periodTotals[agg.period].totalGames += agg.gamesPlayed;
            periodTotals[agg.period].players.add(agg.user);
            const avgScore = agg.gamesPlayed > 0 ? Math.round(agg.totalScore / agg.gamesPlayed) : 0;
            periodTotals[agg.period].scores.push(avgScore);
        });
        
        // Sort periods chronologically
        const sortedPeriods = Object.values(periodTotals).sort((a, b) => {
            // Try to parse as dates first
            const dateA = new Date(a.period);
            const dateB = new Date(b.period);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateA - dateB;
            }
            return a.period.localeCompare(b.period);
        });
        
        // Create summary cards with enhanced stats
        sortedPeriods.forEach((period, index) => {
            const card = document.createElement('div');
            card.className = 'period-summary-card';
            const avgScore = period.totalGames > 0 ? Math.round(period.totalScore / period.totalGames) : 0;
            const minScore = period.scores.length > 0 ? Math.min(...period.scores) : 0;
            const maxScore = period.scores.length > 0 ? Math.max(...period.scores) : 0;
            
            // Calculate trend from previous period
            let trend = null;
            if (index > 0) {
                const prevPeriod = sortedPeriods[index - 1];
                const prevAvg = prevPeriod.totalGames > 0 ? Math.round(prevPeriod.totalScore / prevPeriod.totalGames) : 0;
                trend = avgScore - prevAvg;
            }
            
            card.innerHTML = `
                <div class="period-header">
                    <div class="period-label">${period.period}</div>
                    ${trend !== null ? `
                        <div class="period-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}">
                            ${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}
                        </div>
                    ` : ''}
                </div>
                <div class="period-value">${avgScore}</div>
                <div class="period-details">Avg Score</div>
                <div class="period-stats">
                    <span>Min: ${minScore}</span>
                    <span>Max: ${maxScore}</span>
                </div>
                <div class="period-meta">${period.totalGames} games • ${period.players.size} players</div>
            `;
            
            container.appendChild(card);
        });
    }
    
    updateAnalytics() {
        // Only create charts if section is visible or already loaded
        if (this.currentSection !== 'analytics' && !this.chartsLoaded.has('analytics')) {
            return;
        }
        
        // Use filtered data if available, otherwise use all data
        const dataToUse = this.filteredData || this.data;
        
        this.createEmojiChart(dataToUse.games);
        this.createStreaksChart(dataToUse.games);
        this.createPerfectLeadersChart(dataToUse.games);
        this.createLocationDifficultyChart();
        this.createLocationHeatmap();
        this.createScoreDistributionChart(dataToUse.games);
        this.createImprovementTrendsChart();
        this.updatePlayerAnalytics();
        
        // Advanced visualizations
        this.createRadarChart();
        this.createBoxPlotChart(dataToUse.games);
        this.createCorrelationMatrix(dataToUse.games);
        this.createCalendarHeatmap(dataToUse.games);
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
        
        // Enhanced chart configuration with animations
        const chartColors = this.getChartColors();
        
        this.charts.leaderboard = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: chartColors.map(c => c.backgroundColor),
                    borderColor: chartColors.map(c => c.borderColor),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return `${label}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                aspectRatio: 2,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
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
    
    updateLeaderboardTable() {
        const tbody = document.querySelector('#leaderboard-table tbody');
        tbody.innerHTML = '';
        
        // Calculate personal bests for highlighting
        const personalBests = {};
        if (this.data && this.data.games) {
            const allUserGames = {};
            this.data.games.forEach(game => {
                const key = `${game.user}-${game.date}`;
                if (!allUserGames[key]) {
                    allUserGames[key] = {
                        user: game.user,
                        totalScore: game.total_score
                    };
                }
            });
            
            Object.values(allUserGames).forEach(game => {
                const user = game.user;
                if (!personalBests[user]) {
                    personalBests[user] = game.totalScore;
                } else if (game.totalScore > personalBests[user]) {
                    personalBests[user] = game.totalScore;
                }
            });
        }
        
        // Get streak data
        const streaks = this.data.analytics.streaks;
        const currentStreaksMap = {};
        const longestStreaksMap = {};
        
        if (streaks) {
            streaks.currentStreaks?.forEach(s => {
                currentStreaksMap[s.user] = s.streak;
            });
            streaks.longestStreaks?.forEach(s => {
                longestStreaksMap[s.user] = s.streak;
            });
        }
        
        this.data.leaderboard.forEach((player, index) => {
            const row = document.createElement('tr');
            
            // Get streak info for this player
            const currentStreak = currentStreaksMap[player.user] || 0;
            const longestStreak = longestStreaksMap[player.user] || 0;
            
            // Check if this is a personal best
            const playerPB = personalBests[player.user] || 0;
            const isPB = player.totalScore === playerPB && playerPB > 0;
            
            // Add PB class to row if it's a personal best
            if (isPB) {
                row.classList.add('personal-best-row');
            }
            
            // Create streak display
            let streakDisplay = '-';
            if (currentStreak > 0) {
                streakDisplay = `<span style="color: var(--accent-primary); font-weight: bold;">🔥 ${currentStreak}</span>`;
            } else if (longestStreak > 0) {
                streakDisplay = `<span style="color: var(--text-muted);">🏆 ${longestStreak}</span>`;
            }
            
            // Add PB badge to total score if it's a personal best
            let totalScoreDisplay = player.totalScore.toLocaleString();
            if (isPB) {
                totalScoreDisplay = `<span class="pb-badge" title="Personal Best!">🏆</span> ${totalScoreDisplay}`;
            }
            
            // Make player name clickable
            const playerNameCell = `<td><strong><a href="#" class="player-link" data-player="${player.user}">${player.user}</a></strong></td>`;
            
            row.innerHTML = `
                <td>${index + 1}</td>
                ${playerNameCell}
                <td class="${isPB ? 'pb-score' : ''}">${totalScoreDisplay}</td>
                <td>${player.avgScore}</td>
                <td>${player.gamesPlayed}</td>
                <td>${player.perfectScores}</td>
                <td>${player.lowestScore}</td>
                <td>${streakDisplay}</td>
            `;
            tbody.appendChild(row);
        });
        
        // Add click handlers for player links
        tbody.querySelectorAll('.player-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const playerName = link.dataset.player;
                this.showPlayerProfile(playerName);
            });
        });
    }
    
    createTrendsChart() {
        const ctx = document.getElementById('trends-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.trends) {
            this.charts.trends.destroy();
        }
        
        // Adjust chart options for mobile
        const isMobile = window.innerWidth <= 768;
        
        let labels = [];
        let datasets = [];
        const chartColors = this.getChartColors(20);
        
        // Handle period aggregation vs daily trends
        if (this.currentPeriod === 'day' && this.data.trends && this.data.trends.length > 0) {
            // Daily trends - existing logic
        const playerTrends = {};
        this.data.trends.forEach(trend => {
            if (!playerTrends[trend.user]) {
                playerTrends[trend.user] = [];
            }
            playerTrends[trend.user].push(trend);
        });
        
            labels = [...new Set(this.data.trends.map(t => t.date))].sort();
            
            // Limit to top 8 players by game count to avoid clutter
            const players = Object.entries(playerTrends)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 8);
            
            players.forEach(([player, trends], index) => {
            const data = labels.map(date => {
                const trend = trends.find(t => t.date === date);
                return trend ? trend.totalScore : null;
            });
                
                datasets.push({
                    label: player,
                    data: data,
                    borderColor: chartColors[index].borderColor,
                    backgroundColor: chartColors[index].backgroundColor,
                    tension: 0.4,
                    fill: false,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6,
                    borderWidth: 2
                });
            });
            
            // Add rolling averages if enabled and period is day
            if (this.showRollingAverage && this.data.aggregations?.rollingAverages) {
                const rolling = this.data.aggregations.rollingAverages;
                
                if (rolling.sevenDay && rolling.sevenDay.length > 0) {
                    const sevenDayLabels = rolling.sevenDay.map(r => r.date);
                    const sevenDayData = labels.map(date => {
                        const rolling = rolling.sevenDay.find(r => r.date === date);
                        return rolling ? rolling.avgScore : null;
                    });
                    
                    datasets.push({
                        label: '7-Day Rolling Avg',
                        data: sevenDayData,
                        borderColor: '#00fff9',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    });
                }
                
                if (rolling.thirtyDay && rolling.thirtyDay.length > 0) {
                    const thirtyDayData = labels.map(date => {
                        const rolling = rolling.thirtyDay.find(r => r.date === date);
                        return rolling ? rolling.avgScore : null;
                    });
                    
                    datasets.push({
                        label: '30-Day Rolling Avg',
                        data: thirtyDayData,
                        borderColor: '#00b8ff',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    });
                }
            }
        } else if (this.data.aggregations && this.data.aggregations.aggregations) {
            // Period aggregation
            const aggregations = this.data.aggregations.aggregations;
            const uniquePeriods = [...new Set(aggregations.map(a => a.period))].sort();
            labels = uniquePeriods;
            
            // Group by player
            const playerAggregations = {};
            aggregations.forEach(agg => {
                if (!playerAggregations[agg.user]) {
                    playerAggregations[agg.user] = {};
                }
                playerAggregations[agg.user][agg.period] = agg;
            });
            
            Object.entries(playerAggregations).forEach(([player, periodMap], index) => {
                const data = uniquePeriods.map(period => {
                    const agg = periodMap[period];
                    return agg ? Math.round(agg.totalScore / agg.gamesPlayed) : null;
                });
            
            datasets.push({
                label: player,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                tension: 0.4,
                    fill: false,
                    pointRadius: 4
                });
            });
        } else {
            console.warn('No trends or aggregation data available');
            return;
        }
        
        // Format labels based on period
        const formattedLabels = labels.map(label => {
            if (this.currentPeriod === 'day') {
                const [year, month, day] = label.split('-');
                return `${parseInt(month)}/${parseInt(day)}`;
            }
            return label;
        });
        
        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart',
                    delay: (context) => context.dataIndex * 50
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} points`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6,
                        borderWidth: 2
                    },
                    line: {
                        borderWidth: 2
                    }
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
        
        const chartColors = this.getChartColors(labels.length);
        
        this.charts.emoji = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: chartColors.map(c => c.backgroundColor),
                    borderColor: chartColors.map(c => c.borderColor),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 11,
                                family: 'Courier New, monospace'
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
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
        
        const chartColors = this.getChartColors(labels.length);
        
        this.charts.streaks = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Max Streak (Days)',
                    data: data,
                    backgroundColor: chartColors.map(c => c.backgroundColor),
                    borderColor: chartColors.map(c => c.borderColor),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `Max Streak: ${context.parsed.y} days`;
                            }
                        }
                    }
                },
                aspectRatio: 1.5,
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
        
        const chartColors = this.getChartColors(labels.length);
        
        this.charts.perfectLeaders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perfect Scores',
                    data: data,
                    backgroundColor: chartColors.map(c => c.backgroundColor),
                    borderColor: chartColors.map(c => c.borderColor),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `Perfect Scores: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
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
    
    createLocationDifficultyChart() {
        const ctx = document.getElementById('location-difficulty-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.locationDifficulty) {
            this.charts.locationDifficulty.destroy();
        }
        
        const locationDifficulty = this.data.analytics.locationDifficulty || [];
        
        const labels = locationDifficulty.map(loc => `Location ${loc.location}`);
        const data = locationDifficulty.map(loc => loc.avgScore);
        
        this.charts.locationDifficulty = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Score',
                    data: data,
                    backgroundColor: data.map(score => {
                        if (score >= 80) return 'rgba(0, 255, 249, 0.8)';
                        if (score >= 60) return 'rgba(0, 184, 255, 0.8)';
                        if (score >= 40) return 'rgba(150, 0, 255, 0.8)';
                        return 'rgba(255, 0, 193, 0.8)';
                    }),
                    borderColor: data.map(score => {
                        if (score >= 80) return '#00fff9';
                        if (score >= 60) return '#00b8ff';
                        if (score >= 40) return '#9600ff';
                        return '#ff00c1';
                    }),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `Avg Score: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
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
    
    createScoreDistributionChart(games = this.data.games) {
        const ctx = document.getElementById('score-distribution-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.scoreDistribution) {
            this.charts.scoreDistribution.destroy();
        }
        
        // Group games by user-date to get unique game scores
        const gameScores = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gameScores[key]) {
                gameScores[key] = game.total_score;
            }
        });
        
        const scores = Object.values(gameScores);
        
        // Create bins for histogram (0-1000, in 50-point increments)
        const bins = [];
        const binSize = 50;
        for (let i = 0; i <= 1000; i += binSize) {
            bins.push({ min: i, max: i + binSize - 1, count: 0 });
        }
        
        scores.forEach(score => {
            const binIndex = Math.floor(score / binSize);
            if (binIndex < bins.length) {
                bins[binIndex].count++;
            }
        });
        
        const labels = bins.map(bin => `${bin.min}-${bin.max}`);
        const data = bins.map(bin => bin.count);
        
        this.charts.scoreDistribution = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Games',
                    data: data,
                    backgroundColor: data.map((count, i) => {
                        const score = i * binSize;
                        if (score >= 900) return '#00fff9';
                        if (score >= 800) return '#00b8ff';
                        if (score >= 700) return '#9600ff';
                        return '#ff00c1';
                    }),
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} games in ${context.label} range`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9',
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
    
    createImprovementTrendsChart() {
        const ctx = document.getElementById('improvement-trends-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.improvementTrends) {
            this.charts.improvementTrends.destroy();
        }
        
        // Calculate improvement rate (slope) for each player
        const playerImprovements = [];
        
        this.data.players.forEach(player => {
            const playerGames = this.data.games.filter(g => g.user === player);
            
            // Group by date
            const gamesByDate = {};
            playerGames.forEach(game => {
                const key = `${game.user}-${game.date}`;
                if (!gamesByDate[key]) {
                    gamesByDate[key] = game.total_score;
                }
            });
            
            const dates = Object.keys(gamesByDate).map(key => key.split('-')[1]).sort();
            const scores = dates.map(date => {
                const key = Object.keys(gamesByDate).find(k => k.includes(date));
                return gamesByDate[key];
            });
            
            if (scores.length < 2) return;
            
            // Calculate linear regression slope (improvement rate)
            const n = scores.length;
            const x = scores.map((_, i) => i);
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = scores.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, xi, i) => sum + xi * scores[i], 0);
            const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            
            // Calculate consistency (standard deviation)
            const mean = sumY / n;
            const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / n;
            const stdDev = Math.sqrt(variance);
            
            playerImprovements.push({
                player: player,
                improvementRate: Math.round(slope * 100) / 100,
                consistency: Math.round(stdDev),
                avgScore: Math.round(mean),
                gamesPlayed: scores.length
            });
        });
        
        // Sort by improvement rate
        playerImprovements.sort((a, b) => b.improvementRate - a.improvementRate);
        
        const labels = playerImprovements.map(p => p.player);
        const improvementData = playerImprovements.map(p => p.improvementRate);
        const consistencyData = playerImprovements.map(p => p.consistency);
        
        this.charts.improvementTrends = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Improvement Rate (slope)',
                        data: improvementData,
                        backgroundColor: '#00fff9',
                        borderColor: '#00b8ff',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Consistency (std dev)',
                        data: consistencyData,
                        backgroundColor: '#ff00c1',
                        borderColor: '#9600ff',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y1',
                        type: 'line',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#00fff9'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Improvement Rate: ${context.parsed.y} points/game`;
                                } else {
                                    return `Consistency: ${context.parsed.y} (lower is better)`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9'
                        },
                        title: {
                            display: true,
                            text: 'Improvement Rate',
                            color: '#00fff9'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#ff00c1'
                        },
                        title: {
                            display: true,
                            text: 'Consistency (std dev)',
                            color: '#ff00c1'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
    
    async updatePlayerAnalytics() {
        const container = document.getElementById('player-analytics-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Calculate analytics for each player
        const playerAnalytics = [];
        
        for (const player of this.data.players) {
            const playerGames = this.data.games.filter(g => g.user === player);
            
            // Group by date
            const gamesByDate = {};
            playerGames.forEach(game => {
                const key = `${game.user}-${game.date}`;
                if (!gamesByDate[key]) {
                    gamesByDate[key] = {
                        date: game.date,
                        totalScore: game.total_score,
                        scores: []
                    };
                }
                gamesByDate[key].scores.push(game.location_score);
            });
            
            const dates = Object.keys(gamesByDate).map(key => gamesByDate[key].date).sort();
            const totalScores = dates.map(date => {
                const game = Object.values(gamesByDate).find(g => g.date === date);
                return game.totalScore;
            });
            
            if (totalScores.length < 2) continue;
            
            // Calculate improvement rate
            const n = totalScores.length;
            const x = totalScores.map((_, i) => i);
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = totalScores.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, xi, i) => sum + xi * totalScores[i], 0);
            const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            
            // Calculate consistency (std dev)
            const mean = sumY / n;
            const variance = totalScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / n;
            const stdDev = Math.sqrt(variance);
            
            // Calculate head-to-head records
            const h2hRecords = {};
            this.data.players.forEach(opponent => {
                if (opponent === player) return;
                
                const commonDates = dates.filter(date => {
                    const opponentKey = `${opponent}-${date}`;
                    return Object.keys(gamesByDate).some(k => k.includes(date)) &&
                           this.data.games.some(g => g.user === opponent && g.date === date);
                });
                
                if (commonDates.length === 0) return;
                
                let wins = 0;
                let losses = 0;
                let ties = 0;
                
                commonDates.forEach(date => {
                    const playerScore = gamesByDate[`${player}-${date}`]?.totalScore || 0;
                    const opponentGames = this.data.games.filter(g => g.user === opponent && g.date === date);
                    const opponentScore = opponentGames.length > 0 ? opponentGames[0].total_score : 0;
                    
                    if (playerScore > opponentScore) wins++;
                    else if (playerScore < opponentScore) losses++;
                    else ties++;
                });
                
                h2hRecords[opponent] = { wins, losses, ties, games: commonDates.length };
            });
            
            playerAnalytics.push({
                player: player,
                improvementRate: Math.round(slope * 100) / 100,
                consistency: Math.round(stdDev),
                avgScore: Math.round(mean),
                gamesPlayed: totalScores.length,
                h2hRecords: h2hRecords
            });
        }
        
        // Sort by improvement rate
        playerAnalytics.sort((a, b) => b.improvementRate - a.improvementRate);
        
        // Create cards for each player
        playerAnalytics.forEach(analytics => {
            const card = document.createElement('div');
            card.className = 'player-analytics-card';
            
            // Find best and worst H2H records
            const h2hEntries = Object.entries(analytics.h2hRecords);
            const bestH2H = h2hEntries.reduce((best, [opponent, record]) => {
                const winRate = record.games > 0 ? record.wins / record.games : 0;
                const bestWinRate = best.record.games > 0 ? best.record.wins / best.record.games : 0;
                return winRate > bestWinRate ? { opponent, record } : best;
            }, { opponent: '', record: { wins: 0, games: 0 } });
            
            const worstH2H = h2hEntries.reduce((worst, [opponent, record]) => {
                const winRate = record.games > 0 ? record.wins / record.games : 1;
                const worstWinRate = worst.record.games > 0 ? worst.record.wins / worst.record.games : 1;
                return winRate < worstWinRate ? { opponent, record } : worst;
            }, { opponent: '', record: { wins: 0, games: 0 } });
            
            card.innerHTML = `
                <div class="analytics-card-header">
                    <h4>${analytics.player}</h4>
                </div>
                <div class="analytics-stats">
                    <div class="analytics-stat">
                        <span class="stat-label">Improvement Rate</span>
                        <span class="stat-value ${analytics.improvementRate >= 0 ? 'positive' : 'negative'}">
                            ${analytics.improvementRate >= 0 ? '+' : ''}${analytics.improvementRate} pts/game
                        </span>
                    </div>
                    <div class="analytics-stat">
                        <span class="stat-label">Consistency</span>
                        <span class="stat-value">${analytics.consistency} (std dev)</span>
                    </div>
                    <div class="analytics-stat">
                        <span class="stat-label">Avg Score</span>
                        <span class="stat-value">${analytics.avgScore}</span>
                    </div>
                    <div class="analytics-stat">
                        <span class="stat-label">Games Played</span>
                        <span class="stat-value">${analytics.gamesPlayed}</span>
                    </div>
                </div>
                ${h2hEntries.length > 0 ? `
                <div class="h2h-summary">
                    <h5>Head-to-Head</h5>
                    ${bestH2H.opponent ? `
                    <div class="h2h-best">
                        <span>Best vs:</span> <strong>${bestH2H.opponent}</strong>
                        <span>${bestH2H.record.wins}-${bestH2H.record.losses}${bestH2H.record.ties > 0 ? `-${bestH2H.record.ties}` : ''}</span>
                    </div>
                    ` : ''}
                    ${worstH2H.opponent && worstH2H.opponent !== bestH2H.opponent ? `
                    <div class="h2h-worst">
                        <span>Worst vs:</span> <strong>${worstH2H.opponent}</strong>
                        <span>${worstH2H.record.wins}-${worstH2H.record.losses}${worstH2H.record.ties > 0 ? `-${worstH2H.record.ties}` : ''}</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            `;
            
            container.appendChild(card);
        });
    }
    
    async createLocationHeatmap() {
        const heatmapContainer = document.getElementById('location-heatmap');
        if (!heatmapContainer) return;
        
        heatmapContainer.innerHTML = '';
        
        // Get all players
        const players = this.data.players;
        
        // Create header row
        const headerRow = document.createElement('div');
        headerRow.className = 'location-heatmap-header';
        headerRow.textContent = 'Player';
        heatmapContainer.appendChild(headerRow);
        
        for (let loc = 1; loc <= 5; loc++) {
            const header = document.createElement('div');
            header.className = 'location-heatmap-cell location-header';
            header.textContent = `Loc ${loc}`;
            heatmapContainer.appendChild(header);
        }
        
        // Fetch location stats for each player and create rows
        const playerLocationStats = {};
        
        // Use analytics data if available, otherwise fetch per player
        for (const player of players) {
            try {
                const response = await fetch(`/api/player/${encodeURIComponent(player)}`);
                if (response.ok) {
                    const playerData = await response.json();
                    playerLocationStats[player] = playerData.locationStats || [];
                }
            } catch (error) {
                console.error(`Error fetching data for ${player}:`, error);
            }
        }
        
        // Create rows for each player
        players.forEach(player => {
            const stats = playerLocationStats[player] || [];
            const nemesisLoc = playerLocationStats[player]?.[0]?.location || null;
            
            // Player name cell
            const nameCell = document.createElement('div');
            nameCell.className = 'location-heatmap-cell player-name';
            nameCell.textContent = player;
            heatmapContainer.appendChild(nameCell);
            
            // Location score cells
            for (let loc = 1; loc <= 5; loc++) {
                const locStat = stats.find(s => s.location === loc);
                const cell = document.createElement('div');
                cell.className = 'location-heatmap-cell';
                
                if (locStat) {
                    const avgScore = locStat.avgScore;
                    cell.textContent = avgScore;
                    
                    // Color code by score
                    if (avgScore >= 80) {
                        cell.classList.add('score-high');
                    } else if (avgScore >= 60) {
                        cell.classList.add('score-medium');
                    } else {
                        cell.classList.add('score-low');
                    }
                    
                    // Highlight nemesis location
                    if (loc === nemesisLoc) {
                        cell.classList.add('nemesis');
                        cell.title = 'Nemesis Location (Lowest Average)';
                    } else {
                        cell.title = `Avg: ${avgScore}, Min: ${locStat.minScore}, Max: ${locStat.maxScore}`;
                    }
                } else {
                    cell.textContent = '-';
                    cell.style.color = 'var(--text-muted)';
                }
                
                heatmapContainer.appendChild(cell);
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
    
    // Comparison Feature Methods
    openComparisonModal() {
        const modal = document.getElementById('comparison-modal');
        const selectorsContainer = document.getElementById('comparison-player-selectors');
        
        // Clear previous selectors
        selectorsContainer.innerHTML = '';
        
        // Create 3 player selectors
        for (let i = 0; i < 3; i++) {
            const selectorDiv = document.createElement('div');
            selectorDiv.className = 'comparison-player-select';
            
            const label = document.createElement('label');
            label.textContent = `Player ${i + 1}:`;
            label.setAttribute('for', `comparison-player-${i}`);
            
            const select = document.createElement('select');
            select.id = `comparison-player-${i}`;
            select.innerHTML = '<option value="">-- Select Player --</option>';
            
            // Populate with players
            this.data.players.forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                select.appendChild(option);
            });
            
            selectorDiv.appendChild(label);
            selectorDiv.appendChild(select);
            selectorsContainer.appendChild(selectorDiv);
        }
        
        modal.classList.remove('hidden');
    }
    
    closeComparisonModal() {
        const modal = document.getElementById('comparison-modal');
        modal.classList.add('hidden');
    }
    
    async applyComparison() {
        const selectedPlayers = [];
        
        // Get selected players
        for (let i = 0; i < 3; i++) {
            const select = document.getElementById(`comparison-player-${i}`);
            if (select.value) {
                selectedPlayers.push(select.value);
            }
        }
        
        if (selectedPlayers.length < 2) {
            alert('Please select at least 2 players to compare.');
            return;
        }
        
        if (selectedPlayers.length > 3) {
            alert('Please select no more than 3 players.');
            return;
        }
        
        this.comparingPlayers = selectedPlayers;
        await this.loadComparisonData();
        this.closeComparisonModal();
    }
    
    async loadComparisonData() {
        try {
            const playersParam = this.comparingPlayers.join(',');
            const response = await fetch(`/api/compare?players=${encodeURIComponent(playersParam)}`);
            
            if (!response.ok) {
                throw new Error('Failed to load comparison data');
            }
            
            this.comparisonData = await response.json();
            this.renderComparisonView();
        } catch (error) {
            console.error('Error loading comparison data:', error);
            alert('Failed to load comparison data. Please try again.');
        }
    }
    
    renderComparisonView() {
        const comparisonView = document.getElementById('comparison-view');
        const statsContainer = document.getElementById('comparison-stats');
        const headToHeadContainer = document.getElementById('comparison-head-to-head');
        
        // Show comparison view
        comparisonView.classList.remove('hidden');
        
        // Clear previous content
        statsContainer.innerHTML = '';
        headToHeadContainer.innerHTML = '';
        
        // Render stat cards for each player
        const playerColors = ['#ff00c1', '#9600ff', '#00b8ff'];
        
        this.comparisonData.players.forEach((player, index) => {
            const statCard = document.createElement('div');
            statCard.className = 'comparison-stat-card';
            statCard.style.borderColor = playerColors[index];
            
            statCard.innerHTML = `
                <h4 style="color: ${playerColors[index]}">${player.user}</h4>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.totalScore}</div>
                <div class="stat-label">Total Score</div>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.avgScore}</div>
                <div class="stat-label">Average Score</div>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.totalGames}</div>
                <div class="stat-label">Games Played</div>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.perfectScores}</div>
                <div class="stat-label">Perfect Scores</div>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.highestScore}</div>
                <div class="stat-label">Highest Score</div>
                <div class="stat-value" style="color: ${playerColors[index]}">${player.lowestScore}</div>
                <div class="stat-label">Lowest Score</div>
            `;
            
            statsContainer.appendChild(statCard);
        });
        
        // Render head-to-head if comparing 2 players
        if (this.comparisonData.headToHead && this.comparisonData.players.length === 2) {
            const [p1, p2] = this.comparisonData.players;
            const h2h = this.comparisonData.headToHead;
            
            headToHeadContainer.innerHTML = `
                <h4>Head-to-Head Record</h4>
                <div class="head-to-head-stats">
                    <div class="head-to-head-stat">
                        <div class="value" style="color: ${playerColors[0]}">${h2h[p1.user] || 0}</div>
                        <div class="label">${p1.user} Wins</div>
                    </div>
                    <div class="head-to-head-stat">
                        <div class="value">${h2h.ties || 0}</div>
                        <div class="label">Ties</div>
                    </div>
                    <div class="head-to-head-stat">
                        <div class="value" style="color: ${playerColors[1]}">${h2h[p2.user] || 0}</div>
                        <div class="label">${p2.user} Wins</div>
                    </div>
                    <div class="head-to-head-stat">
                        <div class="value">${h2h.commonGames || 0}</div>
                        <div class="label">Common Games</div>
                    </div>
                </div>
            `;
        }
        
        // Create comparison chart
        this.createComparisonChart();
    }
    
    createComparisonChart() {
        const ctx = document.getElementById('comparison-chart').getContext('2d');
        
        if (this.charts.comparison) {
            this.charts.comparison.destroy();
        }
        
        const playerColors = ['#ff00c1', '#9600ff', '#00b8ff'];
        const datasets = [];
        
        // Get all unique dates across all players
        const allDates = new Set();
        this.comparisonData.players.forEach(player => {
            player.trends.forEach(trend => allDates.add(trend.date));
        });
        const sortedDates = Array.from(allDates).sort();
        
        // Create dataset for each player
        this.comparisonData.players.forEach((player, index) => {
            const scoresByDate = {};
            player.trends.forEach(trend => {
                scoresByDate[trend.date] = trend.score;
            });
            
            const data = sortedDates.map(date => scoresByDate[date] || null);
            
            datasets.push({
                label: player.user,
                data: data,
                borderColor: playerColors[index],
                backgroundColor: playerColors[index] + '40',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        });
        
        // Format dates for display
        const formattedDates = sortedDates.map(date => {
            const [year, month, day] = date.split('-');
            return `${parseInt(month)}/${parseInt(day)}`;
        });
        
        this.charts.comparison = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#00fff9',
                            font: {
                                family: 'Courier New',
                                size: 12
                            },
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} points`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)'
                        },
                        ticks: {
                            color: '#00fff9',
                            maxRotation: 45,
                            minRotation: 45
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
    
    clearComparison() {
        this.comparisonData = null;
        this.comparingPlayers = [];
        document.getElementById('comparison-view').classList.add('hidden');
        
        if (this.charts.comparison) {
            this.charts.comparison.destroy();
            this.charts.comparison = null;
        }
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
        
        // Pagination
        const totalPages = Math.ceil(sortedGames.length / this.rowsPerPage);
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const paginatedGames = sortedGames.slice(startIndex, endIndex);
        
        // Update pagination info
        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage >= totalPages;
        
        paginatedGames.forEach(game => {
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
        
        this.downloadCSV(csvContent, `maptap-data-${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    exportFilteredCSV() {
        const dataToExport = this.filteredData || this.data;
        const headers = ['user', 'date', 'location_number', 'location_score', 'location_emoji', 'total_score'];
        
        // Build filter description
        const filterDesc = [];
        if (this.currentFilters.players && this.currentFilters.players.length > 0) {
            filterDesc.push(`players-${this.currentFilters.players.join('_')}`);
        }
        if (this.currentFilters.date) {
            filterDesc.push(`date-${this.currentFilters.date}`);
        }
        if (this.currentFilters.dateRangeStart || this.currentFilters.dateRangeEnd) {
            filterDesc.push(`daterange-${this.currentFilters.dateRangeStart || 'start'}-${this.currentFilters.dateRangeEnd || 'end'}`);
        }
        if (this.currentFilters.scoreMin !== '' || this.currentFilters.scoreMax !== '') {
            filterDesc.push(`score-${this.currentFilters.scoreMin || 'min'}-${this.currentFilters.scoreMax || 'max'}`);
        }
        
        const csvContent = [
            headers.join(','),
            ...dataToExport.games.map(game => 
                headers.map(header => {
                    const value = game[header] || '';
                    return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        const filename = filterDesc.length > 0 
            ? `maptap-data-filtered-${filterDesc.join('_')}-${new Date().toISOString().split('T')[0]}.csv`
            : `maptap-data-filtered-${new Date().toISOString().split('T')[0]}.csv`;
        
        this.downloadCSV(csvContent, filename);
    }
    
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    exportChart(chartName) {
        const chart = this.charts[chartName];
        if (!chart) {
            alert('Chart not available. Please wait for it to load.');
            return;
        }
        
        const url = chart.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        link.download = `maptap-${chartName}-chart-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    exportAllCharts() {
        const chartNames = ['leaderboard', 'trends', 'emoji', 'streaks', 'perfectLeaders', 'locationDifficulty'];
        let exported = 0;
        
        chartNames.forEach(name => {
            if (this.charts[name]) {
                setTimeout(() => {
                    this.exportChart(name);
                    exported++;
                    if (exported === chartNames.filter(n => this.charts[n]).length) {
                        alert(`Exported ${exported} chart(s)!`);
                    }
                }, exported * 500); // Stagger exports
            }
        });
        
        if (exported === 0) {
            alert('No charts available to export.');
        }
    }
    
    shareLink(section) {
        // Build shareable URL with current filters
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        
        // Add section
        params.set('section', section);
        
        // Add filters
        if (this.currentFilters.players && this.currentFilters.players.length > 0) {
            params.set('players', this.currentFilters.players.join(','));
        }
        if (this.currentFilters.date) {
            params.set('date', this.currentFilters.date);
        }
        if (this.currentFilters.dateRangeStart) {
            params.set('dateStart', this.currentFilters.dateRangeStart);
        }
        if (this.currentFilters.dateRangeEnd) {
            params.set('dateEnd', this.currentFilters.dateRangeEnd);
        }
        if (this.currentFilters.scoreMin !== '') {
            params.set('scoreMin', this.currentFilters.scoreMin);
        }
        if (this.currentFilters.scoreMax !== '') {
            params.set('scoreMax', this.currentFilters.scoreMax);
        }
        if (this.currentFilters.sort) {
            params.set('sort', this.currentFilters.sort);
        }
        
        const shareUrl = `${baseUrl}#${section}?${params.toString()}`;
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Link copied to clipboard!\n\n' + shareUrl);
            }).catch(() => {
                this.fallbackCopyToClipboard(shareUrl);
            });
        } else {
            this.fallbackCopyToClipboard(shareUrl);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('Link copied to clipboard!\n\n' + text);
        } catch (err) {
            prompt('Copy this link:', text);
        }
        document.body.removeChild(textArea);
    }
    
    // Enhanced chart color generation
    getChartColors(count = 10) {
        const colors = [
            { backgroundColor: 'rgba(255, 0, 193, 0.8)', borderColor: '#ff00c1' },
            { backgroundColor: 'rgba(150, 0, 255, 0.8)', borderColor: '#9600ff' },
            { backgroundColor: 'rgba(0, 255, 249, 0.8)', borderColor: '#00fff9' },
            { backgroundColor: 'rgba(0, 184, 255, 0.8)', borderColor: '#00b8ff' },
            { backgroundColor: 'rgba(73, 0, 255, 0.8)', borderColor: '#4900ff' },
            { backgroundColor: 'rgba(255, 0, 193, 0.6)', borderColor: '#ff00c1' },
            { backgroundColor: 'rgba(150, 0, 255, 0.6)', borderColor: '#9600ff' },
            { backgroundColor: 'rgba(0, 255, 249, 0.6)', borderColor: '#00fff9' },
            { backgroundColor: 'rgba(0, 184, 255, 0.6)', borderColor: '#00b8ff' },
            { backgroundColor: 'rgba(73, 0, 255, 0.6)', borderColor: '#4900ff' }
        ];
        
        // Repeat colors if needed
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }
    
    // Show skeleton loading state
    showSkeletonLoading(elementId, type = 'chart') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const skeleton = document.createElement('div');
        skeleton.className = `skeleton-loading skeleton-${type}`;
        skeleton.innerHTML = type === 'chart' 
            ? '<div class="skeleton-chart"></div>'
            : '<div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text"></div>';
        
        element.innerHTML = '';
        element.appendChild(skeleton);
    }
    
    // Show empty state
    showEmptyState(elementId, message, icon = '📊') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-message">${message}</div>
        `;
        
        element.innerHTML = '';
        element.appendChild(emptyState);
    }
    
    // Create tooltip element
    createTooltip(text, position = 'top') {
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${position}`;
        tooltip.textContent = text;
        tooltip.setAttribute('role', 'tooltip');
        return tooltip;
    }
    
    // Add tooltip to element
    addTooltip(element, text, position = 'top') {
        if (!element) return;
        
        element.setAttribute('data-tooltip', text);
        element.setAttribute('aria-label', text);
        element.classList.add('has-tooltip');
        
        element.addEventListener('mouseenter', (e) => {
            const tooltip = this.createTooltip(text, position);
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let top, left;
            switch(position) {
                case 'top':
                    top = rect.top - tooltipRect.height - 8;
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = rect.bottom + 8;
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    left = rect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    left = rect.right + 8;
                    break;
                default:
                    top = rect.top - tooltipRect.height - 8;
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            }
            
            tooltip.style.top = `${top + window.scrollY}px`;
            tooltip.style.left = `${left + window.scrollX}px`;
        });
        
        element.addEventListener('mouseleave', () => {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) tooltip.remove();
        });
    }
    
    // Show error message
    showError(message, elementId = null) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.setAttribute('aria-live', 'assertive');
        errorDiv.innerHTML = `
            <div class="error-icon" aria-hidden="true">⚠️</div>
            <div class="error-text">${message}</div>
            <button class="error-close" aria-label="Close error message" onclick="this.parentElement.remove()">×</button>
        `;
        
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.appendChild(errorDiv);
            }
        } else {
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
        
        // Announce to screen readers
        this.announceToScreenReader(message);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    // Toggle high contrast mode
    toggleHighContrast() {
        const html = document.documentElement;
        const isHighContrast = html.getAttribute('data-theme') === 'high-contrast';
        const toggle = document.getElementById('high-contrast-toggle');
        
        if (isHighContrast) {
            // Restore previous theme
            const previousTheme = localStorage.getItem('theme') || 'light';
            html.setAttribute('data-theme', previousTheme);
            toggle.setAttribute('aria-pressed', 'false');
            localStorage.removeItem('highContrast');
        } else {
            // Save current theme and enable high contrast
            const currentTheme = html.getAttribute('data-theme') || 'light';
            localStorage.setItem('theme', currentTheme);
            html.setAttribute('data-theme', 'high-contrast');
            toggle.setAttribute('aria-pressed', 'true');
            localStorage.setItem('highContrast', 'true');
        }
        
        this.announceToScreenReader(isHighContrast ? 'High contrast mode disabled' : 'High contrast mode enabled');
    }
    
    // Setup keyboard navigation
    setupKeyboardNavigation() {
        // Define section mapping
        const sectionMap = {
            '1': 'overview',
            '2': 'leaderboard',
            '3': 'trends',
            '4': 'analytics',
            '5': 'rawdata'
        };
        
        const sections = ['overview', 'leaderboard', 'trends', 'analytics', 'rawdata'];
        
        // Arrow key navigation for sections
        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Number keys (1-5) for direct section navigation
            if (e.key >= '1' && e.key <= '5' && !e.altKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const section = sectionMap[e.key];
                if (section) {
                    this.showSection(section);
                    window.location.hash = section;
                    this.announceToScreenReader(`Navigated to ${section} section`);
                }
            }
            
            // Arrow keys for section navigation (without Alt for easier access)
            if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                const currentIndex = sections.indexOf(this.currentSection);
                
                if (e.key === 'ArrowRight' && currentIndex < sections.length - 1) {
                    e.preventDefault();
                    const nextSection = sections[currentIndex + 1];
                    this.showSection(nextSection);
                    window.location.hash = nextSection;
                    this.announceToScreenReader(`Navigated to ${nextSection} section`);
                } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    const prevSection = sections[currentIndex - 1];
                    this.showSection(prevSection);
                    window.location.hash = prevSection;
                    this.announceToScreenReader(`Navigated to ${prevSection} section`);
                }
            }
            
            // Alt + Arrow keys for section navigation (backward compatibility)
            if (e.altKey) {
                const currentIndex = sections.indexOf(this.currentSection);
                
                if (e.key === 'ArrowRight' && currentIndex < sections.length - 1) {
                    e.preventDefault();
                    const nextSection = sections[currentIndex + 1];
                    this.showSection(nextSection);
                    window.location.hash = nextSection;
                    this.announceToScreenReader(`Navigated to ${nextSection} section`);
                } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    const prevSection = sections[currentIndex - 1];
                    this.showSection(prevSection);
                    window.location.hash = prevSection;
                    this.announceToScreenReader(`Navigated to ${prevSection} section`);
                }
            }
            
            // Escape key to close modals/filters/help
            if (e.key === 'Escape') {
                const filtersContent = document.getElementById('filters-content');
                if (filtersContent && !filtersContent.classList.contains('hidden')) {
                    this.closeFilters();
                }
                
                const comparisonModal = document.getElementById('comparison-modal');
                if (comparisonModal && !comparisonModal.classList.contains('hidden')) {
                    this.closeComparisonModal();
                }
                
                const helpModal = document.getElementById('keyboard-shortcuts-modal');
                if (helpModal && !helpModal.classList.contains('hidden')) {
                    this.closeKeyboardShortcutsModal();
                }
            }
            
            // ? key or Alt + H for help modal
            if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.showKeyboardShortcutsModal();
            }
            
            // Alt + T for theme toggle
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) themeToggle.click();
            }
            
            // Alt + H for high contrast toggle (only if help modal not open)
            if (e.altKey && e.key === 'h') {
                const helpModal = document.getElementById('keyboard-shortcuts-modal');
                if (!helpModal || helpModal.classList.contains('hidden')) {
                    e.preventDefault();
                    const highContrastToggle = document.getElementById('high-contrast-toggle');
                    if (highContrastToggle) highContrastToggle.click();
                }
            }
        });
        
        // Tab navigation improvements
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }
    
    // Show keyboard shortcuts help modal
    showKeyboardShortcutsModal() {
        const modal = document.getElementById('keyboard-shortcuts-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            const firstButton = modal.querySelector('button');
            if (firstButton) firstButton.focus();
        }
    }
    
    // Close keyboard shortcuts help modal
    closeKeyboardShortcutsModal() {
        const modal = document.getElementById('keyboard-shortcuts-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    }
    
    // Announce to screen reader
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('aria-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }
    
    // Update ARIA current for navigation
    updateAriaCurrent() {
        document.querySelectorAll('.nav-item').forEach(item => {
            const section = item.dataset.section;
            if (section === this.currentSection) {
                item.setAttribute('aria-current', 'page');
                item.classList.add('active');
            } else {
                item.removeAttribute('aria-current');
                item.classList.remove('active');
            }
        });
    }
    
    // Advanced Visualizations
    
    createRadarChart() {
        const ctx = document.getElementById('radar-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        const playerSelect = document.getElementById('radar-player-select');
        
        if (!playerSelect) return;
        
        // Populate player select
        if (this.data && this.data.players) {
            playerSelect.innerHTML = '<option value="">Select Player...</option>';
            this.data.players.forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                playerSelect.appendChild(option);
            });
        }
        
        // Update chart when player is selected
        playerSelect.addEventListener('change', (e) => {
            const selectedPlayer = e.target.value;
            if (selectedPlayer) {
                this.updateRadarChart(selectedPlayer);
            } else {
                if (this.charts.radar) {
                    this.charts.radar.destroy();
                    this.charts.radar = null;
                }
            }
        });
    }
    
    updateRadarChart(playerName) {
        const ctx = document.getElementById('radar-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.radar) {
            this.charts.radar.destroy();
        }
        
        // Get player data
        const playerGames = this.data.games.filter(g => g.user === playerName);
        if (playerGames.length === 0) return;
        
        // Group by date to get unique games
        const gameScores = {};
        playerGames.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gameScores[key]) {
                gameScores[key] = {
                    date: game.date,
                    locationScores: []
                };
            }
            gameScores[key].locationScores.push(game.location_score);
        });
        
        const games = Object.values(gameScores);
        
        // Calculate average scores per location
        const locationAverages = [0, 0, 0, 0, 0];
        const locationCounts = [0, 0, 0, 0, 0];
        
        games.forEach(game => {
            game.locationScores.forEach((score, index) => {
                if (index < 5) {
                    locationAverages[index] += score;
                    locationCounts[index]++;
                }
            });
        });
        
        const avgScores = locationAverages.map((sum, i) => 
            locationCounts[i] > 0 ? Math.round(sum / locationCounts[i]) : 0
        );
        
        // Calculate other metrics
        const totalScores = games.map(g => {
            return g.locationScores.reduce((a, b) => a + b, 0);
        });
        const avgTotalScore = totalScores.length > 0 
            ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length)
            : 0;
        const consistency = totalScores.length > 1 ? this.calculateStdDev(totalScores) : 0;
        
        // Normalize scores to 0-100 scale for radar chart
        const normalizeScore = (score, max = 100) => Math.min(100, (score / max) * 100);
        
        const labels = [
            'Location 1',
            'Location 2', 
            'Location 3',
            'Location 4',
            'Location 5',
            'Avg Score',
            'Consistency'
        ];
        
        const data = [
            ...avgScores.map(s => normalizeScore(s, 100)),
            normalizeScore(avgTotalScore / 5, 100), // Average per location
            normalizeScore(100 - consistency, 100) // Consistency (inverted, higher is better)
        ];
        
        this.charts.radar = new Chart(ctx2d, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: playerName,
                    data: data,
                    backgroundColor: 'rgba(255, 0, 193, 0.2)',
                    borderColor: '#ff00c1',
                    borderWidth: 2,
                    pointBackgroundColor: '#ff00c1',
                    pointBorderColor: '#9600ff',
                    pointHoverBackgroundColor: '#9600ff',
                    pointHoverBorderColor: '#ff00c1',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                if (index < 5) {
                                    return `Location ${index + 1}: ${avgScores[index]}`;
                                } else if (index === 5) {
                                    return `Avg Score: ${avgTotalScore}`;
                                } else {
                                    return `Consistency: ${Math.round(100 - consistency)}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.2)'
                        },
                        pointLabels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            }
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 10
                            },
                            stepSize: 20
                        }
                    }
                }
            }
        });
    }
    
    createBoxPlotChart(games = this.data.games) {
        const ctx = document.getElementById('box-plot-chart');
        if (!ctx) return;
        
        const ctx2d = ctx.getContext('2d');
        
        if (this.charts.boxPlot) {
            this.charts.boxPlot.destroy();
        }
        
        // Group games by player-date to get unique game scores
        const playerScores = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!playerScores[key]) {
                playerScores[key] = {
                    user: game.user,
                    date: game.date,
                    totalScore: game.total_score
                };
            }
        });
        
        // Group scores by player
        const scoresByPlayer = {};
        Object.values(playerScores).forEach(game => {
            if (!scoresByPlayer[game.user]) {
                scoresByPlayer[game.user] = [];
            }
            scoresByPlayer[game.user].push(game.totalScore);
        });
        
        // Calculate box plot statistics for each player
        const boxPlotData = [];
        const labels = [];
        
        Object.entries(scoresByPlayer)
            .filter(([player, scores]) => scores.length >= 5) // Need at least 5 data points
            .sort((a, b) => {
                const avgA = a[1].reduce((sum, s) => sum + s, 0) / a[1].length;
                const avgB = b[1].reduce((sum, s) => sum + s, 0) / b[1].length;
                return avgB - avgA;
            })
            .slice(0, 10) // Top 10 players
            .forEach(([player, scores]) => {
                scores.sort((a, b) => a - b);
                const q1 = this.percentile(scores, 25);
                const median = this.percentile(scores, 50);
                const q3 = this.percentile(scores, 75);
                const min = Math.min(...scores);
                const max = Math.max(...scores);
                const iqr = q3 - q1;
                const lowerWhisker = Math.max(min, q1 - 1.5 * iqr);
                const upperWhisker = Math.min(max, q3 + 1.5 * iqr);
                
                labels.push(player);
                boxPlotData.push({
                    min: lowerWhisker,
                    q1: q1,
                    median: median,
                    q3: q3,
                    max: upperWhisker,
                    outliers: scores.filter(s => s < lowerWhisker || s > upperWhisker)
                });
            });
        
        if (labels.length === 0) {
            ctx2d.clearRect(0, 0, ctx.width, ctx.height);
            ctx2d.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
            ctx2d.font = '12px Courier New';
            ctx2d.fillText('Not enough data for box plot', 10, 20);
            return;
        }
        
        // Create box plot using bar chart with custom styling
        const datasets = [];
        const chartColors = this.getChartColors(labels.length);
        
        labels.forEach((label, index) => {
            const data = boxPlotData[index];
            datasets.push({
                label: label,
                data: [data.median],
                backgroundColor: chartColors[index].backgroundColor,
                borderColor: chartColors[index].borderColor,
                borderWidth: 2
            });
        });
        
        this.charts.boxPlot = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1.5,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#00fff9',
                        bodyColor: '#ff00c1',
                        borderColor: '#00fff9',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const data = boxPlotData[index];
                                return [
                                    `Min: ${data.min}`,
                                    `Q1: ${data.q1}`,
                                    `Median: ${data.median}`,
                                    `Q3: ${data.q3}`,
                                    `Max: ${data.max}`,
                                    data.outliers.length > 0 ? `Outliers: ${data.outliers.length}` : ''
                                ].filter(Boolean);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 255, 249, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            font: {
                                family: 'Courier New, monospace',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                }
            }
        });
        
        // Draw box plot elements manually on canvas
        setTimeout(() => {
            this.drawBoxPlotElements(ctx2d, boxPlotData, labels);
        }, 100);
    }
    
    drawBoxPlotElements(ctx, boxPlotData, labels) {
        const chart = this.charts.boxPlot;
        if (!chart) return;
        
        const meta = chart.getDatasetMeta(0);
        const scale = chart.scales.y;
        
        boxPlotData.forEach((data, index) => {
            const bar = meta.data[index];
            if (!bar) return;
            
            const x = bar.x;
            const boxWidth = 30;
            const whiskerWidth = 10;
            
            // Draw median line
            ctx.strokeStyle = '#00fff9';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - boxWidth / 2, scale.getPixelForValue(data.median));
            ctx.lineTo(x + boxWidth / 2, scale.getPixelForValue(data.median));
            ctx.stroke();
            
            // Draw box (Q1 to Q3)
            ctx.strokeStyle = '#ff00c1';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                x - boxWidth / 2,
                scale.getPixelForValue(data.q3),
                boxWidth,
                scale.getPixelForValue(data.q1) - scale.getPixelForValue(data.q3)
            );
            
            // Draw whiskers
            ctx.strokeStyle = '#9600ff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, scale.getPixelForValue(data.q3));
            ctx.lineTo(x, scale.getPixelForValue(data.max));
            ctx.moveTo(x - whiskerWidth / 2, scale.getPixelForValue(data.max));
            ctx.lineTo(x + whiskerWidth / 2, scale.getPixelForValue(data.max));
            ctx.moveTo(x, scale.getPixelForValue(data.q1));
            ctx.lineTo(x, scale.getPixelForValue(data.min));
            ctx.moveTo(x - whiskerWidth / 2, scale.getPixelForValue(data.min));
            ctx.lineTo(x + whiskerWidth / 2, scale.getPixelForValue(data.min));
            ctx.stroke();
        });
    }
    
    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        const index = (p / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }
    
    calculateStdDev(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    createCorrelationMatrix(games = this.data.games) {
        const container = document.getElementById('correlation-matrix');
        if (!container) return;
        
        // Group games by user-date
        const gameScores = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gameScores[key]) {
                gameScores[key] = {
                    user: game.user,
                    date: game.date,
                    locationScores: [],
                    totalScore: 0
                };
            }
            gameScores[key].locationScores.push(game.location_score);
            gameScores[key].totalScore = game.total_score;
        });
        
        const gamesList = Object.values(gameScores);
        
        // Calculate correlations between locations
        const correlations = [];
        const locations = ['Location 1', 'Location 2', 'Location 3', 'Location 4', 'Location 5'];
        
        for (let i = 0; i < 5; i++) {
            for (let j = i + 1; j < 5; j++) {
                const scoresI = gamesList.map(g => g.locationScores[i] || 0);
                const scoresJ = gamesList.map(g => g.locationScores[j] || 0);
                const correlation = this.calculateCorrelation(scoresI, scoresJ);
                
                correlations.push({
                    loc1: i,
                    loc2: j,
                    correlation: correlation,
                    label1: locations[i],
                    label2: locations[j]
                });
            }
        }
        
        // Sort by absolute correlation
        correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
        
        container.innerHTML = '';
        
        // Display top correlations
        const topCorrelations = correlations.slice(0, 6);
        topCorrelations.forEach(corr => {
            const card = document.createElement('div');
            card.className = 'correlation-card';
            const strength = Math.abs(corr.correlation);
            const strengthText = strength > 0.7 ? 'Strong' : strength > 0.4 ? 'Moderate' : 'Weak';
            const direction = corr.correlation > 0 ? 'positive' : 'negative';
            
            card.innerHTML = `
                <div class="correlation-pair">
                    <span>${corr.label1}</span>
                    <span class="correlation-arrow">↔</span>
                    <span>${corr.label2}</span>
                </div>
                <div class="correlation-value ${direction}">
                    ${(corr.correlation * 100).toFixed(1)}%
                </div>
                <div class="correlation-strength">${strengthText} ${direction}</div>
            `;
            
            container.appendChild(card);
        });
    }
    
    calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) return 0;
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        
        if (denominator === 0) return 0;
        return numerator / denominator;
    }
    
    createCalendarHeatmap(games = this.data.games) {
        const container = document.getElementById('calendar-heatmap');
        if (!container) return;
        
        // Group games by date
        const gamesByDate = {};
        games.forEach(game => {
            const key = `${game.user}-${game.date}`;
            if (!gamesByDate[game.date]) {
                gamesByDate[game.date] = new Set();
            }
            gamesByDate[game.date].add(game.user);
        });
        
        // Get date range
        const dates = Object.keys(gamesByDate).sort();
        if (dates.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No data available</p>';
            return;
        }
        
        const startDate = new Date(dates[0] + 'T00:00:00');
        const endDate = new Date(dates[dates.length - 1] + 'T00:00:00');
        
        // Create calendar grid
        container.innerHTML = '';
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-heatmap-grid';
        
        // Find max games per day for normalization
        const maxGamesPerDay = Math.max(...Object.values(gamesByDate).map(s => s.size));
        
        // Generate calendar cells
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayGames = gamesByDate[dateStr] || new Set();
            const gameCount = dayGames.size;
            const intensity = maxGamesPerDay > 0 ? gameCount / maxGamesPerDay : 0;
            
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.setAttribute('data-date', dateStr);
            cell.setAttribute('data-count', gameCount);
            cell.setAttribute('title', `${dateStr}: ${gameCount} game${gameCount !== 1 ? 's' : ''}`);
            
            // Color intensity based on game count
            if (intensity === 0) {
                cell.style.backgroundColor = 'var(--bg-tertiary)';
            } else if (intensity < 0.25) {
                cell.style.backgroundColor = 'rgba(0, 184, 255, 0.3)';
            } else if (intensity < 0.5) {
                cell.style.backgroundColor = 'rgba(0, 184, 255, 0.6)';
            } else if (intensity < 0.75) {
                cell.style.backgroundColor = 'rgba(150, 0, 255, 0.6)';
            } else {
                cell.style.backgroundColor = 'rgba(255, 0, 193, 0.8)';
            }
            
            cell.style.border = '1px solid var(--border-color)';
            
            // Add date label (first day of month)
            const [year, month, day] = dateStr.split('-');
            if (parseInt(day) === 1) {
                cell.innerHTML = `<div class="heatmap-month-label">${new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short' })}</div>`;
            }
            
            calendarGrid.appendChild(cell);
        }
        
        container.appendChild(calendarGrid);
        
        // Add legend
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <div class="legend-label">Less</div>
            <div class="legend-cells">
                <div class="legend-cell" style="background-color: var(--bg-tertiary);"></div>
                <div class="legend-cell" style="background-color: rgba(0, 184, 255, 0.3);"></div>
                <div class="legend-cell" style="background-color: rgba(0, 184, 255, 0.6);"></div>
                <div class="legend-cell" style="background-color: rgba(150, 0, 255, 0.6);"></div>
                <div class="legend-cell" style="background-color: rgba(255, 0, 193, 0.8);"></div>
            </div>
            <div class="legend-label">More</div>
        `;
        container.appendChild(legend);
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    const highContrast = localStorage.getItem('highContrast') === 'true';
    
    if (highContrast) {
        document.documentElement.setAttribute('data-theme', 'high-contrast');
        const toggle = document.getElementById('high-contrast-toggle');
        if (toggle) toggle.setAttribute('aria-pressed', 'true');
    } else {
    document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    const themeIcon = document.querySelector('.theme-icon');
    const themeLabel = document.getElementById('theme-label');
    
    if (themeIcon && themeLabel) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeLabel.textContent = savedTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    
    // Initialize dashboard
    new MaptapDashboard();
});
