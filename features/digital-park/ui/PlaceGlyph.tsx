import type { ReactNode } from 'react';
import type { Attraction } from '../data/types';

/**
 * Icons for the lettered places (food, drinks and services), shown where the
 * map code would be: pins, the place card and list rows. Numbered rides and
 * attractions keep their number. Screen readers still get the code and name
 * from each pin's label.
 *
 * Drawn on a 24-unit grid in the current text colour, sized in em so the icon
 * follows the font size of whatever bubble it sits in.
 */
type GlyphName = 'meal' | 'noodles' | 'fries' | 'pizza' | 'icecream' | 'popcorn' | 'chaat' | 'smoothie' | 'cake' | 'drink' | 'firstaid' | 'bag' | 'gate';

/** Which icon each lettered place uses, by map code. A place not listed shows its code. */
export const PLACE_GLYPH: Record<string, GlyphName> = {
    A: 'meal', //      Windmill Cafe: mini meals
    B: 'meal', //      Zen Forest: multi-cuisine
    C: 'noodles', //   The Deck: oriental
    D: 'fries', //     Santa Maria: snacks
    E: 'pizza', //     Summer Garden: pizza & burgers
    F: 'icecream', //  Swirl Station: ice cream
    G: 'firstaid', //  First Aid
    H: 'popcorn', //   Platform 93%: kiddie snacks
    I: 'chaat', //     The Chatery: chaat
    J: 'bag', //       Essentials: merchandise
    K: 'smoothie', //  The Smoothie Life: shakes & smoothies
    L: 'cake', //      Cream Scream: cakes & bakes
    M: 'drink', //     Refuel: snacks & beverages
    gate: 'gate',
};

const SHAPES: Record<GlyphName, ReactNode> = {
    meal: (
        <>
            <path d="M6 3v5a2 2 0 0 0 4 0V3M8 3v18" />
            <path d="M17 21V3c-2.2 1.2-3.2 3.6-3.2 7v3.5H17" />
        </>
    ),
    noodles: (
        <>
            <path d="M3 12h18a9 9 0 0 1-18 0Z" />
            <path d="M9 12 14.5 2.5M12.5 12 20 4" />
        </>
    ),
    fries: (
        <>
            <path d="M8 3.5V11M11 2.5V11M14 3V11M17 5V11" />
            <path d="M5.5 11h13l-1.6 10H7.1Z" />
        </>
    ),
    pizza: (
        <>
            <path d="M12 21.5 3.5 7a16 16 0 0 1 17 0Z" />
            <path d="M5.4 10.2a13 13 0 0 1 13.2 0" />
            <circle cx="10" cy="12.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="13.6" cy="13.8" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </>
    ),
    icecream: (
        <>
            <path d="M6.8 11 12 22l5.2-11" />
            <path d="M5.8 11h12.4M6.5 11a5.5 5.5 0 1 1 11 0" />
        </>
    ),
    popcorn: (
        <>
            <path d="M5.5 10h13l-1.8 11H7.3Z" />
            <path d="M10 10l.5 11M14 10l-.5 11" />
            <path d="M5.5 10a2.2 2.2 0 0 1 2.2-3.3A2.6 2.6 0 0 1 12 4.5a2.6 2.6 0 0 1 4.3 2.2 2.2 2.2 0 0 1 2.2 3.3" />
        </>
    ),
    chaat: (
        <>
            <path d="M3 13h18a9 9 0 0 1-18 0Z" />
            <path d="M8 13a2.5 2.5 0 0 1 4-2 2.5 2.5 0 0 1 4 2" />
            <path d="M15 9.5 20 3" />
        </>
    ),
    smoothie: (
        <>
            <path d="M6.5 8.5h11L16 21.5H8Z" />
            <path d="M12.5 8.5 15 2.5h3" />
            <path d="M7 12.5h10" />
        </>
    ),
    cake: (
        <>
            <path d="M4 21h16M5.5 21v-8h13v8" />
            <path d="M5.5 16.5c2.2 1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0" />
            <path d="M12 13V9.5" />
            <path d="M12 7.2c-1.1-1-.4-2.4 0-4 .4 1.6 1.1 3 0 4Z" fill="currentColor" />
        </>
    ),
    drink: (
        <>
            <path d="M10 2h4M10.5 2v3.2L9 8v12.3a.7.7 0 0 0 .7.7h4.6a.7.7 0 0 0 .7-.7V8l-1.5-2.8V2" />
            <path d="M9 12h6v4H9" />
        </>
    ),
    firstaid: <path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6Z" />,
    bag: (
        <>
            <path d="M4.5 8h15l-1.2 13H5.7Z" />
            <path d="M9 10.5V6.5a3 3 0 0 1 6 0v4" />
        </>
    ),

    gate: (
        <>
            <path d="M3 8h13M12 4l4 4-4 4" />
            <path d="M21 16H8M12 12l-4 4 4 4" />
        </>
    ),
};

/** The place's icon, or its map code when it has none. Put it inside the existing code bubble. */
export function PlaceGlyph({ place }: { place: Attraction }) {
    const name = PLACE_GLYPH[place.id];
    if (!name) return <>{place.id}</>;
    return (
        <svg className="dp-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {SHAPES[name]}
        </svg>
    );
}