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
        
        // Enhanced Filters
        // Player search (fuzzy matching) - debounced
        document.getElementById('player-search').addEventListener('input', (e) => {
            this.currentFilters.searchQuery = e.target.value.toLowerCase();
            this.filterPlayerOptions();
            this.debounceApplyFilters();
        });
        
        // Multi-select player filter
        document.getElementById('player-filter').addEventListener('change', (e) => {
            const selected = Array.from(e.target.selectedOptions).map(opt => opt.value).filter(v => v);
            this.currentFilters.players = selected;
            this.applyFilters();
        });
        
        // Date range picker
        document.getElementById('date-range-start').addEventListener('change', (e) => {
            this.currentFilters.dateRangeStart = e.target.value;
            this.currentFilters.date = ''; // Clear quick date when using range
            document.getElementById('date-filter').value = '';
            this.applyFilters();
        });
        
        document.getElementById('date-range-end').addEventListener('change', (e) => {
            this.currentFilters.dateRangeEnd = e.target.value;
            this.currentFilters.date = ''; // Clear quick date when using range
            document.getElementById('date-filter').value = '';
            this.applyFilters();
        });
        
        // Quick date filter
        document.getElementById('date-filter').addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
            // Clear date range when using quick date
            if (e.target.value) {
                this.currentFilters.dateRangeStart = '';
                this.currentFilters.dateRangeEnd = '';
                document.getElementById('date-range-start').value = '';
                document.getElementById('date-range-end').value = '';
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
        
        // Score range filter - debounced
        document.getElementById('score-range-min').addEventListener('input', (e) => {
            this.currentFilters.scoreMin = e.target.value ? parseInt(e.target.value) : '';
            this.debounceApplyFilters();
        });
        
        document.getElementById('score-range-max').addEventListener('input', (e) => {
            this.currentFilters.scoreMax = e.target.value ? parseInt(e.target.value) : '';
            this.debounceApplyFilters();
        });
        
        // Sort filter
        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.updateLeaderboardSortIndicator();
            this.applyFilters();
        });
        
        // Clear filters button
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });
        
        // Save filter preset
        document.getElementById('save-filter-preset').addEventListener('click', () => {
            this.saveFilterPreset();
        });
        
        // Load filter preset
        document.getElementById('filter-presets').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadFilterPreset(e.target.value);
            }
        });
        
        // Raw data controls
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportCSV();
        });
        
        document.getElementById('export-filtered-csv').addEventListener('click', () => {
            this.exportFilteredCSV();
        });
        
        document.getElementById('refresh-data').addEventListener('click', () => {
            this.loadData();
        });
        
        // Export chart buttons
        document.getElementById('export-leaderboard-chart').addEventListener('click', () => {
            this.exportChart('leaderboard');
        });
        
        document.getElementById('export-trends-chart').addEventListener('click', () => {
            this.exportChart('trends');
        });
        
        document.getElementById('export-all-charts').addEventListener('click', () => {
            this.exportAllCharts();
        });
        
        // Share link buttons
        document.getElementById('share-leaderboard-link').addEventListener('click', () => {
            this.shareLink('leaderboard');
        });
        
        document.getElementById('share-trends-link').addEventListener('click', () => {
            this.shareLink('trends');
        });
        
        document.getElementById('share-analytics-link').addEventListener('click', () => {
            this.shareLink('analytics');
        });
        
        document.getElementById('share-rawdata-link').addEventListener('click', () => {
            this.shareLink('rawdata');
        });
        
        // Pagination controls
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateRawDataTable();
            }
        });
        
        document.getElementById('next-page').addEventListener('click', () => {
            const dataToUse = this.filteredData || this.data;
            const totalPages = Math.ceil(dataToUse.games.length / this.rowsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updateRawDataTable();
            }
        });
        
        document.getElementById('rows-per-page').addEventListener('change', (e) => {
            this.rowsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.updateRawDataTable();
        });
        
        // Intersection Observer for lazy loading charts
        this.setupLazyChartLoading();
        
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
        
        // Comparison feature event listeners
        document.getElementById('compare-players-btn').addEventListener('click', () => {
            this.openComparisonModal();
        });
        
        document.getElementById('comparison-modal-close').addEventListener('click', () => {
            this.closeComparisonModal();
        });
        
        document.getElementById('cancel-comparison').addEventListener('click', () => {
            this.closeComparisonModal();
        });
        
        document.getElementById('apply-comparison').addEventListener('click', () => {
            this.applyComparison();
        });
        
        document.getElementById('clear-comparison').addEventListener('click', () => {
            this.clearComparison();
        });
        
        // Time-based aggregation event listeners
        document.getElementById('period-selector').addEventListener('change', (e) => {
            this.currentPeriod = e.target.value;
            this.updateTrends();
        });
        
        document.getElementById('show-rolling-average').addEventListener('change', (e) => {
            this.showRollingAverage = e.target.checked;
            this.createTrendsChart();
        });
        
        document.getElementById('last-7-days').addEventListener('click', () => {
            this.setDateRange(7);
        });
        
        document.getElementById('last-30-days').addEventListener('click', () => {
            this.setDateRange(30);
        });
        
        // Player profile navigation
        document.getElementById('back-to-leaderboard').addEventListener('click', () => {
            this.showSection('leaderboard');
            window.location.hash = 'leaderboard';
            document.getElementById('profile-nav-item').classList.add('hidden');
        });
        
        // Make player names clickable in leaderboard
        setTimeout(() => {
            this.makePlayerNamesClickable();
        }, 1000);
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
        document.getElementById('date-filter').value = '';
        this.currentPeriod = 'day';
        document.getElementById('period-selector').value = 'day';
        
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
        document.getElementById(sectionName).classList.add('active');
        
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
                <div class="profile-stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${playerData.highestScore}</div>
                    <div class="stat-label">Highest Score</div>
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
        `;
        
        // Render performance calendar
        this.renderPerformanceCalendar(playerData);
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
        // For overview page, use overall stats (unfiltered data) for most widgets
        // except daily winner/loser which should use current day's data
        
        // Update overall stats using unfiltered data
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
        
        // Update daily winner and loser using current day's data
        this.updateDailyWinnerLoser(this.data.games);
        
        // Update overall stats using unfiltered data
        this.updateOverallStats(this.data.games);
        
        // Update streaks
        this.updateStreaks();
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
    
    async     updateTrends() {
        // Only create chart if section is visible or already loaded
        if (this.currentSection !== 'trends' && !this.chartsLoaded.has('trends')) {
            return;
        }
        
        // If period is 'day', use existing logic
        if (this.currentPeriod === 'day') {
            const dataToUse = this.filteredData || this.data;
            const trends = this.calculateTrends(dataToUse.games);
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
        } else {
            // Fetch aggregated data for other periods
            await this.updateTrendsWithAggregation();
        }
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
                    players: new Set()
                };
            }
            periodTotals[agg.period].totalScore += agg.totalScore;
            periodTotals[agg.period].totalGames += agg.gamesPlayed;
            periodTotals[agg.period].players.add(agg.user);
        });
        
        // Create summary cards
        Object.values(periodTotals).forEach(period => {
            const card = document.createElement('div');
            card.className = 'period-summary-card';
            const avgScore = Math.round(period.totalScore / period.totalGames);
            
            card.innerHTML = `
                <div class="period-label">${period.period}</div>
                <div class="period-value">${avgScore}</div>
                <div class="period-details">Avg Score</div>
                <div class="period-details">${period.totalGames} games • ${period.players.size} players</div>
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
            
            // Create streak display
            let streakDisplay = '-';
            if (currentStreak > 0) {
                streakDisplay = `<span style="color: var(--accent-primary); font-weight: bold;">🔥 ${currentStreak}</span>`;
            } else if (longestStreak > 0) {
                streakDisplay = `<span style="color: var(--text-muted);">🏆 ${longestStreak}</span>`;
            }
            
            // Make player name clickable
            const playerNameCell = `<td><strong><a href="#" class="player-link" data-player="${player.user}">${player.user}</a></strong></td>`;
            
            row.innerHTML = `
                <td>${index + 1}</td>
                ${playerNameCell}
                <td>${player.totalScore.toLocaleString()}</td>
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
        const colors = ['#ff00c1', '#9600ff', '#4900ff', '#00b8ff', '#00fff9', '#ff00c1', '#9600ff'];
        
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
                    fill: false,
                    pointRadius: 3
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
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#00fff9',
                            font: {
                                family: 'Courier New',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
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
                        if (score >= 80) return '#00fff9';
                        if (score >= 60) return '#00b8ff';
                        if (score >= 40) return '#9600ff';
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
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            color: '#00fff9'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            color: '#00fff9'
                        }
                    }
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
