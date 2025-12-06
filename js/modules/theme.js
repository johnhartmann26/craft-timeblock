export const Theme = {
    THEME_KEY: 'craft-timeblock-theme',

    init() {
        this.setTheme(this.getPreferredTheme());
        this.setupListeners();
    },

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    getPreferredTheme() {
        return localStorage.getItem(this.THEME_KEY) || 'system';
    },

    setTheme(preference) {
        if (preference === 'system') localStorage.removeItem(this.THEME_KEY);
        else localStorage.setItem(this.THEME_KEY, preference);

        const visualTheme = preference === 'system' ? this.getSystemTheme() : preference;
        document.documentElement.setAttribute('data-theme', visualTheme);
        
        // Update Buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === preference) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    },

    setupListeners() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.getPreferredTheme() === 'system') this.setTheme('system');
        });

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });
    }
};