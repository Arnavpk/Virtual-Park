import { RIDE_HOURS } from '../data/hours';

/**
 * Opening hours: whether a place is open, and wording for it. All times are
 * minutes after midnight, park time. The park is in India (UTC+5:30, no
 * daylight saving), so park time is worked out from UTC and is right even when
 * the phone is set to another timezone.
 */

const PARK_UTC_OFFSET_MIN = 330;
/** "Closing soon" this many minutes before a ride closes. */
export const CLOSING_SOON_MIN = 30;

const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
/** Sessions per place as [open, close) in minutes, earliest first. */
const SESSIONS: Record<string, [number, number][]> = Object.fromEntries(
    Object.entries(RIDE_HOURS).map(([id, list]) => [id, list.map(([a, b]) => [toMin(a), toMin(b)] as [number, number]).sort((x, y) => x[0] - y[0])]),
);

// ----- Park clock

let offsetMin = 0;

/** Minutes after midnight, park time, now (plus any test offset). */
export function parkMinutes(): number {
    const m = Math.floor(Date.now() / 60000) + PARK_UTC_OFFSET_MIN + offsetMin;
    return ((m % 1440) + 1440) % 1440;
}

/**
 * Developer testing: `?clock=14:55` in the address runs the park clock from
 * 2:55 PM, still ticking. Call once at start-up, and only with dev tools on.
 */
export function readClockParam() {
    const v = new URLSearchParams(window.location.search).get('clock');
    if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return;
    offsetMin = 0;
    offsetMin = toMin(v) - parkMinutes();
}

// ----- Status

export type HoursState =
    | { state: 'always' }
    | { state: 'open'; closesAt: number; soon: boolean }
    /** Not open yet: before its first session (`onBreak` false) or between sessions (`onBreak` true). */
    | { state: 'later'; opensAt: number; onBreak: boolean }
    | { state: 'done' };

export function hoursState(id: string, min: number): HoursState {
    const s = SESSIONS[id];
    if (!s) return { state: 'always' };
    for (let i = 0; i < s.length; i++) {
        const [a, b] = s[i];
        if (min < a) return { state: 'later', opensAt: a, onBreak: i > 0 };
        if (min < b) return { state: 'open', closesAt: b, soon: b - min <= CLOSING_SOON_MIN };
    }
    return { state: 'done' };
}

export const isOpenAt = (id: string, min: number) => {
    const h = hoursState(id, min);
    return h.state === 'always' || h.state === 'open';
};

/** Whether a place will be open when the visitor gets there, given the walk in metres. */
export const openWhenReached = (id: string, now: number, metres: number, metresPerMin: number) =>
    isOpenAt(id, now + (Number.isFinite(metres) ? metres / metresPerMin : 0));

/**
 * For the 3D rides, every frame: is this ride running right now?
 * Worked out once a minute, not per frame.
 */
let cacheMin = -1;
const running = new Map<string, boolean>();
export function rideRunning(id: string): boolean {
    const m = parkMinutes();
    if (m !== cacheMin) {
        cacheMin = m;
        running.clear();
    }
    let r = running.get(id);
    if (r === undefined) {
        r = isOpenAt(id, m);
        running.set(id, r);
    }
    return r;
}

// ----- Wording

/** 13:00 → "1:00 PM" */
export function formatClock(min: number): string {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Today's hours in one line: "11:00 AM – 1:00 PM, 3:00 PM – 6:00 PM". Empty for always-open places. */
export const formatHours = (id: string) => (SESSIONS[id] ?? []).map(([a, b]) => `${formatClock(a)} – ${formatClock(b)}`).join(', ');

export function hoursText(h: HoursState): string {
    switch (h.state) {
        case 'always':
            return 'Open';
        case 'open':
            return h.soon ? `Closing soon, at ${formatClock(h.closesAt)}` : `Open until ${formatClock(h.closesAt)}`;
        case 'later':
            return h.onBreak ? `On a break, back at ${formatClock(h.opensAt)}` : `Opens at ${formatClock(h.opensAt)}`;
        case 'done':
            return 'Closed for today';
    }
}

/** A short label for pins and lists, or null while the place is open. */
export function closedLabel(h: HoursState): string | null {
    if (h.state === 'later') return `Opens ${formatClock(h.opensAt)}`;
    if (h.state === 'done') return 'Closed';
    return null;
}

/** Warns when a place that is open now will have closed by the time the visitor walks there. */
export function arrivalWarning(id: string, now: number, walkMin: number): string | null {
    if (!isOpenAt(id, now)) return null; // the status line already says it is closed
    const at = hoursState(id, now + walkMin);
    if (at.state === 'later') return `It goes on a break before you'd get there. Back at ${formatClock(at.opensAt)}.`;
    if (at.state === 'done') return "It closes for today before you'd get there.";
    return null;
}