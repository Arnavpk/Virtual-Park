/** Checks the recommendation and progress rules. Run with: npm run test:recommend */
import { ATTRACTIONS } from '../features/digital-park/data/park';
import { INTERESTS, interestMatch } from '../features/digital-park/data/interests';
import { isExplorable, progress, recommend, whatNext } from '../features/digital-park/lib/recommend';
import type { UserPark } from '../features/digital-park/state/userPark';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const user = (u: Partial<UserPark> = {}): UserPark => ({ favorites: [], myDay: [], visited: [], interests: [], ...u });
const byId = (id: string) => ATTRACTIONS.find((a) => a.id === id)!;

// A made-up set of distances: every place 200 m away unless stated.
const dist = (over: Record<string, number> = {}) => new Map(ATTRACTIONS.map((a) => [a.id, over[a.id] ?? 200]));
const top = (u: UserPark, d = dist(), n = 5) => recommend({ places: ATTRACTIONS, metres: d, user: u, limit: n }).map((s) => s.place.id);

// ---- distance
check('with no preferences, the nearest ride comes first', top(user(), dist({ '9': 40 }))[0] === '9');
check('...and nearer beats farther', (() => {
  const t = top(user(), dist({ '9': 40, '8': 90 }));
  return t[0] === '9' && t[1] === '8';
})());
check('services are never recommended', !recommend({ places: ATTRACTIONS, metres: dist({ G: 5, J: 5 }), user: user() }).some((s) => s.place.category === 'service'));
check('food is not pushed unless asked for', !top(user(), dist({ A: 150 }), 10).includes('A') && top(user(), dist({ A: 30 }), 3).includes('A') === false, top(user(), dist({ A: 30 }), 3).join(','));

// ---- preferences
const thrill = top(user({ interests: ['thrill'] }), dist(), 4);
check('High thrill preference brings the high-thrill rides to the top', thrill.every((id) => byId(id).type === 'high'), thrill.map((id) => byId(id).name).join(', '));
check('...and a preference outweighs a modest distance gap', top(user({ interests: ['thrill'] }), dist({ '9': 120, '22': 250 }))[0] !== '9');
check('...but not a long walk', top(user({ interests: ['thrill'] }), dist({ '9': 30, '2': 600, '18': 600, '22': 600, '25': 600 }))[0] === '9');
const kids = top(user({ interests: ['kids'] }), dist(), 4);
check('Kids preference brings kids rides and the play area', kids.every((id) => interestMatch(byId(id), 'kids') === 1), kids.join(','));
check('Food preference brings food forward', byId(top(user({ interests: ['food'] }), dist({ F: 60 }))[0]).category === 'food');
check('changing preferences changes the list', top(user({ interests: ['thrill'] })).join() !== top(user({ interests: ['kids'] })).join());
check('every interest matches at least one place', INTERESTS.every((i) => ATTRACTIONS.some((a) => interestMatch(a, i.id) > 0)));

// ---- favorites, My Day, visited
check('a favorite is lifted above an equal neighbour', top(user({ favorites: ['12'] }))[0] === '12');
check('a My Day item is lifted higher still', top(user({ favorites: ['12'], myDay: ['20'] }))[0] === '20');
check('the first unvisited My Day item is "next"', (() => {
  const s = recommend({ places: ATTRACTIONS, metres: dist(), user: user({ myDay: ['20', '21'], visited: ['20'] }) })[0];
  return s.place.id === '21' && s.reason === 'Next on your My Day list';
})());
check('visited places sink below unvisited ones', (() => {
  const all = recommend({ places: ATTRACTIONS, metres: dist({ '9': 10 }), user: user({ visited: ['9'] }) });
  const firstVisited = all.findIndex((s) => s.visited);
  return firstVisited === all.length - 1 && all[firstVisited].place.id === '9';
})());
check('"what next" never offers a visited place', whatNext({ places: ATTRACTIONS, metres: dist({ '9': 10 }), user: user({ visited: ['9'] }) })!.place.id !== '9');
check('"what next" can leave out where you are standing', whatNext({ places: ATTRACTIONS, metres: dist({ '9': 10 }), user: user(), exclude: ['9'] })!.place.id !== '9');
const everything = ATTRACTIONS.filter((a) => a.category !== 'service').map((a) => a.id);
check('"what next" is empty once everything has been visited', whatNext({ places: ATTRACTIONS, metres: dist(), user: user({ visited: everything }) }) === null);
check('same inputs give the same order every time', top(user({ interests: ['family'] }), dist(), 12).join() === top(user({ interests: ['family'] }), dist(), 12).join());
check('reasons are filled in', recommend({ places: ATTRACTIONS, metres: dist(), user: user({ interests: ['water'] }) }).every((s) => s.reason.length > 0));

// ---- progress
const total = ATTRACTIONS.filter(isExplorable).length;
const p0 = progress(ATTRACTIONS, user());
const p1 = progress(ATTRACTIONS, user({ visited: ['1', '2', '3', 'A', 'G'] }));
check('progress total comes from the data', p0.total === total && p0.done === 0 && p0.percent === 0, `${total} explorable places`);
check('progress counts rides and attractions, not cafes or services', p1.done === 3 && p1.percent === Math.round((3 / total) * 100), `${p1.done} of ${p1.total}, ${p1.percent}%`);
check('progress follows the dataset if it shrinks', progress(ATTRACTIONS.slice(0, 10), user({ visited: ['1'] })).total === ATTRACTIONS.slice(0, 10).filter(isExplorable).length);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll recommendation checks passed.');
