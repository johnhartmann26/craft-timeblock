import { State } from './state.js';
import { Utils } from './utils.js';

export const API = {
    async fetchSchedule() {
        const dateParam = Utils.isToday(State.currentDate) ? 'today' : Utils.formatDateForApi(State.currentDate);
        const fetchUrl = `${State.apiUrl}/blocks?date=${dateParam}`;

        let response = await fetch(fetchUrl);

        // If no daily note exists (404), create one
        if (!response.ok && response.status === 404) {
            await this.createDailyNote(dateParam);
            response = await fetch(fetchUrl);
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const rawText = await response.text();
        try {
            return JSON.parse(rawText);
        } catch (e) {
            return rawText;
        }
    },

    async createDailyNote(dateParam) {
        const response = await fetch(`${State.apiUrl}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [{ type: 'text', markdown: '' }],
                position: { position: 'end', date: dateParam }
            })
        });
        if (!response.ok) throw new Error(`Failed to create daily note: ${response.status}`);
    },

    async updateBlock(blockId, markdown) {
        const response = await fetch(`${State.apiUrl}/blocks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [{ id: blockId, markdown: markdown }]
            })
        });
        if (!response.ok) throw new Error(`Failed to update: ${response.status}`);
        return response.json();
    },

    async createBlock(markdown) {
        const response = await fetch(`${State.apiUrl}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [{ type: 'text', markdown: markdown }],
                position: { position: 'end', date: 'today' } // Or specific date if needed
            })
        });
        if (!response.ok) throw new Error(`Failed to create: ${response.status}`);
        return response.json();
    },

    async deleteBlocks(blockIds) {
        const response = await fetch(`${State.apiUrl}/blocks`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockIds: blockIds })
        });
        if (!response.ok) throw new Error(`Failed to delete: ${response.status}`);
    }
};