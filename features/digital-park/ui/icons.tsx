import type { ReactNode } from 'react';

export type UiIcon =
  | 'pin'
  | 'map'
  | 'follow'
  | 'gate'
  | 'tilt'
  | 'close'
  | 'walk'
  | 'stop'
  | 'search'
  | 'plus'
  | 'minus'
  | 'near'
  | 'navigate'
  | 'joystick'
  | 'heart'
  | 'heartFilled'
  | 'check'
  | 'plan'
  | 'sparkle'
  | 'up'
  | 'down'
  | 'trash'
  | 'qr'
  | 'restroom'
  | 'water';

const HEART = 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z';

const PATHS: Record<UiIcon, ReactNode> = {
  heart: <path d={HEART} />,
  heartFilled: <path d={HEART} fill="currentColor" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.8" />,
  plan: <path d="M8 6.5h12M8 12h12M8 17.5h7M4 6.5h.01M4 12h.01M4 17.5h.01M19 15.5v5M16.5 18h5" />,
  sparkle: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.500l5.1-1.9zM18.5 15.500l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  up: <path d="M12 19V6M6 11.500l6-6 6 6" />,
  down: <path d="M12 5v13M6 12.500l6 6 6-6" />,
  trash: <path d="M5 7h14M10 7V4.500h4V7M7 7l1 12.500h8L17 7M10.5 11v5M13.5 11v5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2.8" />,
  minus: <path d="M5 12h14" strokeWidth="2.8" />,
  near: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </>
  ),
  joystick: (
    <>
      <circle cx="12" cy="6.5" r="3" />
      <path d="M12 9.5v6M5 20.5h14M7.5 20.5c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" />
    </>
  ),
  navigate: <path d="M20.5 3.5L3.5 10.5l7 3 3 7z" />,
  pin: (
    <>
      <path d="M12 21.5s7-6.3 7-11.7a7 7 0 0 0-14 0c0 5.4 7 11.7 7 11.7z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  map: <path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5zM9 4v13.5M15 6.5v13.5" />,
  follow: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M5.5 20.5c.6-4.2 3.2-6.5 6.5-6.5s5.9 2.3 6.5 6.5" />
    </>
  ),
  gate: <path d="M4 21V8.5h3V21M17 21V8.5h3V21M7 11.5h10M7 15.5h10M5.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  tilt: (
    <>
      <rect x="8" y="3.5" width="8" height="15" rx="2" transform="rotate(18 12 11)" />
      <path d="M3.5 19.5c2.6 1.8 6.2 2.1 9.3 1M20.8 8.2c.6 1.6.7 3.3.3 5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  walk: (
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M13 8l-3.5 3v4M13 8l2.5 3.5 3.5 1M12.5 13l1.5 3.5V21M10.5 15l-3 6" />
    </>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1" />,
  restroom: (
    <>
      <circle cx="7" cy="5" r="1.7" />
      <path d="M5.2 9h3.6l.7 6H8.2V20H5.8v-5H4.5zM12 3.5v17" />
      <circle cx="17" cy="5" r="1.7" />
      <path d="M17 8.5l3 7h-6zM16 15.5V20M18 15.5V20" />
    </>
  ),
  water: <path d="M12 3.5s6 6.6 6 10.6a6 6 0 0 1-12 0c0-4 6-10.6 6-10.6zM9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />,
};

export function Icon({ name, size = 22 }: { name: UiIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
