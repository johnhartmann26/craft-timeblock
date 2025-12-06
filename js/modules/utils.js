import { State } from './state.js';

export const Utils = {
    formatHourLabel(hour) {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        if (hour < 12) return `${hour} AM`;
        return `${hour - 12} PM`;
    },

    formatDecimalTime(decimal) {
        const hours = Math.floor(decimal);
        const minutes = Math.round((decimal - hours) * 60);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    },

    formatTimeRange(start, end) {
        return `${this.formatDecimalTime(start)} - ${this.formatDecimalTime(end)}`;
    },

    decimalToTimeString(decimal) {
        return this.formatDecimalTime(decimal);
    },

    formatDateForApi(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDateTitle(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
    },

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // NEW: Parse [Link](URL) syntax safely
    renderMarkdown(text) {
        if (!text) return '';
        // 1. Escape HTML first to prevent XSS (script injection)
        let html = this.escapeHtml(text);
        
        // 2. Parse Markdown Links: [Title](URL)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
            // draggable="false" prevents dragging the link itself
            // onclick="event.stopPropagation()" prevents triggering block selection/drag
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="embedded-link" draggable="false" onclick="event.stopPropagation()">${title}</a>`;
        });
        
        return html;
    },

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    normalizeApiUrl(url) {
        url = url.replace(/\/+$/, '');
        if (!url.endsWith('/api/v1')) {
            if (url.includes('/api/v1')) {
                url = url.split('/api/v1')[0] + '/api/v1';
            }
        }
        return url;
    },

    categorizeTask(title) {
        const lower = title.toLowerCase();
        if (/deep work|focus|code|write|develop|build/.test(lower)) return 'work';
        if (/call|meeting|sync|chat|standup|1:1|interview/.test(lower)) return 'meeting';
        if (/gym|exercise|workout|run|yoga|walk|health|meditat/.test(lower)) return 'health';
        if (/lunch|dinner|breakfast|break|personal|family|friend/.test(lower)) return 'personal';
        return 'default';
    },

    parseTime(hours, minutes, period) {
        let h = parseInt(hours, 10);
        const m = parseInt(minutes || '0', 10);
        if (isNaN(h)) return null;

        if (period) {
            const p = period.toLowerCase();
            if (p === 'pm' && h !== 12) h += 12;
            if (p === 'am' && h === 12) h = 0;
        }
        return h + m / 60;
    },

    // Main Parser Logic
    parseBlocks(data) {
        const scheduled = [];
        const unscheduledItems = [];
        
        // Regex Patterns
        const timePattern = /^`?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[-–—]+|to|->|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`?\s*(?:[-–—:]|\s)\s*(.+)$/i;
        const taskWithTimePattern = /^-?\s*\[([ x]?)\]\s*`?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[-–—]+|to|->|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`?\s*(?:[-–—:]|\s)\s*(.+)$/i;

        const processText = (text, highlight = null, blockId = null, originalMarkdown = null) => {
            if (!text || typeof text !== 'string') return;
            let trimmed = text.trim();
            if (!trimmed) return;

            // Handle Highlight tags
            const highlightMatch = trimmed.match(/^<highlight\s+color=["']([^"']+)["']>(.+)<\/highlight>$/is);
            if (highlightMatch) {
                highlight = highlightMatch[1];
                trimmed = highlightMatch[2].trim();
            }

            // 1. Task with Time
            const taskWithTimeMatch = trimmed.match(taskWithTimePattern);
            if (taskWithTimeMatch) {
                const isChecked = taskWithTimeMatch[1].toLowerCase() === 'x';
                let startPeriod = taskWithTimeMatch[4];
                const endPeriod = taskWithTimeMatch[7];
                if (!startPeriod && endPeriod) startPeriod = endPeriod;

                const startHour = this.parseTime(taskWithTimeMatch[2], taskWithTimeMatch[3], startPeriod);
                const endHour = this.parseTime(taskWithTimeMatch[5], taskWithTimeMatch[6], endPeriod);
                const title = taskWithTimeMatch[8].trim();

                if (startHour !== null && endHour !== null && title) {
                    scheduled.push({
                        id: blockId,
                        start: startHour,
                        end: endHour,
                        title: title,
                        category: this.categorizeTask(title),
                        highlight: highlight,
                        originalMarkdown: originalMarkdown || trimmed,
                        isTask: true,
                        checked: isChecked
                    });
                    return;
                }
            }

            // 2. Regular Time Pattern
            const match = trimmed.match(timePattern);
            if (match) {
                let startPeriod = match[3];
                const endPeriod = match[6];
                if (!startPeriod && endPeriod) startPeriod = endPeriod;

                const startHour = this.parseTime(match[1], match[2], startPeriod);
                const endHour = this.parseTime(match[4], match[5], endPeriod);
                const title = match[7].trim();

                if (startHour !== null && endHour !== null && title) {
                    scheduled.push({
                        id: blockId,
                        start: startHour,
                        end: endHour,
                        title: title,
                        category: this.categorizeTask(title),
                        highlight: highlight,
                        originalMarkdown: originalMarkdown || trimmed,
                        isTask: false,
                        checked: false
                    });
                    return;
                }
            }

            // 3. Regular Todo (Unscheduled)
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
        };

        const processBlock = (block) => {
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
                        const isChecked = block.taskInfo?.state === 'done' || /^-?\s*\[x\]/i.test(block.markdown);
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
                        if (typeof item === 'string') processText(item, blockColor, blockId, item);
                        else if (typeof item === 'object') processBlock(item);
                    });
                }
            }

            if (block.blocks) block.blocks.forEach(processBlock);
            if (block.subblocks) block.subblocks.forEach(processBlock);
            if (block.children) block.children.forEach(processBlock);
        };

        if (typeof data === 'string') {
            // fallback
        } else if (Array.isArray(data)) {
            data.forEach(processBlock);
        } else if (data.blocks) {
            data.blocks.forEach(processBlock);
        } else {
            processBlock(data);
        }

        scheduled.sort((a, b) => a.start - b.start);
        return { scheduled, unscheduledItems };
    }
};