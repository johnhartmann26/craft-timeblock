/* =========================================================
   THEME LOGIC
   ========================================================= */

const THEME_KEY = 'craft-timeblock-theme';

// 1. HELPER: Check what the OS currently wants (Dark or Light)
function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 2. HELPER: Get the user's stored preference ('dark', 'light', or 'system')
function getPreferredTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
}

// 3. CORE: Set the theme
function setTheme(preference) {
    // A. Manage Storage
    // If 'system' is chosen, we remove the override so it falls back to the OS
    if (preference === 'system') {
        localStorage.removeItem(THEME_KEY);
    } else {
        localStorage.setItem(THEME_KEY, preference);
    }

    // B. Determine Visuals
    // If preference is system, ask the OS. Otherwise, use the preference.
    const visualTheme = preference === 'system' ? getSystemTheme() : preference;
    
    // C. Apply to DOM
    document.documentElement.setAttribute('data-theme', visualTheme);

    // D. Update Buttons (Visual Feedback)
    const btns = document.querySelectorAll('.theme-btn');
    btns.forEach(btn => {
        const btnType = btn.dataset.theme;
        if (btnType === preference) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 4. INITIALIZE: Run immediately
setTheme(getPreferredTheme());

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

// A. Watch for System Changes (e.g., Sunset/Sunrise)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only update automatically if the user hasn't locked a preference
    if (getPreferredTheme() === 'system') {
        // We re-call setTheme('system') to recalculate the visualTheme
        setTheme('system'); 
    }
});

// B. Watch for Button Clicks
document.addEventListener('DOMContentLoaded', () => {
    // Ensure buttons highlight correctly after HTML loads
    setTheme(getPreferredTheme());

    const btns = document.querySelectorAll('.theme-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });
});