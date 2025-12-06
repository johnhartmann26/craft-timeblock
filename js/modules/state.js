export const State = {
    // Constants
    STORAGE_KEY: 'craft-timeblock-api',
    ZOOM_KEY: 'craft-timeblock-zoom',
    SIDEBAR_KEY: 'craft-timeblock-sidebar-collapsed',
    
    // Viewport Settings
    hoursVisible: 8, // Default to a standard workday view
    
    // Dynamic Metrics (Calculated by UI based on window height)
    HOUR_HEIGHT: 60, 

    // Runtime Data
    apiUrl: '',
    currentDate: new Date(),
    scheduledBlocks: [],
    unscheduledBlocks: [],
    
    // UI State
    isSidebarCollapsed: false,
    hoveredBlock: null,
    hoveredUnscheduledItem: null,

    // The timeline now always covers the full 24h day
    get startHour() { return 0; },
    get endHour() { return 24; },
    get totalHours() { return 24; },

    loadSettings() {
        this.apiUrl = localStorage.getItem(this.STORAGE_KEY) || '';

        const savedZoom = localStorage.getItem(this.ZOOM_KEY);
        if (savedZoom) {
            this.hoursVisible = parseInt(savedZoom, 10);
        }

        this.isSidebarCollapsed = localStorage.getItem(this.SIDEBAR_KEY) === 'true';
    },

    saveZoomSetting(hours) {
        this.hoursVisible = hours;
        localStorage.setItem(this.ZOOM_KEY, hours);
    },

    saveApiUrl(url) {
        this.apiUrl = url;
        localStorage.setItem(this.STORAGE_KEY, url);
    },

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        localStorage.setItem(this.SIDEBAR_KEY, this.isSidebarCollapsed);
        return this.isSidebarCollapsed;
    }
};