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
