export const State = {
    // Constants
    STORAGE_KEY: 'craft-timeblock-api',
    TIME_SETTINGS_KEY: 'craft-timeblock-times',
    SIDEBAR_KEY: 'craft-timeblock-sidebar-collapsed',
    HOUR_HEIGHT: 60, // pixels per hour

    // Config (Defaults)
    startHour: 6,
    endHour: 22,
    
    // Runtime Data
    apiUrl: '',
    currentDate: new Date(),
    scheduledBlocks: [],
    unscheduledBlocks: [],
    
    // UI State
    isSidebarCollapsed: false,
    hoveredBlock: null,
    hoveredUnscheduledItem: null,

    get totalHours() {
        return this.endHour - this.startHour;
    },

    loadSettings() {
        this.apiUrl = localStorage.getItem(this.STORAGE_KEY) || '';

        const timeSettings = localStorage.getItem(this.TIME_SETTINGS_KEY);
        if (timeSettings) {
            try {
                const { start, end } = JSON.parse(timeSettings);
                this.startHour = start;
                this.endHour = end;
            } catch (e) {
                console.warn('Failed to parse time settings', e);
                // Fallback to defaults
            }
        }

        this.isSidebarCollapsed = localStorage.getItem(this.SIDEBAR_KEY) === 'true';
    },

    saveTimeSettings(start, end) {
        this.startHour = start;
        this.endHour = end;
        localStorage.setItem(this.TIME_SETTINGS_KEY, JSON.stringify({ start, end }));
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