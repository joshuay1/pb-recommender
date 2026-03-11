// Lightweight local logger used for development and A/B experiments.
// Stores events in localStorage and provides a small API compatible with the rest of the app.

type EventRecord = {
	userId?: string | null;
	type: string;
	payload?: any;
	ts?: number;
};

const STORAGE_KEY = 'pb_local_events_v1';

function readEvents(): EventRecord[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch (e) {
		return [];
	}
}

function writeEvents(events: EventRecord[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-1000)));
	} catch (e) {
		// ignore storage errors
	}
}

const LocalLogger = {
	recordEvent(event: EventRecord) {
		const ev = { ...event, ts: event.ts ?? Date.now() };
		const events = readEvents();
		events.push(ev);
		writeEvents(events);
		// also mirror to console for development convenience
		console.debug('Brisk-log ', ev);
		return ev;
	},
	getEvents(): EventRecord[] {
		return readEvents();
	},
	clear() {
		try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
	}
};

export default LocalLogger;
