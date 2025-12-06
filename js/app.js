import { State } from './modules/state.js';
import { API } from './modules/api.js';
import { UI } from './modules/ui.js';
import { Utils } from './modules/utils.js';
import { Interactions } from './modules/interactions.js';
import { Theme } from './modules/theme.js';

let isFirstLoad = true; // Track if this is the initial boot-up

// 1. ROBUST STARTUP LOGIC
const startApp = () => {
    console.log("Initializing App...");
    try {
        init();
    } catch (e) {
        console.error("Critical initialization error:", e);
        alert("App failed to start: " + e.message);
    }
};

// Check if the DOM is already ready (fixing the race condition)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function init() {
    Theme.init();
    UI.init();
    
    // Pass the refresh function to interactions
    Interactions.init(() => loadSchedule(false)); // Manual refresh (false = potentially show loading screen)
    
    State.loadSettings();
    // Populate Zoom options
    UI.populateZoomSelect();

    // Check if we have a saved URL, otherwise show setup
    if (State.apiUrl) {
        UI.showApp();
        loadSchedule(false); // Initial load
    } else {
        UI.showSetup();
    }

    setupGlobalEventListeners();
    setupAutoRefresh(); // Start the polling
}

function setupGlobalEventListeners() {
    // Navigation
    const prevBtn = document.getElementById('prev-day-btn');
    if(prevBtn) prevBtn.addEventListener('click', () => changeDay(-1));
    
    const nextBtn = document.getElementById('next-day-btn');
    if(nextBtn) nextBtn.addEventListener('click', () => changeDay(1));
    
    // Actions
    const refreshBtn = document.getElementById('refresh-btn');
    if(refreshBtn) refreshBtn.addEventListener('click', () => loadSchedule(false));
    
    const retryBtn = document.getElementById('retry-btn');
    if(retryBtn) retryBtn.addEventListener('click', () => loadSchedule(false));
    
    // Sidebar
    const sidebarBtn = document.getElementById('sidebar-toggle-btn');
    if(sidebarBtn) sidebarBtn.addEventListener('click', () => {
        State.toggleSidebar();
        UI.applySidebarState();
    });

    // Settings
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    if(settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            document.getElementById('settings-api-url').value = State.apiUrl;
            settingsModal.classList.remove('hidden');
        });
        settingsModal.addEventListener('click', e => {
            if(e.target === settingsModal) settingsModal.classList.add('hidden');
        });
    }
    
    // Zoom Settings Change
    const zoomSelect = document.getElementById('settings-zoom-level');
    if (zoomSelect) {
        zoomSelect.addEventListener('change', e => {
            const hours = parseInt(e.target.value, 10);
            State.saveZoomSetting(hours);
            
            // Recalculate and Render
            UI.recalcViewport(); 
            UI.renderTimeAxis(); 
            UI.renderTimeline(State.scheduledBlocks);
            Interactions.setupBlockInteractions(); 
            
            // Snap to Upper Third
            UI.scrollToNow();
        });
    }

    const settingsUrl = document.getElementById('settings-api-url');
    if(settingsUrl) {
        settingsUrl.addEventListener('change', e => {
            State.saveApiUrl(Utils.normalizeApiUrl(e.target.value));
            loadSchedule(false);
        });
    }

    // Setup Form
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const input = document.getElementById('api-url');
            const url = Utils.normalizeApiUrl(input.value.trim());
            if(!url) return;
            
            try {
                State.saveApiUrl(url);
                UI.showApp();
                loadSchedule(false);
            } catch(err) {
                 console.error("Setup error:", err);
                 const setupError = document.getElementById('setup-error');
                 if(setupError) {
                    setupError.textContent = err.message;
                    setupError.classList.remove('hidden');
                 }
            }
        });
    }

    // --- FIX FOR REFRESH LOOP ---
    // Prevent layout thrashing by ignoring small vertical changes (mobile address bar)
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // Only trigger update if width changes (orientation/desktop resize)
        // OR if height changes significantly (>60px), ruling out address bar toggles
        const widthChanged = newWidth !== lastWidth;
        const heightChanged = Math.abs(newHeight - lastHeight) > 60;

        if (!widthChanged && !heightChanged) return;

        lastWidth = newWidth;
        lastHeight = newHeight;

        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(() => {
            if (State.scheduledBlocks.length > 0) {
                UI.recalcViewport();
                UI.renderTimeAxis();
                UI.renderTimeline(State.scheduledBlocks);
                Interactions.setupBlockInteractions();
            }
        }, 100);
    });
}

// Auto Refresh Logic
function setupAutoRefresh() {
    // Refresh every 2 minutes
    setInterval(() => {
        // SAFETY CHECK: Do not refresh if user is interacting
        const isInteracting = document.querySelector('.dragging, .resizing, .editing');
        const isSettingsOpen = !document.getElementById('settings-modal').classList.contains('hidden');

        if (!isInteracting && !isSettingsOpen) {
            console.log("Auto-syncing...");
            loadSchedule(true); // true = Background Sync
        } else {
            console.log("Skipping auto-sync due to user interaction");
        }
    }, 120 * 1000); 
}

function changeDay(delta) {
    State.currentDate.setDate(State.currentDate.getDate() + delta);
    UI.updateDateTitle();
    // Changing day IS a major navigation, so we behave like a first load (show spinner/scroll)
    isFirstLoad = true; 
    loadSchedule(false);
}

// MODIFIED: Intelligent Loading State
export async function loadSchedule(isBackground = false) {
    // 1. Determine UX Mode
    // "Blocking Mode" (Spinner) only on very first load or day change
    // "Status Mode" (Non-blocking) for manual refreshes and auto-sync
    const showBlockingLoader = isFirstLoad && !isBackground;

    if (showBlockingLoader) {
        UI.showLoading();
    } else {
        UI.showSyncStatus('saving', 'Syncing...');
    }

    try {
        const data = await API.fetchSchedule();
        const { scheduled, unscheduledItems } = Utils.parseBlocks(data);
        
        State.scheduledBlocks = scheduled;
        State.unscheduledBlocks = unscheduledItems;

        UI.renderTimeline(scheduled);
        UI.renderUnscheduled(unscheduledItems);
        Interactions.setupBlockInteractions();
        
        if (showBlockingLoader) {
            // Transition from Loading Screen -> App
            const loading = document.getElementById('loading');
            const container = document.getElementById('timeline-container');
            if(loading) loading.classList.add('hidden');
            if(container) container.classList.remove('hidden');
            
            // Only scroll to "Now" on first launch/day change
            UI.scrollToNow();
            isFirstLoad = false;
        } else {
            // For manual/auto refresh, just show success.
            // WE DO NOT call scrollToNow() here, ensuring the view does not jump.
            UI.showSyncStatus('saved', 'Synced');
        }
    } catch (err) {
        console.error("Load Schedule Error:", err);
        if (showBlockingLoader) {
            UI.showError(err.message);
        } else {
            UI.showSyncStatus('error', 'Sync failed');
        }
    }
}