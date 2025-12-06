import { State } from './state.js';
import { API } from './api.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';

export const Interactions = {
    // Dependencies
    refreshCallback: null,

    // Drag State
    currentDragDuration: 1,
    currentDragOffset: 0,
    touchDragData: null,
    touchDragGhost: null,
    touchDragSource: null,
    dropIndicator: null,
    editingBlock: null,
    editingUnscheduledItem: null,

    init(refreshCallback) {
        this.refreshCallback = refreshCallback;
        
        this.setupTouchListeners();
        this.setupKeydownListeners();
        this.setupDropZones();
        
        // Listen for timeline clicks to create blocks
        UI.elements['timeline-track'].addEventListener('click', (e) => this.handleTimelineClick(e));
        
        // Listen for sidebar Add button
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.createInlineUnscheduledTask());
    },

    // Helper to safely call the refresh callback
    triggerRefresh() {
        if (this.refreshCallback) this.refreshCallback();
    },

    setupBlockInteractions() {
        // Scheduled Blocks
        const blocks = UI.elements['timeline-track'].querySelectorAll('.timeblock');
        blocks.forEach(el => {
            const index = parseInt(el.dataset.blockIndex);
            const block = State.scheduledBlocks[index];
            if (!block) return;

            el.draggable = true;
            this.setupMouseHover(el, 'block');
            this.setupDragStart(el, {
                type: 'scheduled',
                index, blockId: block.id,
                title: block.title,
                start: block.start, end: block.end,
                checked: block.checked
            });
            this.setupTouchDrag(el, index, block, true);
            this.setupResizeHandlers(el);
            
            // Checkbox
            const checkbox = el.querySelector('.timeblock-checkbox');
            if (checkbox) {
                checkbox.addEventListener('click', e => e.stopPropagation());
                checkbox.addEventListener('change', () => this.toggleTaskTimeblock(index, checkbox.checked));
            }
        });

        // Unscheduled Items
        const items = document.querySelectorAll('.unscheduled-item');
        items.forEach(el => {
            const index = parseInt(el.dataset.index);
            const item = State.unscheduledBlocks[index];
            if (!item) return;

            this.setupMouseHover(el, 'unscheduled');
            this.setupDragStart(el, {
                type: 'unscheduled',
                index, blockId: item.id,
                text: item.text, checked: item.checked
            });
            this.setupTouchDrag(el, index, item, false);

            const checkbox = el.querySelector('.unscheduled-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', () => this.toggleUnscheduledItem(index, checkbox.checked));
            }
        });
    },

    setupMouseHover(el, type) {
        el.addEventListener('mouseenter', () => {
            if (type === 'block') State.hoveredBlock = el;
            else State.hoveredUnscheduledItem = el;
            el.classList.add('hovered');
        });
        el.addEventListener('mouseleave', () => {
            if (type === 'block' && State.hoveredBlock === el) State.hoveredBlock = null;
            if (type === 'unscheduled' && State.hoveredUnscheduledItem === el) State.hoveredUnscheduledItem = null;
            el.classList.remove('hovered');
        });
    },

    setupDragStart(el, data) {
        el.addEventListener('dragstart', (e) => {
            if (el.classList.contains('editing')) return;
            el.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'move';
            
            // Calculate offset and duration for visual feedback
            const rect = el.getBoundingClientRect();
            this.currentDragOffset = e.clientY - rect.top;
            if (data.type === 'scheduled') {
                this.currentDragDuration = data.end - data.start;
            } else {
                this.currentDragDuration = 1; // Default 1 hour
            }
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            this.clearDropIndicator();
        });
    },

    setupResizeHandlers(el) {
        const top = el.querySelector('.resize-handle-top');
        const bottom = el.querySelector('.resize-handle-bottom');
        if (!top || !bottom) return;

        const start = (e, edge, isTouch) => {
            e.stopPropagation();
            if (isTouch) e.preventDefault();
            this.startResize(el, e, edge, isTouch);
        };

        top.addEventListener('mousedown', e => start(e, 'top', false));
        bottom.addEventListener('mousedown', e => start(e, 'bottom', false));
        top.addEventListener('touchstart', e => start(e, 'top', true), { passive: false });
        bottom.addEventListener('touchstart', e => start(e, 'bottom', true), { passive: false });
    },

    // --- Drag & Drop Logic (Drop Zones) ---

    setupDropZones() {
        const track = UI.elements['timeline-track'];
        
        track.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.handleDragOverTimeline(e.clientY);
        });

        track.addEventListener('dragleave', (e) => {
            if (!track.contains(e.relatedTarget)) this.clearDropIndicator();
        });

        track.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.clearDropIndicator();
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const { start, end } = this.calculateTimeFromY(e.clientY);
                
                if (data.type === 'unscheduled') {
                    await this.convertUnscheduledToTimeblock(data, start, start + 1);
                } else if (data.type === 'scheduled') {
                    const duration = data.end - data.start;
                    await this.repositionTimeblock(data, start, start + duration);
                }
            } catch (err) { console.error('Drop error', err); }
        });

        // Unscheduled Section Drop Zone
        const unscheduledSection = UI.elements['unscheduled'];
        unscheduledSection.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            unscheduledSection.classList.add('drag-over');
        });
        unscheduledSection.addEventListener('dragleave', () => unscheduledSection.classList.remove('drag-over'));
        unscheduledSection.addEventListener('drop', async (e) => {
            e.preventDefault();
            unscheduledSection.classList.remove('drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'scheduled') await this.convertTimeblockToUnscheduled(data);
            } catch (err) { console.error(err); }
        });
    },

    handleDragOverTimeline(clientY) {
        const { start, end } = this.calculateTimeFromY(clientY);
        const track = UI.elements['timeline-track'];
        
        if (!this.dropIndicator) {
            this.dropIndicator = document.createElement('div');
            this.dropIndicator.className = 'drop-indicator';
            track.appendChild(this.dropIndicator);
        }

        const top = (start - State.startHour) * State.HOUR_HEIGHT;
        const height = (end - start) * State.HOUR_HEIGHT;

        this.dropIndicator.style.top = `${top}px`;
        this.dropIndicator.style.height = `${height}px`;
        this.dropIndicator.textContent = Utils.formatTimeRange(start, end);
        track.classList.add('drag-over');
    },

    clearDropIndicator() {
        if (this.dropIndicator) {
            this.dropIndicator.remove();
            this.dropIndicator = null;
        }
        UI.elements['timeline-track'].classList.remove('drag-over');
    },

    calculateTimeFromY(clientY) {
        const rect = UI.elements['timeline-track'].getBoundingClientRect();
        const y = clientY - rect.top - this.currentDragOffset;
        let start = y / State.HOUR_HEIGHT + State.startHour;
        
        // Snap to 15 mins
        start = Math.round(start * 4) / 4;
        start = Math.max(State.startHour, Math.min(State.endHour - this.currentDragDuration, start));
        
        return { start, end: start + this.currentDragDuration };
    },

    // --- Resizing Logic ---

    startResize(el, e, edge, isTouch) {
        el.classList.add('resizing');
        const startY = isTouch ? e.touches[0].clientY : e.clientY;
        const startTop = parseFloat(el.style.top);
        const startHeight = parseFloat(el.style.height);

        const onMove = (moveEvent) => {
            if (isTouch) moveEvent.preventDefault();
            const currentY = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
            const deltaY = currentY - startY;
            let newTop = startTop;
            let newHeight = startHeight;

            if (edge === 'top') {
                newTop = startTop + deltaY;
                newHeight = startHeight - deltaY;
                // Snap
                newTop = Math.round(newTop / 15) * 15;
                newHeight = startHeight + startTop - newTop;
                
                if (newHeight < 15) { newHeight = 15; newTop = startTop + startHeight - 15; }
                if (newTop < 0) { newTop = 0; newHeight = startHeight + startTop; }
            } else {
                newHeight = startHeight + deltaY;
                newHeight = Math.round(newHeight / 15) * 15;
                if (newHeight < 15) newHeight = 15;
            }

            el.style.top = `${newTop}px`;
            el.style.height = `${newHeight}px`;
            
            // Visual Update
            const s = newTop / State.HOUR_HEIGHT + State.startHour;
            const eTime = s + newHeight / State.HOUR_HEIGHT;
            el.querySelector('.timeblock-time').textContent = Utils.formatTimeRange(s, eTime);
        };

        const onEnd = () => {
            el.classList.remove('resizing');
            const handler = isTouch ? document : document;
            const moveEvent = isTouch ? 'touchmove' : 'mousemove';
            const endEvent = isTouch ? 'touchend' : 'mouseup';
            
            handler.removeEventListener(moveEvent, onMove);
            handler.removeEventListener(endEvent, onEnd);

            const finalTop = parseFloat(el.style.top);
            const finalHeight = parseFloat(el.style.height);
            const newStart = finalTop / State.HOUR_HEIGHT + State.startHour;
            const newEnd = newStart + finalHeight / State.HOUR_HEIGHT;
            
            this.updateBlockTime(el.dataset.blockIndex, newStart, newEnd);
        };

        if (isTouch) {
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        } else {
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
        }
    },

    // --- API Actions for Interactions ---

    async repositionTimeblock(data, newStart, newEnd) {
        UI.showSyncStatus('saving', 'Moving...');
        try {
            const startStr = Utils.decimalToTimeString(newStart);
            const endStr = Utils.decimalToTimeString(newEnd);
            const newMarkdown = `\`${startStr} - ${endStr}\` - ${data.title}`;
            
            await API.updateBlock(data.blockId, newMarkdown);
            // Optimistic update
            const block = State.scheduledBlocks[data.index];
            if (block) { block.start = newStart; block.end = newEnd; block.originalMarkdown = newMarkdown; }
            
            UI.renderTimeline(State.scheduledBlocks);
            this.setupBlockInteractions();
            UI.showSyncStatus('saved', 'Moved');
        } catch (e) {
            console.error(e);
            UI.showSyncStatus('error', 'Move failed');
            this.triggerRefresh(); // Revert
        }
    },

    async updateBlockTime(index, newStart, newEnd) {
        const block = State.scheduledBlocks[index];
        if(!block) return;
        this.repositionTimeblock({ blockId: block.id, index, title: block.title }, newStart, newEnd);
    },

    async convertUnscheduledToTimeblock(data, start, end) {
        UI.showSyncStatus('saving', 'Scheduling...');
        try {
            const startStr = Utils.decimalToTimeString(start);
            const endStr = Utils.decimalToTimeString(end);
            const checkMark = data.checked ? 'x' : ' ';
            const newMarkdown = `- [${checkMark}] \`${startStr} - ${endStr}\` ${data.text}`;
            
            await API.updateBlock(data.blockId, newMarkdown);
            // Re-fetch strictly easier to ensure sync
            this.triggerRefresh();
            UI.showSyncStatus('saved', 'Scheduled');
        } catch (e) {
            console.error(e);
            UI.showSyncStatus('error', 'Failed');
        }
    },

    async convertTimeblockToUnscheduled(data) {
        UI.showSyncStatus('saving', 'Unscheduling...');
        try {
            const checkMark = data.checked ? 'x' : ' ';
            const newMarkdown = `- [${checkMark}] ${data.title}`;
            await API.updateBlock(data.blockId, newMarkdown);
            this.triggerRefresh();
            UI.showSyncStatus('saved', 'Unscheduled');
        } catch (e) { console.error(e); UI.showSyncStatus('error', 'Failed'); }
    },

    async toggleTaskTimeblock(index, checked) {
        const block = State.scheduledBlocks[index];
        UI.showSyncStatus('saving', 'Updating...');
        try {
            const startStr = Utils.decimalToTimeString(block.start);
            const endStr = Utils.decimalToTimeString(block.end);
            const checkMark = checked ? 'x' : ' ';
            const newMarkdown = `- [${checkMark}] \`${startStr} - ${endStr}\` ${block.title}`;
            
            await API.updateBlock(block.id, newMarkdown);
            block.checked = checked;
            UI.renderTimeline(State.scheduledBlocks); 
            this.setupBlockInteractions();
            UI.showSyncStatus('saved', 'Updated');
        } catch (e) {
            console.error(e);
            UI.showSyncStatus('error', 'Failed');
            this.triggerRefresh();
        }
    },

    async toggleUnscheduledItem(index, checked) {
        const item = State.unscheduledBlocks[index];
        // Optimistic UI
        item.checked = checked;
        UI.renderUnscheduled(State.unscheduledBlocks);
        this.setupBlockInteractions(); // Re-bind listeners
        
        UI.showSyncStatus('saving', 'Updating...');
        try {
            const checkMark = checked ? 'x' : ' ';
            const newMarkdown = `- [${checkMark}] ${item.text}`;
            await API.updateBlock(item.id, newMarkdown);
            item.originalMarkdown = newMarkdown;
            UI.showSyncStatus('saved', 'Updated');
        } catch (e) {
            console.error(e);
            item.checked = !checked; // Revert
            UI.renderUnscheduled(State.unscheduledBlocks);
            UI.showSyncStatus('error', 'Failed');
        }
    },

    // --- Creation / Deletion ---

    handleTimelineClick(e) {
        if (e.target.closest('.timeblock') || e.target.closest('.now-line')) return;
        
        const rect = UI.elements['timeline-track'].getBoundingClientRect();
        const y = e.clientY - rect.top;
        let start = y / State.HOUR_HEIGHT + State.startHour;
        start = Math.round(start * 4) / 4;
        start = Math.max(State.startHour, Math.min(State.endHour - 1, start));

        this.createInlineTimeblock(start);
    },

    createInlineTimeblock(start) {
        if (this.editingBlock) this.editingBlock.remove();
        
        const end = start + 1;
        const el = document.createElement('div');
        el.className = 'timeblock default editing';
        el.style.top = `${(start - State.startHour) * State.HOUR_HEIGHT}px`;
        el.style.height = `${State.HOUR_HEIGHT}px`;
        
        el.innerHTML = `
            <div class="timeblock-time">${Utils.formatTimeRange(start, end)}</div>
            <input class="timeblock-title-input" placeholder="What's happening?" autofocus>
        `;
        
        UI.elements['timeline-track'].appendChild(el);
        this.editingBlock = el;
        
        const input = el.querySelector('input');
        input.focus();

        const save = async () => {
            const title = input.value.trim();
            if (title) {
                const startStr = Utils.decimalToTimeString(start);
                const endStr = Utils.decimalToTimeString(end);
                const markdown = `\`${startStr} - ${endStr}\` - ${title}`;
                
                UI.showSyncStatus('saving', 'Creating...');
                try {
                    await API.createBlock(markdown);
                    this.editingBlock = null;
                    el.remove();
                    this.triggerRefresh();
                    UI.showSyncStatus('saved', 'Created');
                } catch(e) { console.error(e); UI.showSyncStatus('error', 'Failed'); }
            } else {
                el.remove();
                this.editingBlock = null;
            }
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); } 
            if (e.key === 'Escape') { el.remove(); this.editingBlock = null; }
        });
        input.addEventListener('blur', save);
    },

    createInlineUnscheduledTask() {
        if (this.editingUnscheduledItem) this.editingUnscheduledItem.remove();
        
        const list = UI.elements['unscheduled-list'];
        UI.elements['unscheduled'].classList.remove('hidden');
        
        const el = document.createElement('div');
        el.className = 'unscheduled-item editing';
        el.innerHTML = `<input type="checkbox" disabled class="unscheduled-checkbox"><input type="text" class="unscheduled-input" placeholder="New task..." autofocus>`;
        
        list.insertBefore(el, list.firstChild);
        this.editingUnscheduledItem = el;
        const input = el.querySelector('input[type="text"]');
        input.focus();

        const save = async () => {
            const text = input.value.trim();
            if (text) {
                const markdown = `- [ ] ${text}`;
                UI.showSyncStatus('saving', 'Creating...');
                try {
                    await API.createBlock(markdown);
                    this.editingUnscheduledItem = null;
                    el.remove();
                    this.triggerRefresh();
                    UI.showSyncStatus('saved', 'Created');
                } catch(e) { console.error(e); UI.showSyncStatus('error', 'Failed'); }
            } else {
                el.remove();
                this.editingUnscheduledItem = null;
            }
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { el.remove(); this.editingUnscheduledItem = null; }
        });
        input.addEventListener('blur', save);
    },

    setupKeydownListeners() {
        document.addEventListener('keydown', async (e) => {
            const activeTag = document.activeElement.tagName;
            if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;
            
            // Shortcuts
            if (e.key === ' ' && !UI.elements['settings-modal'].classList.contains('hidden')) {
               // Only trigger if modal is CLOSED (aka hidden)
            } else if (e.key === ' ' && UI.elements['settings-modal'].classList.contains('hidden')) {
               e.preventDefault();
               this.createInlineUnscheduledTask();
            }
            
            // Delete
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (State.hoveredBlock) {
                    e.preventDefault();
                    UI.showSyncStatus('saving', 'Deleting...');
                    try {
                        const blockId = State.hoveredBlock.dataset.blockId;
                        if(blockId) await API.deleteBlocks([blockId]);
                        State.hoveredBlock.remove();
                        State.hoveredBlock = null;
                        UI.showSyncStatus('saved', 'Deleted');
                    } catch(e) { console.error(e); UI.showSyncStatus('error', 'Failed'); }
                }
                else if (State.hoveredUnscheduledItem) {
                    e.preventDefault();
                    UI.showSyncStatus('saving', 'Deleting...');
                    try {
                        const blockId = State.hoveredUnscheduledItem.dataset.blockId;
                        if(blockId) await API.deleteBlocks([blockId]);
                        State.hoveredUnscheduledItem.remove();
                        State.hoveredUnscheduledItem = null;
                        UI.showSyncStatus('saved', 'Deleted');
                    } catch(e) { console.error(e); UI.showSyncStatus('error', 'Failed'); }
                }
            }
        });
    },

    // Touch Drag (Simplified)
    setupTouchDrag(el, index, data, isTimeblock) {
        el.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            let timer = setTimeout(() => {
                // Long press
                el.style.opacity = '0.7';
                this.touchDragData = { ...data, type: isTimeblock ? 'scheduled' : 'unscheduled' };
                this.touchDragSource = el;
                this.currentDragDuration = isTimeblock ? (data.end - data.start) : 1;
                
                this.touchDragGhost = document.createElement('div');
                this.touchDragGhost.className = isTimeblock ? 'touch-drag-ghost timeblock-ghost' : 'touch-drag-ghost unscheduled-ghost';
                this.touchDragGhost.textContent = data.title || data.text;
                this.touchDragGhost.style.left = `${startX - 75}px`;
                this.touchDragGhost.style.top = `${startY - 20}px`;
                document.body.appendChild(this.touchDragGhost);
                
                document.body.classList.add('touch-dragging');
                const rect = el.getBoundingClientRect();
                this.currentDragOffset = startY - rect.top;
            }, 200);

            const move = (m) => {
                if (Math.abs(m.touches[0].clientY - startY) > 10) clearTimeout(timer);
            };
            const end = () => clearTimeout(timer);
            
            el.addEventListener('touchmove', move, {once:true});
            el.addEventListener('touchend', end, {once:true});
        }, {passive:true});
    },
    
    setupTouchListeners() {
        document.addEventListener('touchmove', (e) => {
            if (!this.touchDragData) return;
            e.preventDefault();
            const touch = e.touches[0];
            
            if (this.touchDragGhost) {
                this.touchDragGhost.style.left = `${touch.clientX - 75}px`;
                this.touchDragGhost.style.top = `${touch.clientY - 20}px`;
            }

            const trackRect = UI.elements['timeline-track'].getBoundingClientRect();
            if (touch.clientX >= trackRect.left && touch.clientX <= trackRect.right &&
                touch.clientY >= trackRect.top && touch.clientY <= trackRect.bottom) {
                 this.handleDragOverTimeline(touch.clientY);
            } else {
                this.clearDropIndicator();
            }
        }, { passive: false });

        document.addEventListener('touchend', async (e) => {
            if (!this.touchDragData) return;
            const touch = e.changedTouches[0];
            
            if (this.dropIndicator) {
                const { start } = this.calculateTimeFromY(touch.clientY);
                if (this.touchDragData.type === 'scheduled') {
                    await this.repositionTimeblock(this.touchDragData, start, start + this.currentDragDuration);
                } else {
                    await this.convertUnscheduledToTimeblock(this.touchDragData, start, start + 1);
                }
            }
            
            if(this.touchDragGhost) this.touchDragGhost.remove();
            this.touchDragGhost = null;
            this.touchDragData = null;
            this.touchDragSource.style.opacity = '';
            document.body.classList.remove('touch-dragging');
            this.clearDropIndicator();
        });
    }
};