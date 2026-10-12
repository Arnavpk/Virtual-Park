import type { Filter } from '../lib/places';
import { FilterChips } from './FilterChips';
import { Icon } from './icons';

/** Search box and category chips across the top of the map. */
export function TopBar({
  filter,
  onFilter,
  onSearch,
  onMyPark,
  onWhatNext,
  hidden,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  onSearch: () => void;
  onMyPark: () => void;
  onWhatNext: () => void;
  hidden: boolean;
}) {
  return (
    <div className={`dp-top${hidden ? ' is-hidden' : ''}`}>
      <div className="dp-top__row">
        <button type="button" className="dp-search" onClick={onSearch}>
          <Icon name="search" size={20} />
          <span>Search rides, food and more</span>
        </button>
        <button type="button" className="dp-mypark" onClick={onMyPark} aria-label="My Park: favorites, My Day and progress">
          <Icon name="heart" size={22} />
        </button>
      </div>
      <FilterChips
        value={filter}
        onChange={onFilter}
        label="Show on the map"
        lead={
          <button type="button" className="dp-chip dp-chip--next" onClick={onWhatNext}>
            <Icon name="sparkle" size={16} />
            What next?
          </button>
        }
      />
    </div>
  );
}
