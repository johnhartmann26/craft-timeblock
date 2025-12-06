import { State } from './state.js';
import { Utils } from './utils.js';

export const UI = {
    elements: {},
    nowLineInterval: null,

    init() {
        const ids = [
            'setup-screen', 'setup-form', 'api-url', 'setup-error',
            'app', 'date-title', 'loading', 'error-state', 'error-message',
            'timeline-container', 'time-axis', 'timeline-track',
            'unscheduled', 'unscheduled-list', 'done', 'done-list',
            'settings-modal', 'sidebar-toggle-btn', 'sidebar-badge',
            'unscheduled-section-badge', 'done-section-badge', 'sync-status',
            'settings-api-url', 'settings-start-hour', 'settings-end-hour'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    },

    populateTimeSelects() {
        const startSel = this.elements['settings-start-hour'];
        const endSel = this.elements['settings-end-hour'];
        if (!startSel) return;

        // Clear existing to avoid duplicates if re-initialized
        startSel.innerHTML = '';
        endSel.innerHTML = '';

        for (let h = 0; h <= 23; h++) {
            const label = Utils.formatHourLabel(h);
            const s = document.createElement('option'); s.value = h; s.textContent = label;
            const e = document.createElement('option'); e.value = h; e.textContent = label;
            startSel.appendChild(s);
            endSel.appendChild(e);
        }
        startSel.value = State.startHour;
        endSel.value = State.endHour;
    },
    
    // ... [Rest of UI.js remains exactly the same as previous response] ...
    
    showSetup() {
        this.elements['setup-screen'].classList.remove('hidden');
        this.elements['app'].classList.add('hidden');
    },

    showApp() {
        this.elements['setup-screen'].classList.add('hidden');
        this.elements['app'].classList.remove('hidden');
        this.updateDateTitle();
        this.updateTimelineHeight();
        this.renderTimeAxis();
        this.applySidebarState();
    },

    showLoading() {
        this.elements['loading'].classList.remove('hidden');
        this.elements['error-state'].classList.add('hidden');
        this.elements['timeline-container'].classList.add('hidden');
    },

    showError(message) {
        this.elements['loading'].classList.add('hidden');
        this.elements['timeline-container'].classList.add('hidden');
        this.elements['error-message'].textContent = message;
        this.elements['error-state'].classList.remove('hidden');
    },

    updateDateTitle() {
        this.elements['date-title'].textContent = Utils.formatDateTitle(State.currentDate);
    },

    updateTimelineHeight() {
        this.elements['timeline-track'].style.minHeight = `${State.totalHours * State.HOUR_HEIGHT}px`;
    },

    renderTimeAxis() {
        const axis = this.elements['time-axis'];
        axis.innerHTML = '';
        for (let hour = State.startHour; hour <= State.endHour; hour++) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.style.top = `${(hour - State.startHour) * State.HOUR_HEIGHT}px`;
            label.textContent = Utils.formatHourLabel(hour);
            axis.appendChild(label);
        }
    },

    renderTimeline(blocks) {
        const track = this.elements['timeline-track'];
        track.querySelectorAll('.timeblock, .hour-line, .now-line').forEach(el => el.remove());

        for (let hour = State.startHour; hour <= State.endHour; hour++) {
            const line = document.createElement('div');
            line.className = 'hour-line';
            line.style.top = `${(hour - State.startHour) * State.HOUR_HEIGHT}px`;
            track.appendChild(line);
        }

        const now = this.getCurrentTimeDecimal();

        blocks.forEach((block, index) => {
            const el = document.createElement('div');
            el.className = `timeblock ${block.category}`;
            el.dataset.blockIndex = index;
            if (block.id) el.dataset.blockId = block.id;

            if (block.highlight) {
                if (block.highlight.startsWith('#')) {
                    el.style.background = Utils.hexToRgba(block.highlight, 0.25);
                    el.style.borderColor = Utils.hexToRgba(block.highlight, 0.5);
                } else {
                    const highlightClass = `highlight-${block.highlight.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
                    el.classList.add(highlightClass);
                }
            }

            if (now >= block.start && now < block.end) el.classList.add('current');
            if (block.checked) el.classList.add('checked');

            const top = (block.start - State.startHour) * State.HOUR_HEIGHT;
            const height = (block.end - block.start) * State.HOUR_HEIGHT;
            const clampedTop = Math.max(0, top);
            const clampedHeight = Math.min(height, State.totalHours * State.HOUR_HEIGHT - clampedTop);

            if (clampedHeight <= 0) return;

            el.style.top = `${clampedTop}px`;
            el.style.height = `${clampedHeight}px`;

            const innerContent = `
                <div class="resize-handle resize-handle-top"></div>
                <div class="timeblock-time">${Utils.formatTimeRange(block.start, block.end)}</div>
                ${block.isTask 
                  ? `<div class="timeblock-content">
                       <input type="checkbox" class="timeblock-checkbox" ${block.checked ? 'checked' : ''}>
                       <div class="timeblock-title">${Utils.escapeHtml(block.title)}</div>
                     </div>`
                  : `<div class="timeblock-title">${Utils.escapeHtml(block.title)}</div>`
                }
                <div class="resize-handle resize-handle-bottom"></div>
            `;
            el.innerHTML = innerContent;
            track.appendChild(el);
        });

        this.updateNowLine();
        this.startNowLineUpdates();
    },

    renderUnscheduled(items) {
        const todoList = this.elements['unscheduled-list'];
        const doneList = this.elements['done-list'];
        todoList.innerHTML = '';
        doneList.innerHTML = '';

        let todoCount = 0;
        let doneCount = 0;

        items.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'unscheduled-item' + (item.checked ? ' checked' : '');
            el.dataset.index = index;
            if (item.id) el.dataset.blockId = item.id;
            el.draggable = true;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'unscheduled-checkbox';
            checkbox.checked = item.checked;
            
            const text = document.createElement('span');
            text.className = 'unscheduled-text';
            text.textContent = item.text;

            el.appendChild(checkbox);
            el.appendChild(text);

            if (item.checked) {
                doneList.appendChild(el);
                doneCount++;
            } else {
                todoList.appendChild(el);
                todoCount++;
            }
        });

        this.toggleSectionVisibility('unscheduled', todoCount);
        this.toggleSectionVisibility('done', doneCount);
        this.updateBadge('unscheduled-section-badge', todoCount);
        this.updateBadge('done-section-badge', doneCount);
        this.updateBadge('sidebar-badge', todoCount);
    },

    toggleSectionVisibility(id, count) {
        const section = this.elements[id];
        if (count === 0) section.classList.add('hidden');
        else section.classList.remove('hidden');
    },

    updateBadge(id, count) {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.textContent = count;
        if (count > 0) {
            badge.classList.remove('hidden');
            badge.classList.add('active');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('active');
        }
    },

    applySidebarState() {
        const layout = document.querySelector('.app-layout');
        const btn = this.elements['sidebar-toggle-btn'];
        if (State.isSidebarCollapsed) {
            layout.classList.add('sidebar-closed');
            btn.classList.add('active');
            btn.querySelector('svg').style.opacity = '0.5';
        } else {
            layout.classList.remove('sidebar-closed');
            btn.classList.remove('active');
            btn.querySelector('svg').style.opacity = '1';
        }
    },

    showSyncStatus(status, message) {
        const el = this.elements['sync-status'];
        const text = el.querySelector('.sync-text');
        const indicator = el.querySelector('.sync-indicator');
        
        if (el.dataset.timeout) clearTimeout(el.dataset.timeout);

        el.className = `sync-status visible ${status}`;
        text.textContent = message || '';

        if (status === 'saving') {
            indicator.innerHTML = '<div class="sync-spinner"></div>';
        } else if (status === 'saved') {
            indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
            const t = setTimeout(() => el.classList.remove('visible'), 2000);
            el.dataset.timeout = t;
        } else if (status === 'error') {
            indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>';
            const t = setTimeout(() => el.classList.remove('visible'), 3000);
            el.dataset.timeout = t;
        }
    },

    getCurrentTimeDecimal() {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    },

    updateNowLine() {
        const track = this.elements['timeline-track'];
        let nowLine = track.querySelector('.now-line');
        const now = this.getCurrentTimeDecimal();

        if (now < State.startHour || now > State.endHour) {
            if (nowLine) nowLine.remove();
            return;
        }

        if (!nowLine) {
            nowLine = document.createElement('div');
            nowLine.className = 'now-line';
            nowLine.innerHTML = `<span class="now-time">${Utils.formatDecimalTime(now)}</span><span class="now-dot"></span>`;
            track.appendChild(nowLine);
        }

        const top = (now - State.startHour) * State.HOUR_HEIGHT;
        nowLine.style.top = `${top}px`;
        nowLine.querySelector('.now-time').textContent = Utils.formatDecimalTime(now);
    },

    startNowLineUpdates() {
        if (this.nowLineInterval) clearInterval(this.nowLineInterval);
        this.nowLineInterval = setInterval(() => this.updateNowLine(), 60000);
    },

    scrollToNow() {
        const now = this.getCurrentTimeDecimal();
        if (now >= State.startHour && now <= State.endHour) {
            const top = (now - State.startHour) * State.HOUR_HEIGHT;
            const offset = window.innerHeight / 3;
            window.scrollTo({
                top: Math.max(0, top - offset),
                behavior: 'smooth'
            });
        }
    }
};