import { useSyncExternalStore } from 'react';
import { ATTRACTIONS } from '../data/park';
import type { Interest } from '../data/interests';

/**
 * The visitor's own state: favorites, My Day, visited places and interests.
 *
 * It is deliberately separate from the park data (data/park.ts), which never
 * changes per visitor, and from the game state (state/game.ts), which changes
 * every frame. Everything here is kept in the browser's localStorage on this
 * device only. Nothing is sent anywhere; a future account system could swap
 * the two functions `load` and `save` for calls to a server.
 */

export interface UserPark {
  favorites: string[];
  /** Planned places, in the order the visitor wants to do them. */
  myDay: string[];
  visited: string[];
  interests: Interest[];
}

const KEY = 'digital-park:visitor:v1';
const EMPTY: UserPark = { favorites: [], myDay: [], visited: [], interests: [] };
const KNOWN = new Set(ATTRACTIONS.map((a) => a.id));

function clean(value: unknown): UserPark {
  const v = (value ?? {}) as Partial<Record<keyof UserPark, unknown>>;
  // Drop anything that isn't a place in today's park data (e.g. after the map changes).
  const ids = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((id): id is string => typeof id === 'string' && KNOWN.has(id)))] : []);
  const interests = Array.isArray(v.interests) ? [...new Set(v.interests.filter((i): i is Interest => typeof i === 'string'))] : [];
  return { favorites: ids(v.favorites), myDay: ids(v.myDay), visited: ids(v.visited), interests };
}

function load(): UserPark {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? clean(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY; // storage blocked or corrupt: carry on with an empty slate
  }
}

function save(state: UserPark) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing or full storage: the state still works for this visit.
  }
}

let state: UserPark = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  state = load();
}

function update(next: UserPark) {
  state = next;
  save(state);
  listeners.forEach((l) => l());
}

const toggled = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Every change the UI can make. Each one saves straight away. */
export const userPark = {
  get(): UserPark {
    ensureLoaded();
    return state;
  },
  toggleFavorite: (id: string) => update({ ...userPark.get(), favorites: toggled(userPark.get().favorites, id) }),
  toggleMyDay: (id: string) => update({ ...userPark.get(), myDay: toggled(userPark.get().myDay, id) }),
  toggleVisited: (id: string) => update({ ...userPark.get(), visited: toggled(userPark.get().visited, id) }),
  markVisited: (id: string) => {
    if (!userPark.get().visited.includes(id)) update({ ...userPark.get(), visited: [...userPark.get().visited, id] });
  },
  toggleInterest: (interest: Interest) => update({ ...userPark.get(), interests: toggled(userPark.get().interests, interest) }),
  /** Moves a My Day entry one place earlier (-1) or later (+1). */
  moveInMyDay: (id: string, by: -1 | 1) => {
    const list = [...userPark.get().myDay];
    const i = list.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ ...userPark.get(), myDay: list });
  },
  reset: () => update(EMPTY),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the calling component when the visitor's state changes. The 3D scene never uses this. */
export function useUserPark(): UserPark {
  return useSyncExternalStore(subscribe, userPark.get, () => EMPTY);
}
