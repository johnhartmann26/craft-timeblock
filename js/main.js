// Craft TimeBlock - JavaScript
// Main application logic

document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const STORAGE_KEY = 'craft-timeblock-api';
    const TIME_SETTINGS_KEY = 'craft-timeblock-times';
    const HOUR_HEIGHT = 60; // pixels per hour

    // Sidebar State
    const SIDEBAR_KEY = 'craft-timeblock-sidebar-collapsed';
    let isSidebarCollapsed = false;

    // Configurable time range (loaded from localStorage)
    let START_HOUR = 6;  // 6 AM default
    let END_HOUR = 22;   // 10 PM default
    let TOTAL_HOURS = END_HOUR - START_HOUR;

    // State
    let apiUrl = '';
    let nowLineInterval = null;
    let hoveredBlock = null;
    let scheduledBlocks = []; 
    let unscheduledBlocks = [];
    let hoveredUnscheduledItem = null;
    let currentDragDuration = 1; 
    let currentDragOffset = 0; 

    // Touch drag state
    let touchDragData = null; 
    let touchDragGhost = null; 
    let touchDragSource = null; 
    let touchStartY = 0; 

    // Date navigation state
    let currentDate = new Date(); 

    // DOM Elements
    const setupScreen = document.getElementById('setup-screen');
    const setupForm = document.getElementById('setup-form');
    const apiUrlInput = document.getElementById('api-url');
    const setupError = document.getElementById('setup-error');

    const app = document.getElementById('app');
    const dateTitle = document.getElementById('date-title');
    const loading = document.getElementById('loading');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const timelineContainer = document.getElementById('timeline-container');
    const timeAxis = document.getElementById('time-axis');
    const timelineTrack = document.getElementById('timeline-track');
    
    // Unscheduled & Done Sections
    const unscheduledSection = document.getElementById('unscheduled');
    const unscheduledList = document.getElementById('unscheduled-list');
    const doneSection = document.getElementById('done');
    const doneList = document.getElementById('done-list');

    const refreshBtn = document.getElementById('refresh-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const retryBtn = document.getElementById('retry-btn');
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');

    const settingsModal = document.getElementById('settings-modal');
    const settingsApiUrl = document.getElementById('settings-api-url');
    const settingsStartHour = document.getElementById('settings-start-hour');
    const settingsEndHour = document.getElementById('settings-end-hour');

    // Initialize
    function init() {
      loadTimeSettings();
      populateTimeSelects();

      apiUrl = localStorage.getItem(STORAGE_KEY);

      if (apiUrl) {
        showApp();
        loadSchedule();
      } else {
        showSetup();
      }

      isSidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === 'true';
      applySidebarState();
      setupSectionToggles();

      setupEventListeners();
    }

    // Toggle Section Collapse
    function setupSectionToggles() {
      const headers = document.querySelectorAll('.collapsible-header');
      
      headers.forEach(header => {
        const sectionId = header.dataset.section; // 'unscheduled' or 'done'
        const parent = document.getElementById(sectionId);
        const storageKey = `craft-timeblock-collapse-${sectionId}`;
        
        // 1. Restore state from LocalStorage
        const isCollapsed = localStorage.getItem(storageKey) === 'true';
        if (isCollapsed) {
          parent.classList.add('collapsed');
        }

        // 2. Add Click Listener
        header.addEventListener('click', () => {
          const wasCollapsed = parent.classList.contains('collapsed');
          if (wasCollapsed) {
            parent.classList.remove('collapsed');
            localStorage.setItem(storageKey, 'false');
          } else {
            parent.classList.add('collapsed');
            localStorage.setItem(storageKey, 'true');
          }
        });
      });
    }

    // Sidebar Logic
    const appLayout = document.querySelector('.app-layout'); // Make sure this exists in your DOM logic or use document.querySelector inside the function
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarBadge = document.getElementById('sidebar-badge');

    function toggleSidebar() {
      isSidebarCollapsed = !isSidebarCollapsed;
      localStorage.setItem(SIDEBAR_KEY, isSidebarCollapsed);
      applySidebarState();
    }

    function applySidebarState() {
      const layout = document.querySelector('.app-layout');
      if (isSidebarCollapsed) {
        layout.classList.add('sidebar-closed');
        sidebarToggleBtn.classList.add('active'); // Optional visual feedback
        sidebarToggleBtn.querySelector('svg').style.opacity = '0.5'; // Dim icon when closed
      } else {
        layout.classList.remove('sidebar-closed');
        sidebarToggleBtn.classList.remove('active');
        sidebarToggleBtn.querySelector('svg').style.opacity = '1';
      }
    }

    function updateSidebarBadge(count) {
      if (!sidebarBadge) return;
      
      sidebarBadge.textContent = count;
      
      if (count > 0) {
        sidebarBadge.classList.remove('hidden');
      } else {
        sidebarBadge.classList.add('hidden');
      }
    }

    // Time settings
    function loadTimeSettings() {
      const saved = localStorage.getItem(TIME_SETTINGS_KEY);
      if (saved) {
        const { start, end } = JSON.parse(saved);
        START_HOUR = start;
        END_HOUR = end;
        TOTAL_HOURS = END_HOUR - START_HOUR;
      }
    }

    function populateTimeSelects() {
      // Populate hour options (0-23)
      for (let h = 0; h <= 23; h++) {
        const label = formatHourLabel(h);
        const startOpt = document.createElement('option');
        startOpt.value = h;
        startOpt.textContent = label;
        settingsStartHour.appendChild(startOpt);

        const endOpt = document.createElement('option');
        endOpt.value = h;
        endOpt.textContent = label;
        settingsEndHour.appendChild(endOpt);
      }
      settingsStartHour.value = START_HOUR;
      settingsEndHour.value = END_HOUR;
    }

    function formatHourLabel(hour) {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour < 12) return `${hour} AM`;
      return `${hour - 12} PM`;
    }

    function saveTimeSettings() {
      const newStart = parseInt(settingsStartHour.value);
      const newEnd = parseInt(settingsEndHour.value);
      if (newEnd <= newStart) return; // Invalid range

      if (newStart !== START_HOUR || newEnd !== END_HOUR) {
        START_HOUR = newStart;
        END_HOUR = newEnd;
        TOTAL_HOURS = END_HOUR - START_HOUR;
        localStorage.setItem(TIME_SETTINGS_KEY, JSON.stringify({ start: START_HOUR, end: END_HOUR }));
        updateTimelineHeight();
        renderTimeAxis();
        renderTimeline(scheduledBlocks);
      }
    }

    function updateTimelineHeight() {
      timelineTrack.style.minHeight = `${TOTAL_HOURS * HOUR_HEIGHT}px`;
    }

    // Date Navigation
    function formatDateTitle(date) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
    }

    function formatDateForApi(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function isToday(date) {
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }

    function updateDateTitle() {
      dateTitle.textContent = formatDateTitle(currentDate);
    }

    function goToPrevDay() {
      currentDate.setDate(currentDate.getDate() - 1);
      updateDateTitle();
      loadSchedule();
    }

    function goToNextDay() {
      currentDate.setDate(currentDate.getDate() + 1);
      updateDateTitle();
      loadSchedule();
    }

    function setupEventListeners() {
      setupForm.addEventListener('submit', handleSetup);
      refreshBtn.addEventListener('click', loadSchedule);
      addTaskBtn.addEventListener('click', addNewUnscheduledTask);
      settingsBtn.addEventListener('click', openSettings);
      retryBtn.addEventListener('click', loadSchedule);
      prevDayBtn.addEventListener('click', goToPrevDay);
      nextDayBtn.addEventListener('click', goToNextDay);
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
      });
      if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
      }

      // Auto-save API URL on blur or enter
      settingsApiUrl.addEventListener('blur', saveSettings);
      settingsApiUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          settingsApiUrl.blur();
        }
        if (e.key === 'Escape') {
          closeSettings();
        }
      });

      // Auto-save time settings on change
      settingsStartHour.addEventListener('change', saveTimeSettings);
      settingsEndHour.addEventListener('change', saveTimeSettings);

      // Escape to close settings modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
          closeSettings();
        }
      });
      
      // Setup drop zones for both sections
      setupDropZone(unscheduledSection);
      setupDropZone(doneSection);
    }

    // Setup
    function showSetup() {
      setupScreen.classList.remove('hidden');
      app.classList.add('hidden');
    }

    function showApp() {
      setupScreen.classList.add('hidden');
      app.classList.remove('hidden');
      updateDateTitle();
      updateTimelineHeight();
      renderTimeAxis();
    }

    async function handleSetup(e) {
      e.preventDefault();
      const url = apiUrlInput.value.trim();

      if (!url) return;

      setupError.classList.add('hidden');
      const btn = setupForm.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Connecting...';

      try {
        // Validate by attempting to fetch
        const testUrl = normalizeApiUrl(url);
        const response = await fetch(`${testUrl}/blocks?date=today`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        // Save and continue
        apiUrl = testUrl;
        localStorage.setItem(STORAGE_KEY, apiUrl);
        showApp();
        loadSchedule();
      } catch (err) {
        setupError.textContent = `Could not connect: ${err.message}. Check your URL and try again.`;
        setupError.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    }

    function normalizeApiUrl(url) {
      // Remove trailing slash and ensure it ends with api/v1
      url = url.replace(/\/+$/, '');
      if (!url.endsWith('/api/v1')) {
        if (url.includes('/api/v1')) {
          url = url.split('/api/v1')[0] + '/api/v1';
        }
      }
      return url;
    }

    // Settings
    function openSettings() {
      settingsApiUrl.value = apiUrl;
      settingsStartHour.value = START_HOUR;
      settingsEndHour.value = END_HOUR;
      settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
      settingsModal.classList.add('hidden');
    }

    function saveSettings() {
      const newUrl = settingsApiUrl.value.trim();
      if (newUrl && newUrl !== apiUrl) {
        apiUrl = normalizeApiUrl(newUrl);
        localStorage.setItem(STORAGE_KEY, apiUrl);
        loadSchedule();
      }
    }

    // Time Axis
    function renderTimeAxis() {
      timeAxis.innerHTML = '';
      for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        const label = document.createElement('div');
        label.className = 'time-label';
        label.style.top = `${(hour - START_HOUR) * HOUR_HEIGHT}px`;
        label.textContent = formatHour(hour);
        timeAxis.appendChild(label);
      }
    }

    function formatHour(hour) {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour < 12) return `${hour} AM`;
      return `${hour - 12} PM`;
    }

    // Load Schedule
    async function loadSchedule() {
      showLoading();

      try {
        const dateParam = isToday(currentDate) ? 'today' : formatDateForApi(currentDate);
        const fetchUrl = `${apiUrl}/blocks?date=${dateParam}`;
        let response = await fetch(fetchUrl);

        // If no daily note exists (404), create one
        if (!response.ok && response.status === 404) {
          await createDailyNote(dateParam);
          response = await fetch(fetchUrl);
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        // Get raw text first, then try to parse as JSON
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          data = rawText;
        }

        const { scheduled, unscheduledItems } = parseBlocks(data);

        scheduledBlocks = scheduled; // Store for updates
        unscheduledBlocks = unscheduledItems; // Store for updates
        renderTimeline(scheduled);
        renderUnscheduled(unscheduledItems);
        startNowLineUpdates();
        setupInteractions();

        showTimeline();
        scrollToNow();
      } catch (err) {
        console.error('Load error:', err);
        showError(err.message);
      }
    }

    // Create a daily note for a specific date
    async function createDailyNote(dateParam) {
      const response = await fetch(`${apiUrl}/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blocks: [{
            type: 'text',
            markdown: ''
          }],
          position: {
            position: 'end',
            date: dateParam
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create daily note: ${response.status}`);
      }
    }

    function showLoading() {
      loading.classList.remove('hidden');
      errorState.classList.add('hidden');
      timelineContainer.classList.add('hidden');
    }

    function showTimeline() {
      loading.classList.add('hidden');
      errorState.classList.add('hidden');
      timelineContainer.classList.remove('hidden');
    }

    function showError(message) {
      loading.classList.add('hidden');
      timelineContainer.classList.add('hidden');
      errorMessage.textContent = message;
      errorState.classList.remove('hidden');
    }

    // Parse Blocks
    function parseBlocks(data) {
      const scheduled = [];
      const unscheduledItems = [];

      // Time pattern
      const timePattern = /^`?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[-–—]+|to|->|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`?\s*(?:[-–—:]|\s)\s*(.+)$/i;

      // Task with time pattern
      const taskWithTimePattern = /^-?\s*\[([ x]?)\]\s*`?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[-–—]+|to|->|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`?\s*(?:[-–—:]|\s)\s*(.+)$/i;

      function processText(text, highlight = null, blockId = null, originalMarkdown = null) {
        if (!text || typeof text !== 'string') return;

        let trimmed = text.trim();
        if (!trimmed) return;

        // Check for highlighting
        const highlightMatch = trimmed.match(/^<highlight\s+color=["']([^"']+)["']>(.+)<\/highlight>$/is);
        if (highlightMatch) {
          highlight = highlightMatch[1]; 
          trimmed = highlightMatch[2].trim(); 
        }

        // First check for task with time (checkbox + time)
        const taskWithTimeMatch = trimmed.match(taskWithTimePattern);
        if (taskWithTimeMatch) {
          const isChecked = taskWithTimeMatch[1].toLowerCase() === 'x';
          // Shared AM/PM
          let startPeriod = taskWithTimeMatch[4];
          const endPeriod = taskWithTimeMatch[7];
          if (!startPeriod && endPeriod) startPeriod = endPeriod;

          const startHour = parseTime(taskWithTimeMatch[2], taskWithTimeMatch[3], startPeriod);
          const endHour = parseTime(taskWithTimeMatch[5], taskWithTimeMatch[6], endPeriod);
          const title = taskWithTimeMatch[8].trim();

          if (startHour !== null && endHour !== null && title) {
            scheduled.push({
              id: blockId,
              start: startHour,
              end: endHour,
              title: title,
              category: categorizeTask(title),
              highlight: highlight,
              originalMarkdown: originalMarkdown || trimmed,
              isTask: true,
              checked: isChecked
            });
            return;
          }
        }

        // Check for regular time pattern (no checkbox)
        const match = trimmed.match(timePattern);
        if (match) {
          let startPeriod = match[3];
          const endPeriod = match[6];
          if (!startPeriod && endPeriod) startPeriod = endPeriod;

          const startHour = parseTime(match[1], match[2], startPeriod);
          const endHour = parseTime(match[4], match[5], endPeriod);
          const title = match[7].trim();

          if (startHour !== null && endHour !== null && title) {
            scheduled.push({
              id: blockId,
              start: startHour,
              end: endHour,
              title: title,
              category: categorizeTask(title),
              highlight: highlight,
              originalMarkdown: originalMarkdown || trimmed,
              isTask: false,
              checked: false
            });
            return;
          }
        }

        // Check if it's a checkbox/todo item (no time)
        const todoMatch = trimmed.match(/^-?\s*\[([ x]?)\]\s*(.+)$/i);
        if (todoMatch) {
          const isChecked = todoMatch[1].toLowerCase() === 'x';
          unscheduledItems.push({
            id: blockId,
            text: todoMatch[2].trim(),
            checked: isChecked,
            originalMarkdown: originalMarkdown || trimmed
          });
        }
      }

      function processBlock(block) {
        let blockColor = block.color || block.highlight || block.highlightColor || null;
        const blockId = block.id || null;

        if (blockColor && typeof blockColor === 'object') {
          blockColor = blockColor.color || blockColor.name || null;
        }

        if (!blockColor && block.style) {
          blockColor = block.style.color || block.style.highlight || null;
        }

        if (block.markdown) {
          if (block.listStyle === 'todo' || block.listStyle === 'checkbox') {
            const text = block.markdown.replace(/^-?\s*\[[ x]?\]\s*/i, '').trim();
            if (text && !text.match(timePattern)) {
              const isChecked = block.taskInfo?.state === 'done' ||
                                /^-?\s*\[x\]/i.test(block.markdown);
              unscheduledItems.push({
                id: blockId,
                text: text,
                checked: isChecked,
                originalMarkdown: block.markdown
              });
              return; 
            }
          }
          processText(block.markdown, blockColor, blockId, block.markdown);
        }

        if (block.content) {
          if (typeof block.content === 'string') {
            processText(block.content, blockColor, blockId, block.content);
          } else if (Array.isArray(block.content)) {
            block.content.forEach(item => {
              if (typeof item === 'string') {
                processText(item, blockColor, blockId, item);
              } else if (typeof item === 'object') {
                processBlock(item); 
              }
            });
          }
        }

        if (block.text) {
          processText(block.text, null, blockId, block.text);
        }
        if (block.pageTitle) {
          processText(block.pageTitle, null, blockId, block.pageTitle);
        }

        if (block.blocks) block.blocks.forEach(processBlock);
        if (block.subblocks) block.subblocks.forEach(processBlock);
        if (block.children) block.children.forEach(processBlock);
        if (block.page) processBlock(block.page);
      }

      if (typeof data === 'string') {
        const parsed = parseXMLResponse(data);
        if (parsed.length > 0) {
          parsed.forEach(text => processText(text));
        }
      } else if (Array.isArray(data)) {
        data.forEach(processBlock);
      } else if (data.page) {
        processBlock(data.page);
      } else if (data.blocks) {
        data.blocks.forEach(processBlock);
      } else {
        processBlock(data);
      }

      scheduled.sort((a, b) => a.start - b.start);

      return { scheduled, unscheduledItems };
    }

    function parseXMLResponse(xmlString) {
      const results = [];
      const pageTitleRegex = /<pageTitle>([^<]+)<\/pageTitle>/g;
      let match;
      while ((match = pageTitleRegex.exec(xmlString)) !== null) {
        results.push(match[1]);
      }
      const contentRegex = /<content>([^<]+)<\/content>/g;
      while ((match = contentRegex.exec(xmlString)) !== null) {
        results.push(match[1]);
      }
      return results;
    }

    function parseTime(hours, minutes, period) {
      let h = parseInt(hours, 10);
      const m = parseInt(minutes || '0', 10);
      if (isNaN(h)) return null;

      if (period) {
        const p = period.toLowerCase();
        if (p === 'pm' && h !== 12) h += 12;
        if (p === 'am' && h === 12) h = 0;
      }
      return h + m / 60;
    }

    function categorizeTask(title) {
      const lower = title.toLowerCase();
      if (/deep work|focus|code|write|develop|build/.test(lower)) return 'work';
      if (/call|meeting|sync|chat|standup|1:1|interview/.test(lower)) return 'meeting';
      if (/gym|exercise|workout|run|yoga|walk|health|meditat/.test(lower)) return 'health';
      if (/lunch|dinner|breakfast|break|personal|family|friend/.test(lower)) return 'personal';
      return 'default';
    }

    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Render Timeline
    function renderTimeline(scheduled) {
      timelineTrack.querySelectorAll('.timeblock, .now-line, .hour-line').forEach(el => el.remove());

      for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        const line = document.createElement('div');
        line.className = 'hour-line';
        line.style.top = `${(hour - START_HOUR) * HOUR_HEIGHT}px`;
        timelineTrack.appendChild(line);
      }

      const now = getCurrentTimeDecimal();

      scheduled.forEach((block, index) => {
        const el = document.createElement('div');
        el.className = `timeblock ${block.category}`;
        el.dataset.blockIndex = index;
        if (block.id) el.dataset.blockId = block.id;

        if (block.highlight) {
          if (block.highlight.startsWith('#')) {
            el.style.background = hexToRgba(block.highlight, 0.25);
            el.style.borderColor = hexToRgba(block.highlight, 0.5);
          } else {
            const highlightClass = `highlight-${block.highlight.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
            el.classList.add(highlightClass);
          }
        }

        if (now >= block.start && now < block.end) {
          el.classList.add('current');
        }

        const top = (block.start - START_HOUR) * HOUR_HEIGHT;
        const height = (block.end - block.start) * HOUR_HEIGHT;
        const clampedTop = Math.max(0, top);
        const clampedHeight = Math.min(height, TOTAL_HOURS * HOUR_HEIGHT - clampedTop);

        if (clampedHeight <= 0) return;

        el.style.top = `${clampedTop}px`;
        el.style.height = `${clampedHeight}px`;

        if (block.isTask && block.checked) {
          el.classList.add('checked');
        }

        const innerContent = `
            <div class="resize-handle resize-handle-top"></div>
            <div class="timeblock-time">${formatTimeRange(block.start, block.end)}</div>
            ${block.isTask 
              ? `<div class="timeblock-content">
                   <input type="checkbox" class="timeblock-checkbox" ${block.checked ? 'checked' : ''}>
                   <div class="timeblock-title">${escapeHtml(block.title)}</div>
                 </div>`
              : `<div class="timeblock-title">${escapeHtml(block.title)}</div>`
            }
            <div class="resize-handle resize-handle-bottom"></div>
        `;
        el.innerHTML = innerContent;
        timelineTrack.appendChild(el);
      });

      updateNowLine();
    }

    function formatTimeRange(start, end) {
      return `${formatDecimalTime(start)} - ${formatDecimalTime(end)}`;
    }

    function formatDecimalTime(decimal) {
      const hours = Math.floor(decimal);
      const minutes = Math.round((decimal - hours) * 60);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Now Line
    function getCurrentTimeDecimal() {
      const now = new Date();
      return now.getHours() + now.getMinutes() / 60;
    }

    function updateNowLine() {
      let nowLine = timelineTrack.querySelector('.now-line');
      const now = getCurrentTimeDecimal();

      if (now < START_HOUR || now > END_HOUR) {
        if (nowLine) nowLine.remove();
        return;
      }

      if (!nowLine) {
        nowLine = document.createElement('div');
        nowLine.className = 'now-line';
        nowLine.innerHTML = `
          <span class="now-time">${formatDecimalTime(now)}</span>
          <span class="now-dot"></span>
        `;
        timelineTrack.appendChild(nowLine);
      }

      const top = (now - START_HOUR) * HOUR_HEIGHT;
      nowLine.style.top = `${top}px`;
      nowLine.querySelector('.now-time').textContent = formatDecimalTime(now);

      document.querySelectorAll('.timeblock').forEach(block => {
        const blockTop = parseFloat(block.style.top);
        const blockHeight = parseFloat(block.style.height);
        const blockStart = blockTop / HOUR_HEIGHT + START_HOUR;
        const blockEnd = (blockTop + blockHeight) / HOUR_HEIGHT + START_HOUR;

        if (now >= blockStart && now < blockEnd) {
          block.classList.add('current');
        } else {
          block.classList.remove('current');
        }
      });
    }

    function startNowLineUpdates() {
      if (nowLineInterval) clearInterval(nowLineInterval);
      nowLineInterval = setInterval(updateNowLine, 60000); 
    }

    function scrollToNow() {
      const now = getCurrentTimeDecimal();
      if (now >= START_HOUR && now <= END_HOUR) {
        const top = (now - START_HOUR) * HOUR_HEIGHT;
        const offset = window.innerHeight / 3;
        window.scrollTo({
          top: Math.max(0, top - offset),
          behavior: 'smooth'
        });
      }
    }

    // Render Unscheduled - MODIFIED to split Done/Todo
    // Render Unscheduled - with Section Badges
    function renderUnscheduled(items) {
      // Clear both lists
      unscheduledList.innerHTML = '';
      doneList.innerHTML = '';

      let todoCount = 0;
      let doneCount = 0;

      // Iterate and render
     // Inside renderUnscheduled...
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
        checkbox.addEventListener('change', () => toggleUnscheduledItem(index, checkbox.checked));

        const text = document.createElement('span');
        text.className = 'unscheduled-text';
        text.textContent = item.text;

        el.addEventListener('mouseenter', () => {
          hoveredUnscheduledItem = el;
          el.classList.add('hovered');
        });
        el.addEventListener('mouseleave', () => {
          if (hoveredUnscheduledItem === el) hoveredUnscheduledItem = null;
          el.classList.remove('hovered');
        });

        el.addEventListener('dragstart', (e) => {
          el.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'unscheduled',
            index: index,
            blockId: item.id,
            text: item.text,
            checked: item.checked
          }));
          e.dataTransfer.effectAllowed = 'move';
        });

        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
        });

        setupTouchDrag(el, index, item);

        el.appendChild(checkbox);
        el.appendChild(text);

        if (item.checked) {
            doneList.appendChild(el);
            doneCount++;
        } else {
            unscheduledList.appendChild(el);
            todoCount++;
        }
      });

      // 1. Manage Visibility of Sections
      if (todoCount === 0) {
        unscheduledSection.classList.add('hidden');
      } else {
        unscheduledSection.classList.remove('hidden');
      }

      if (doneCount === 0) {
        doneSection.classList.add('hidden');
      } else {
        doneSection.classList.remove('hidden');
      }

      // 2. Update Header Badges
      updateSectionBadge('unscheduled-section-badge', todoCount);
      updateSectionBadge('done-section-badge', doneCount);

      // 3. Update Global Sidebar Badge
      updateSidebarBadge(todoCount);
    }

    // Helper to update specific section badges
    function updateSectionBadge(id, count) {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.textContent = count;
      
      if (count > 0) {
        el.classList.remove('hidden');
        // Optional: Add 'active' class if you want it colored
        el.classList.add('active'); 
      } else {
        el.classList.add('hidden');
        el.classList.remove('active');
      }
    }
    
    // NOTE: You'll need to move the element creation logic (createUnscheduledElement) 
    // back inline if you didn't extract it, or use the exact loop code from the previous step.
    // For brevity, I assumed the existing loop logic is preserved inside the forEach.

    function setupTouchDrag(el, index, item) {
       el.addEventListener('touchstart', (e) => {
          const startTouch = e.touches[0];
          const startX = startTouch.clientX;
          const startY = startTouch.clientY;
          let isDragReady = false;
          let isDragging = false;
          let isSwiping = false;
          let swipeTranslate = 0;
          let longPressTimer = null;

          longPressTimer = setTimeout(() => {
            isDragReady = true;
            el.style.opacity = '0.7';
          }, 200);

          const checkForGesture = (moveEvent) => {
            const moveTouch = moveEvent.touches[0];
            const deltaX = moveTouch.clientX - startX;
            const deltaY = moveTouch.clientY - startY;

            if (isDragging) return;

            if (!isSwiping && !isDragReady && deltaX < -15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
              clearTimeout(longPressTimer);
              isSwiping = true;
            }

            if (isSwiping) {
              moveEvent.preventDefault();
              swipeTranslate = Math.min(0, deltaX);
              el.style.transform = `translateX(${swipeTranslate}px)`;
              el.style.transition = 'none';
              return;
            }

            if (!isDragReady && Math.abs(deltaY) > 10) {
              clearTimeout(longPressTimer);
              cleanup();
              return;
            }

            if (isDragReady && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
              moveEvent.preventDefault();
              isDragging = true;
              el.style.opacity = '';
              el.removeEventListener('touchmove', checkForGesture);
              startTouchDrag(moveEvent, {
                type: 'unscheduled',
                index: index,
                blockId: item.id,
                text: item.text,
                checked: item.checked
              }, el, false);
            }
          };

          const cleanup = () => {
            clearTimeout(longPressTimer);
            el.style.opacity = '';
            el.removeEventListener('touchmove', checkForGesture);
            el.removeEventListener('touchend', cleanup);
            el.removeEventListener('touchcancel', cleanup);

            if (isSwiping) {
              el.style.transition = 'transform 0.2s ease-out';
              if (swipeTranslate < -80) {
                el.style.transform = 'translateX(-100%)';
                setTimeout(() => deleteUnscheduledItem(el), 200);
              } else {
                el.style.transform = 'translateX(0)';
              }
            }
          };

          el.addEventListener('touchmove', checkForGesture, { passive: false });
          el.addEventListener('touchend', cleanup);
          el.addEventListener('touchcancel', cleanup);
        }, { passive: false });
    }

    // Toggle unscheduled item checkbox
    async function toggleUnscheduledItem(index, checked) {
      const item = unscheduledBlocks[index];
      if (!item || !item.id) {
        console.warn('Cannot update item: no block ID');
        return;
      }

      // Update local state
      item.checked = checked;

      // Re-render IMMEDIATELY to move item to the other list
      renderUnscheduled(unscheduledBlocks);

      // Build new markdown
      const checkMark = checked ? 'x' : ' ';
      const newMarkdown = `- [${checkMark}] ${item.text}`;

      showSyncStatus('saving', 'Updating...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: item.id,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        item.originalMarkdown = newMarkdown;
        showSyncStatus('saved', 'Updated');
      } catch (err) {
        console.error('Failed to update item:', err);
        showSyncStatus('error', 'Update failed');
        // Revert on error
        item.checked = !checked;
        renderUnscheduled(unscheduledBlocks);
      }
    }

    // Interactions: Drag, Resize, Delete
    function setupInteractions() {
      const blocks = timelineTrack.querySelectorAll('.timeblock');

      blocks.forEach(el => {
        const blockIndex = parseInt(el.dataset.blockIndex);
        const block = scheduledBlocks[blockIndex];

        el.draggable = true;

        el.addEventListener('mouseenter', () => {
          hoveredBlock = el;
          el.classList.add('hovered');
        });

        el.addEventListener('mouseleave', () => {
          if (hoveredBlock === el) hoveredBlock = null;
          el.classList.remove('hovered');
        });

        el.addEventListener('dragstart', (e) => {
          if (!block) return;
          el.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'scheduled',
            index: blockIndex,
            blockId: block.id,
            title: block.title,
            start: block.start,
            end: block.end,
            checked: block.checked || false
          }));
          e.dataTransfer.effectAllowed = 'move';
        });

        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
        });

        // Touch drag block logic
        el.addEventListener('touchstart', (e) => {
          if (!block || el.classList.contains('editing')) return;
          const startTouch = e.touches[0];
          const startX = startTouch.clientX;
          const startY = startTouch.clientY;
          let isDragReady = false;
          let isDragging = false;
          let isSwiping = false;
          let swipeTranslate = 0;
          let longPressTimer = null;

          longPressTimer = setTimeout(() => {
            isDragReady = true;
            el.style.opacity = '0.7';
          }, 200);

          const checkForGesture = (moveEvent) => {
            const moveTouch = moveEvent.touches[0];
            const deltaX = moveTouch.clientX - startX;
            const deltaY = moveTouch.clientY - startY;

            if (isDragging) return;

            if (!isSwiping && !isDragReady && deltaX < -15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
              clearTimeout(longPressTimer);
              isSwiping = true;
            }

            if (isSwiping) {
              moveEvent.preventDefault();
              swipeTranslate = Math.min(0, deltaX);
              el.style.transform = `translateX(${swipeTranslate}px)`;
              el.style.transition = 'none';
              return;
            }

            if (!isDragReady && Math.abs(deltaY) > 10) {
              clearTimeout(longPressTimer);
              cleanup();
              return;
            }

            if (isDragReady && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
              moveEvent.preventDefault();
              isDragging = true;
              el.style.opacity = '';
              el.removeEventListener('touchmove', checkForGesture);
              startTouchDrag(moveEvent, {
                type: 'scheduled',
                index: blockIndex,
                blockId: block.id,
                title: block.title,
                start: block.start,
                end: block.end,
                checked: block.checked || false
              }, el, true);
            }
          };

          const cleanup = () => {
            clearTimeout(longPressTimer);
            el.style.opacity = '';
            el.removeEventListener('touchmove', checkForGesture);
            el.removeEventListener('touchend', cleanup);
            el.removeEventListener('touchcancel', cleanup);

            if (isSwiping) {
              el.style.transition = 'transform 0.2s ease-out';
              if (swipeTranslate < -80) {
                el.style.transform = 'translateX(-100%)';
                setTimeout(() => deleteBlock(el), 200);
              } else {
                el.style.transform = 'translateX(0)';
              }
            }
          };

          el.addEventListener('touchmove', checkForGesture, { passive: false });
          el.addEventListener('touchend', cleanup);
          el.addEventListener('touchcancel', cleanup);
        }, { passive: false });

        const topHandle = el.querySelector('.resize-handle-top');
        const bottomHandle = el.querySelector('.resize-handle-bottom');

        topHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          startResize(el, e, 'top', false);
        });

        bottomHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          startResize(el, e, 'bottom', false);
        });

        topHandle.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
          startResize(el, e, 'top', true);
        }, { passive: false });

        bottomHandle.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
          startResize(el, e, 'bottom', true);
        }, { passive: false });

        const checkbox = el.querySelector('.timeblock-checkbox');
        if (checkbox) {
          checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); 
          });
          checkbox.addEventListener('change', () => {
            toggleTaskTimeblock(blockIndex, checkbox.checked);
          });
        }
      });

      document.addEventListener('keydown', handleKeydown);
    }

    // Toggle checkbox on task timeblock
    async function toggleTaskTimeblock(index, checked) {
      const block = scheduledBlocks[index];
      if (!block || !block.id) {
        console.warn('Cannot update block: no block ID');
        return;
      }

      block.checked = checked;

      const el = timelineTrack.querySelector(`[data-block-index="${index}"]`);
      if (el) {
        el.classList.toggle('checked', checked);
      }

      const startStr = decimalToTimeString(block.start);
      const endStr = decimalToTimeString(block.end);
      const checkMark = checked ? 'x' : ' ';
      const newMarkdown = `- [${checkMark}] \`${startStr} - ${endStr}\` ${block.title}`;

      showSyncStatus('saving', 'Updating...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: block.id,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        block.originalMarkdown = newMarkdown;
        showSyncStatus('saved', 'Updated');
      } catch (err) {
        console.error('Failed to update task:', err);
        showSyncStatus('error', 'Update failed');
        block.checked = !checked;
        if (el) {
          el.classList.toggle('checked', !checked);
          const checkbox = el.querySelector('.timeblock-checkbox');
          if (checkbox) checkbox.checked = !checked;
        }
      }
    }

    function handleKeydown(e) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          return;
        }

        if (hoveredBlock) {
          e.preventDefault();
          deleteBlock(hoveredBlock);
        } else if (hoveredUnscheduledItem) {
          e.preventDefault();
          deleteUnscheduledItem(hoveredUnscheduledItem);
        }
      }
    }

    // Delete unscheduled item
    async function deleteUnscheduledItem(el) {
      const index = parseInt(el.dataset.index);
      const item = unscheduledBlocks[index];

      if (!item || !item.id) {
        console.warn('Cannot delete item: no block ID');
        return;
      }

      showSyncStatus('saving', 'Deleting...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blockIds: [item.id]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to delete: ${response.status}`);
        }

        // Remove from local state
        unscheduledBlocks.splice(index, 1);
        
        // Re-render to update UI and indices
        renderUnscheduled(unscheduledBlocks);

        hoveredUnscheduledItem = null;
        showSyncStatus('saved', 'Deleted');
      } catch (err) {
        console.error('Failed to delete item:', err);
        showSyncStatus('error', 'Delete failed');
      }
    }

    // Drag functionality (startDrag, startResize etc...)
    function startDrag(el, e) {
      e.preventDefault();
      el.classList.add('dragging');

      const startY = e.clientY;
      const startTop = parseFloat(el.style.top);
      const blockHeight = parseFloat(el.style.height);
      const maxTop = TOTAL_HOURS * HOUR_HEIGHT - blockHeight;

      function onMouseMove(e) {
        const deltaY = e.clientY - startY;
        let newTop = startTop + deltaY;
        newTop = Math.round(newTop / 15) * 15;
        newTop = Math.max(0, Math.min(maxTop, newTop));
        el.style.top = `${newTop}px`;

        const newStart = newTop / HOUR_HEIGHT + START_HOUR;
        const duration = blockHeight / HOUR_HEIGHT;
        const newEnd = newStart + duration;
        const timeEl = el.querySelector('.timeblock-time');
        if (timeEl) {
          timeEl.textContent = formatTimeRange(newStart, newEnd);
        }
      }

      function onMouseUp() {
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const newTop = parseFloat(el.style.top);
        const blockHeight = parseFloat(el.style.height);
        const newStart = newTop / HOUR_HEIGHT + START_HOUR;
        const newEnd = newStart + blockHeight / HOUR_HEIGHT;

        updateBlockTime(el, newStart, newEnd);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function startResize(el, e, edge, isTouch = false) {
      e.preventDefault();
      el.classList.add('resizing');

      const startY = isTouch ? e.touches[0].clientY : e.clientY;
      const startTop = parseFloat(el.style.top);
      const startHeight = parseFloat(el.style.height);
      const minHeight = 15; 

      function onMove(e) {
        if (isTouch) e.preventDefault();
        const currentY = isTouch ? e.touches[0].clientY : e.clientY;
        const deltaY = currentY - startY;
        let newTop = startTop;
        let newHeight = startHeight;

        if (edge === 'top') {
          newTop = startTop + deltaY;
          newHeight = startHeight - deltaY;
          newTop = Math.round(newTop / 15) * 15;
          newHeight = startHeight + startTop - newTop;

          if (newTop < 0) {
            newTop = 0;
            newHeight = startHeight + startTop;
          }
          if (newHeight < minHeight) {
            newHeight = minHeight;
            newTop = startTop + startHeight - minHeight;
          }
        } else {
          newHeight = startHeight + deltaY;
          newHeight = Math.round(newHeight / 15) * 15;
          newHeight = Math.max(minHeight, newHeight);
          const maxHeight = TOTAL_HOURS * HOUR_HEIGHT - startTop;
          newHeight = Math.min(maxHeight, newHeight);
        }

        el.style.top = `${newTop}px`;
        el.style.height = `${newHeight}px`;

        const newStart = newTop / HOUR_HEIGHT + START_HOUR;
        const newEnd = newStart + newHeight / HOUR_HEIGHT;
        const timeEl = el.querySelector('.timeblock-time');
        if (timeEl) {
          timeEl.textContent = formatTimeRange(newStart, newEnd);
        }
      }

      function onEnd() {
        el.classList.remove('resizing');
        if (isTouch) {
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
          document.removeEventListener('touchcancel', onEnd);
        } else {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
        }

        const newTop = parseFloat(el.style.top);
        const newHeight = parseFloat(el.style.height);
        const newStart = newTop / HOUR_HEIGHT + START_HOUR;
        const newEnd = newStart + newHeight / HOUR_HEIGHT;

        updateBlockTime(el, newStart, newEnd);
      }

      if (isTouch) {
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
      } else {
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
      }
    }

    // Sync status indicator
    let syncHideTimeout = null;
    const syncStatus = document.getElementById('sync-status');
    const syncIndicator = syncStatus.querySelector('.sync-indicator');
    const syncText = syncStatus.querySelector('.sync-text');

    function showSyncStatus(status, message) {
      if (syncHideTimeout) {
        clearTimeout(syncHideTimeout);
        syncHideTimeout = null;
      }

      syncStatus.className = 'sync-status visible ' + status;

      if (status === 'saving') {
        syncIndicator.innerHTML = '<div class="sync-spinner"></div>';
        syncText.textContent = message || 'Saving...';
      } else if (status === 'saved') {
        syncIndicator.innerHTML = '<svg class="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        syncText.textContent = message || 'Saved';
        syncHideTimeout = setTimeout(() => {
          syncStatus.classList.remove('visible');
        }, 2000);
      } else if (status === 'error') {
        syncIndicator.innerHTML = '<svg class="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>';
        syncText.textContent = message || 'Error';
        syncHideTimeout = setTimeout(() => {
          syncStatus.classList.remove('visible');
        }, 3000);
      }
    }

    function decimalToTimeString(decimal) {
      const hours = Math.floor(decimal);
      const minutes = Math.round((decimal - hours) * 60);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    async function updateBlockTime(el, newStart, newEnd) {
      const blockIndex = parseInt(el.dataset.blockIndex);
      const block = scheduledBlocks[blockIndex];

      if (!block || !block.id) {
        console.warn('Cannot update block: no block ID');
        return;
      }

      block.start = newStart;
      block.end = newEnd;

      const newStartStr = decimalToTimeString(newStart);
      const newEndStr = decimalToTimeString(newEnd);
      const newMarkdown = `\`${newStartStr} - ${newEndStr}\` - ${block.title}`;

      showSyncStatus('saving', 'Syncing...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: block.id,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        block.originalMarkdown = newMarkdown;
        showSyncStatus('saved', 'Saved');
      } catch (err) {
        console.error('Failed to update block:', err);
        showSyncStatus('error', 'Sync failed');
      }
    }

    async function deleteBlock(el) {
      const blockIndex = parseInt(el.dataset.blockIndex);
      const block = scheduledBlocks[blockIndex];

      if (!block || !block.id) {
        console.warn('Cannot delete block: no block ID');
        return;
      }

      showSyncStatus('saving', 'Deleting...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blockIds: [block.id]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to delete: ${response.status}`);
        }

        el.remove();
        scheduledBlocks.splice(blockIndex, 1);
        timelineTrack.querySelectorAll('.timeblock').forEach((block, i) => {
          block.dataset.blockIndex = i;
        });

        hoveredBlock = null;
        showSyncStatus('saved', 'Deleted');
      } catch (err) {
        console.error('Failed to delete block:', err);
        showSyncStatus('error', 'Delete failed');
      }
    }

    let editingBlock = null;

    function formatTimeForMarkdown(hour24, min) {
      const period = hour24 >= 12 ? 'PM' : 'AM';
      const displayHour = hour24 > 12 ? hour24 - 12 : (hour24 === 0 ? 12 : hour24);
      return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
    }

    function createInlineTimeblock(startDecimal) {
      if (editingBlock) {
        editingBlock.remove();
        editingBlock = null;
      }

      const endDecimal = startDecimal + 1; 
      const top = (startDecimal - START_HOUR) * HOUR_HEIGHT;
      const height = HOUR_HEIGHT; 

      const el = document.createElement('div');
      el.className = 'timeblock default editing';

      el.style.top = `${top}px`;
      el.style.height = `${height}px`;

      const startHour = Math.floor(startDecimal);
      const startMin = Math.round((startDecimal - startHour) * 60);
      const endHour = Math.floor(endDecimal);
      const endMin = Math.round((endDecimal - endHour) * 60);

      el.innerHTML = `
        <div class="timeblock-time">${formatTimeRange(startDecimal, endDecimal)}</div>
        <input class="timeblock-title-input" placeholder="What's happening?" data-start="${startDecimal}" data-end="${endDecimal}">
      `;

      timelineTrack.appendChild(el);
      editingBlock = el;

      const input = el.querySelector('.timeblock-title-input');
      input.focus();

      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await saveInlineTimeblock(input);
        } else if (e.key === 'Escape') {
          cancelInlineTimeblock();
        }
      });

      input.addEventListener('blur', async () => {
        setTimeout(async () => {
          if (editingBlock && editingBlock.contains(input)) {
            const title = input.value.trim();
            if (title) {
              await saveInlineTimeblock(input);
            } else {
              cancelInlineTimeblock();
            }
          }
        }, 100);
      });
    }

    async function saveInlineTimeblock(input) {
      const title = input.value.trim();
      if (!title) {
        cancelInlineTimeblock();
        return;
      }

      const startDecimal = parseFloat(input.dataset.start);
      const endDecimal = parseFloat(input.dataset.end);

      const startHour = Math.floor(startDecimal);
      const startMin = Math.round((startDecimal - startHour) * 60);
      const endHour = Math.floor(endDecimal);
      const endMin = Math.round((endDecimal - endHour) * 60);

      const startStr = formatTimeForMarkdown(startHour, startMin);
      const endStr = formatTimeForMarkdown(endHour, endMin);
      const markdown = `\`${startStr} - ${endStr}\` - ${title}`;

      if (editingBlock) {
        const newBlockIndex = scheduledBlocks.length;
        const newBlock = {
          id: null, 
          start: startDecimal,
          end: endDecimal,
          title: title,
          isTask: false,
          originalMarkdown: markdown
        };
        scheduledBlocks.push(newBlock);

        editingBlock.classList.remove('editing');
        editingBlock.dataset.blockIndex = newBlockIndex;
        editingBlock.innerHTML = `
          <div class="resize-handle resize-handle-top"></div>
          <div class="timeblock-time">${formatTimeRange(startDecimal, endDecimal)}</div>
          <div class="timeblock-title">${escapeHtml(title)}</div>
          <div class="resize-handle resize-handle-bottom"></div>
        `;

        const savedBlock = editingBlock;
        editingBlock = null;

        showSyncStatus('saving', 'Creating...');

        try {
          const response = await fetch(`${apiUrl}/blocks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              blocks: [{
                type: 'text',
                markdown: markdown
              }],
              position: {
                position: 'end',
                date: 'today'
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to create: ${response.status}`);
          }

          const result = await response.json();
          const createdBlock = result.items?.[0] || result.blocks?.[0];
          if (createdBlock?.id) {
            newBlock.id = createdBlock.id;
            savedBlock.dataset.blockId = newBlock.id;
          }

          setupInteractions();

          showSyncStatus('saved', 'Created');
        } catch (err) {
          console.error('Failed to create block:', err);
          showSyncStatus('error', 'Create failed');
          savedBlock.remove();
          scheduledBlocks.pop();
        }
      }
    }

    function cancelInlineTimeblock() {
      if (editingBlock) {
        editingBlock.remove();
        editingBlock = null;
      }
    }

    timelineTrack.addEventListener('click', (e) => {
      if (e.target.closest('.timeblock') && !e.target.closest('.timeblock.editing')) {
        return;
      }

      if (e.target.closest('.now-line')) {
        return;
      }

      const rect = timelineTrack.getBoundingClientRect();
      const y = e.clientY - rect.top;

      let startDecimal = y / HOUR_HEIGHT + START_HOUR;
      startDecimal = Math.round(startDecimal * 4) / 4; 

      startDecimal = Math.max(START_HOUR, Math.min(END_HOUR - 1, startDecimal));

      createInlineTimeblock(startDecimal);
    });

    let editingUnscheduledItem = null;

    function createInlineUnscheduledTask() {
      if (editingUnscheduledItem) {
        editingUnscheduledItem.remove();
        editingUnscheduledItem = null;
      }

      unscheduledSection.classList.remove('hidden');

      const el = document.createElement('div');
      el.className = 'unscheduled-item editing';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'unscheduled-checkbox';
      checkbox.disabled = true;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'unscheduled-input';
      input.placeholder = 'New task...';

      el.appendChild(checkbox);
      el.appendChild(input);

      unscheduledList.insertBefore(el, unscheduledList.firstChild);
      editingUnscheduledItem = el;
      input.focus();

      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await saveInlineUnscheduledTask(input);
        } else if (e.key === 'Escape') {
          cancelInlineUnscheduledTask();
        }
      });

      input.addEventListener('blur', async () => {
        setTimeout(async () => {
          if (editingUnscheduledItem && editingUnscheduledItem.contains(input)) {
            const title = input.value.trim();
            if (title) {
              await saveInlineUnscheduledTask(input);
            } else {
              cancelInlineUnscheduledTask();
            }
          }
        }, 100);
      });
    }

    async function saveInlineUnscheduledTask(input) {
      const title = input.value.trim();
      if (!title) {
        cancelInlineUnscheduledTask();
        return;
      }

      const markdown = `- [ ] ${title}`;

      if (editingUnscheduledItem) {
        const newItemIndex = unscheduledBlocks.length;
        const newItem = {
          id: null, 
          text: title,
          checked: false,
          originalMarkdown: markdown
        };
        unscheduledBlocks.push(newItem);

        // Re-render to update the list
        renderUnscheduled(unscheduledBlocks);

        // Find the new element we just rendered
        const el = unscheduledList.querySelector(`[data-index="${newItemIndex}"]`);
        
        // Remove the editor if it still exists (it should be gone due to re-render, but safe to clear ref)
        editingUnscheduledItem = null;

        showSyncStatus('saving', 'Creating...');

        try {
          const response = await fetch(`${apiUrl}/blocks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              blocks: [{
                type: 'text',
                markdown: markdown
              }],
              position: {
                position: 'end',
                date: 'today'
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to create: ${response.status}`);
          }

          const result = await response.json();
          const createdBlock = result.items?.[0] || result.blocks?.[0];
          if (createdBlock?.id) {
            newItem.id = createdBlock.id;
            if (el) el.dataset.blockId = newItem.id;
          }

          showSyncStatus('saved', 'Created');
        } catch (err) {
          console.error('Failed to create task:', err);
          showSyncStatus('error', 'Create failed');
          unscheduledBlocks.pop();
          renderUnscheduled(unscheduledBlocks);
        }
      }
    }

    function cancelInlineUnscheduledTask() {
      if (editingUnscheduledItem) {
        editingUnscheduledItem.remove();
        editingUnscheduledItem = null;
      }
      renderUnscheduled(unscheduledBlocks); // Clean up empty states
    }

    document.addEventListener('keydown', (e) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      const modalOpen = !settingsModal.classList.contains('hidden');
      const appVisible = !app.classList.contains('hidden');

      if (e.key === ' ' && !isTyping && !modalOpen && appVisible) {
        e.preventDefault();
        createInlineUnscheduledTask();
      }

      if (e.key === 'ArrowLeft' && !isTyping && !modalOpen && appVisible) {
        e.preventDefault();
        goToPrevDay();
      }
      if (e.key === 'ArrowRight' && !isTyping && !modalOpen && appVisible) {
        e.preventDefault();
        goToNextDay();
      }
    });

    let dropIndicator = null;
    let unscheduledWasHidden = false;

    // Helper to attach drop events to a section
    function setupDropZone(section) {
        section.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          section.classList.add('drag-over');
        });
    
        section.addEventListener('dragleave', (e) => {
          if (!section.contains(e.relatedTarget)) {
            section.classList.remove('drag-over');
          }
        });
    
        section.addEventListener('drop', async (e) => {
          e.preventDefault();
          section.classList.remove('drag-over');
    
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type !== 'scheduled') return;
            await convertTimeblockToUnscheduled(data);
          } catch (err) {
            console.error('Drop error:', err);
          }
        });
    }

    document.addEventListener('dragstart', (e) => {
      const timeblock = e.target.closest('.timeblock');
      if (timeblock && !timeblock.classList.contains('editing')) {
        const blockRect = timeblock.getBoundingClientRect();
        currentDragOffset = e.clientY - blockRect.top;
        const blockIndex = parseInt(timeblock.dataset.blockIndex);
        if (!isNaN(blockIndex) && scheduledBlocks[blockIndex]) {
          const block = scheduledBlocks[blockIndex];
          currentDragDuration = block.end - block.start;
        } else {
          currentDragDuration = 1;
        }
        if (unscheduledSection.classList.contains('hidden')) {
          unscheduledWasHidden = true;
          unscheduledSection.classList.remove('hidden');
          unscheduledList.innerHTML = '<div class="unscheduled-drop-indicator">Drop here to unschedule</div>';
        }
      } else {
        currentDragDuration = 1;
        currentDragOffset = 0;
      }
    });

    document.addEventListener('dragend', (e) => {
      if (unscheduledWasHidden) {
        unscheduledWasHidden = false;
        if (unscheduledBlocks.filter(b => !b.checked).length === 0) {
          unscheduledSection.classList.add('hidden');
          unscheduledList.innerHTML = '';
        }
      }
      unscheduledSection.classList.remove('drag-over');
      doneSection.classList.remove('drag-over');
    });

    function startTouchDrag(e, data, sourceElement, isTimeblock) {
      e.preventDefault();

      const touch = e.touches[0];
      touchDragData = data;
      touchDragSource = sourceElement;
      touchStartY = touch.clientY;

      if (isTimeblock && data.start !== undefined && data.end !== undefined) {
        currentDragDuration = data.end - data.start;
      } else {
        currentDragDuration = 1;
      }

      const rect = sourceElement.getBoundingClientRect();
      currentDragOffset = touch.clientY - rect.top;

      touchDragGhost = document.createElement('div');
      touchDragGhost.className = 'touch-drag-ghost ' + (isTimeblock ? 'timeblock-ghost' : 'unscheduled-ghost');
      touchDragGhost.textContent = data.title || data.text;
      touchDragGhost.style.left = `${touch.clientX - 75}px`;
      touchDragGhost.style.top = `${touch.clientY - 20}px`;
      document.body.appendChild(touchDragGhost);

      sourceElement.classList.add('dragging');
      document.body.classList.add('touch-dragging');

      if (isTimeblock && unscheduledSection.classList.contains('hidden')) {
        unscheduledWasHidden = true;
        unscheduledSection.classList.remove('hidden');
        unscheduledList.innerHTML = '<div class="unscheduled-drop-indicator">Drop here to unschedule</div>';
      }
    }

    function handleTouchMove(e) {
      if (!touchDragData) return;
      e.preventDefault();

      const touch = e.touches[0];

      if (touchDragGhost) {
        touchDragGhost.style.left = `${touch.clientX - 75}px`;
        touchDragGhost.style.top = `${touch.clientY - 20}px`;
      }

      const timelineRect = timelineTrack.getBoundingClientRect();
      if (touch.clientX >= timelineRect.left && touch.clientX <= timelineRect.right &&
          touch.clientY >= timelineRect.top && touch.clientY <= timelineRect.bottom) {

        const y = touch.clientY - timelineRect.top - currentDragOffset;
        let startDecimal = y / HOUR_HEIGHT + START_HOUR;
        startDecimal = Math.round(startDecimal * 4) / 4; 
        startDecimal = Math.max(START_HOUR, Math.min(END_HOUR - currentDragDuration, startDecimal));

        const top = (startDecimal - START_HOUR) * HOUR_HEIGHT;
        const height = currentDragDuration * HOUR_HEIGHT;
        const endDecimal = startDecimal + currentDragDuration;

        if (!dropIndicator) {
          dropIndicator = document.createElement('div');
          dropIndicator.className = 'drop-indicator';
          timelineTrack.appendChild(dropIndicator);
        }

        dropIndicator.style.top = `${top}px`;
        dropIndicator.style.height = `${height}px`;
        dropIndicator.textContent = formatTimeRange(startDecimal, endDecimal);
        timelineTrack.classList.add('drag-over');
        unscheduledSection.classList.remove('drag-over');
      } else {
        if (dropIndicator) {
          dropIndicator.remove();
          dropIndicator = null;
        }
        timelineTrack.classList.remove('drag-over');

        const unscheduledRect = unscheduledSection.getBoundingClientRect();
        if (touch.clientX >= unscheduledRect.left && touch.clientX <= unscheduledRect.right &&
            touch.clientY >= unscheduledRect.top && touch.clientY <= unscheduledRect.bottom) {
          unscheduledSection.classList.add('drag-over');
        } else {
          unscheduledSection.classList.remove('drag-over');
        }
      }
    }

    async function endTouchDrag(e) {
      if (!touchDragData) return;

      const touch = e.changedTouches[0];

      const timelineRect = timelineTrack.getBoundingClientRect();
      const unscheduledRect = unscheduledSection.getBoundingClientRect();

      if (touch.clientX >= timelineRect.left && touch.clientX <= timelineRect.right &&
          touch.clientY >= timelineRect.top && touch.clientY <= timelineRect.bottom) {
        const y = touch.clientY - timelineRect.top - currentDragOffset;
        let startDecimal = y / HOUR_HEIGHT + START_HOUR;
        startDecimal = Math.round(startDecimal * 4) / 4;
        startDecimal = Math.max(START_HOUR, Math.min(END_HOUR - currentDragDuration, startDecimal));
        const endDecimal = startDecimal + currentDragDuration;

        if (touchDragData.type === 'scheduled') {
          await repositionTimeblock(touchDragData, startDecimal, endDecimal);
        } else if (touchDragData.type === 'unscheduled') {
          await convertUnscheduledToTimeblock(touchDragData, startDecimal, startDecimal + 1);
        }
      } else if (touch.clientX >= unscheduledRect.left && touch.clientX <= unscheduledRect.right &&
                 touch.clientY >= unscheduledRect.top && touch.clientY <= unscheduledRect.bottom) {
        if (touchDragData.type === 'scheduled') {
          await convertTimeblockToUnscheduled(touchDragData);
        }
      }

      cleanupTouchDrag();
    }

    function cleanupTouchDrag() {
      if (touchDragGhost) {
        touchDragGhost.remove();
        touchDragGhost = null;
      }
      if (touchDragSource) {
        touchDragSource.classList.remove('dragging');
        touchDragSource = null;
      }
      if (dropIndicator) {
        dropIndicator.remove();
        dropIndicator = null;
      }

      touchDragData = null;
      document.body.classList.remove('touch-dragging');
      timelineTrack.classList.remove('drag-over');
      unscheduledSection.classList.remove('drag-over');

      if (unscheduledWasHidden) {
        unscheduledWasHidden = false;
        // Re-check logic for hiding/showing handled by renderUnscheduled usually,
        // but touch drag cleanup might need manual check.
        // For simplicity, just re-render to ensure correct state:
        renderUnscheduled(unscheduledBlocks);
      }
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', endTouchDrag);
    document.addEventListener('touchcancel', cleanupTouchDrag);

    timelineTrack.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      try {
        const rect = timelineTrack.getBoundingClientRect();
        const y = e.clientY - rect.top - currentDragOffset;
        let startDecimal = y / HOUR_HEIGHT + START_HOUR;
        startDecimal = Math.round(startDecimal * 4) / 4; 
        startDecimal = Math.max(START_HOUR, Math.min(END_HOUR - currentDragDuration, startDecimal));

        const top = (startDecimal - START_HOUR) * HOUR_HEIGHT;
        const height = currentDragDuration * HOUR_HEIGHT;
        const endDecimal = startDecimal + currentDragDuration;

        if (!dropIndicator) {
          dropIndicator = document.createElement('div');
          dropIndicator.className = 'drop-indicator';
          timelineTrack.appendChild(dropIndicator);
        }

        dropIndicator.style.top = `${top}px`;
        dropIndicator.style.height = `${height}px`;
        dropIndicator.textContent = formatTimeRange(startDecimal, endDecimal);
        timelineTrack.classList.add('drag-over');
      } catch (err) {
        console.error('Dragover error:', err);
      }
    });

    timelineTrack.addEventListener('dragleave', (e) => {
      if (!timelineTrack.contains(e.relatedTarget)) {
        timelineTrack.classList.remove('drag-over');
        if (dropIndicator) {
          dropIndicator.remove();
          dropIndicator = null;
        }
      }
    });

    timelineTrack.addEventListener('drop', async (e) => {
      e.preventDefault();
      timelineTrack.classList.remove('drag-over');

      if (dropIndicator) {
        dropIndicator.remove();
        dropIndicator = null;
      }

      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));

        const rect = timelineTrack.getBoundingClientRect();
        const y = e.clientY - rect.top - currentDragOffset;
        let startDecimal = y / HOUR_HEIGHT + START_HOUR;
        startDecimal = Math.round(startDecimal * 4) / 4;
        startDecimal = Math.max(START_HOUR, Math.min(END_HOUR - currentDragDuration, startDecimal));

        if (data.type === 'unscheduled') {
          const endDecimal = startDecimal + 1; 
          await convertUnscheduledToTimeblock(data, startDecimal, endDecimal);
        } else if (data.type === 'scheduled') {
          const duration = data.end - data.start;
          const endDecimal = startDecimal + duration;
          await repositionTimeblock(data, startDecimal, endDecimal);
        }
      } catch (err) {
        console.error('Drop error:', err);
      }
    });

    async function convertUnscheduledToTimeblock(data, startDecimal, endDecimal) {
      if (!data.blockId) {
        console.warn('Cannot convert: no block ID');
        return;
      }

      const startStr = decimalToTimeString(startDecimal);
      const endStr = decimalToTimeString(endDecimal);
      const checkMark = data.checked ? 'x' : ' ';
      const newMarkdown = `- [${checkMark}] \`${startStr} - ${endStr}\` ${data.text}`;

      const removedItem = unscheduledBlocks.splice(data.index, 1)[0];
      const newBlock = {
        id: data.blockId,
        start: startDecimal,
        end: endDecimal,
        title: data.text,
        isTask: true,
        checked: data.checked,
        originalMarkdown: newMarkdown
      };
      scheduledBlocks.push(newBlock);

      hoveredBlock = null;
      hoveredUnscheduledItem = null;

      renderTimeline(scheduledBlocks);
      renderUnscheduled(unscheduledBlocks);
      setupInteractions();

      showSyncStatus('saving', 'Scheduling...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: data.blockId,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        showSyncStatus('saved', 'Scheduled');
      } catch (err) {
        console.error('Failed to convert to timeblock:', err);
        showSyncStatus('error', 'Schedule failed');
        scheduledBlocks.pop();
        unscheduledBlocks.splice(data.index, 0, removedItem);
        renderTimeline(scheduledBlocks);
        renderUnscheduled(unscheduledBlocks);
        setupInteractions();
      }
    }

    async function convertTimeblockToUnscheduled(data) {
      if (!data.blockId) {
        console.warn('Cannot convert: no block ID');
        return;
      }

      const checkMark = data.checked ? 'x' : ' ';
      const newMarkdown = `- [${checkMark}] ${data.title}`;

      const removedBlock = scheduledBlocks.splice(data.index, 1)[0];
      const newItem = {
        id: data.blockId,
        text: data.title,
        checked: data.checked || false,
        originalMarkdown: newMarkdown
      };
      unscheduledBlocks.push(newItem);

      hoveredBlock = null;
      hoveredUnscheduledItem = null;

      renderTimeline(scheduledBlocks);
      renderUnscheduled(unscheduledBlocks);
      setupInteractions();

      showSyncStatus('saving', 'Unscheduling...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: data.blockId,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        showSyncStatus('saved', 'Unscheduled');
      } catch (err) {
        console.error('Failed to convert to task:', err);
        showSyncStatus('error', 'Unschedule failed');
        unscheduledBlocks.pop();
        scheduledBlocks.splice(data.index, 0, removedBlock);
        renderTimeline(scheduledBlocks);
        renderUnscheduled(unscheduledBlocks);
        setupInteractions();
      }
    }

    function addNewUnscheduledTask() {
      createInlineUnscheduledTask();
    }

    async function repositionTimeblock(data, newStart, newEnd) {
      if (!data.blockId) {
        console.warn('Cannot reposition: no block ID');
        return;
      }

      const el = document.querySelector(`.timeblock[data-block-index="${data.index}"]`);
      if (el) {
        const top = (newStart - START_HOUR) * HOUR_HEIGHT;
        const height = (newEnd - newStart) * HOUR_HEIGHT;
        el.style.top = `${top}px`;
        el.style.height = `${height}px`;

        const timeEl = el.querySelector('.timeblock-time');
        if (timeEl) {
          timeEl.textContent = `${decimalToTimeString(newStart)} - ${decimalToTimeString(newEnd)}`;
        }
      }

      const block = scheduledBlocks[data.index];
      if (block) {
        block.start = newStart;
        block.end = newEnd;
      }

      const startStr = decimalToTimeString(newStart);
      const endStr = decimalToTimeString(newEnd);
      const newMarkdown = `\`${startStr} - ${endStr}\` - ${data.title}`;

      showSyncStatus('saving', 'Moving...');

      try {
        const response = await fetch(`${apiUrl}/blocks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocks: [{
              id: data.blockId,
              markdown: newMarkdown
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update: ${response.status}`);
        }

        if (block) {
          block.originalMarkdown = newMarkdown;
        }
        showSyncStatus('saved', 'Moved');
      } catch (err) {
        console.error('Failed to reposition block:', err);
        showSyncStatus('error', 'Move failed');
      }
    }

    init();
});