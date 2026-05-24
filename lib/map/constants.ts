// India centroid + default view bounds. MapLibre uses [lng, lat] order.
export const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
export const INDIA_DEFAULT_ZOOM = 4.2;
// Loose bbox guarding pan: [west, south, east, north]
export const INDIA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [60, 5],
  [100, 38],
];

export type DrillLevel = 'india' | 'state' | 'district' | 'tehsil' | 'village';

export const DRILL_ZOOM: Record<DrillLevel, number> = {
  india: INDIA_DEFAULT_ZOOM,
  state: 7,
  district: 9,
  tehsil: 11,
  village: 13,
};

// Land-type palette — used by the parcel fill layer and badges.
export const LAND_TYPE_COLORS: Record<string, string> = {
  agricultural: '#84cc16',  // lime-500
  residential:  '#f59e0b',  // amber-500
  commercial:   '#a855f7',  // purple-500
  industrial:   '#64748b',  // slate-500
  forest:       '#15803d',  // green-700
  government:   '#0ea5e9',  // sky-500
  water_body:   '#06b6d4',  // cyan-500
  wasteland:    '#a8a29e',  // stone-400
  mixed:        '#ec4899',  // pink-500
};

export const LAND_TYPES = Object.keys(LAND_TYPE_COLORS);

