import { useEffect, useState } from 'react';
import { parkMinutes } from '../lib/hours';

/** Park time in minutes after midnight. Re-renders on each new minute so open/closed labels stay current. */
export function useParkClock(): number {
    const [min, setMin] = useState(parkMinutes);
    useEffect(() => {
        let timer = 0;
        const tick = () => {
            setMin(parkMinutes());
            timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
        };
        tick();
        return () => window.clearTimeout(timer);
    }, []);
    return min;
}