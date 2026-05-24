/**
 * Minimal WGS84 → UTM forward conversion. Good to ~1m at most latitudes.
 * Returns null for polar latitudes outside UTM's defined range (-80..84).
 */
export type UtmCoord = {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
};

const a = 6378137;
const f = 1 / 298.257223563;
const k0 = 0.9996;
const e2 = f * (2 - f);
const ep2 = e2 / (1 - e2);

export function latLngToUtm(lat: number, lng: number): UtmCoord | null {
  if (lat < -80 || lat > 84) return null;

  const zone = Math.floor((lng + 180) / 6) + 1;
  const lambda0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);
  const lambda = lng * (Math.PI / 180);

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lambda - lambda0);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));

  if (lat < 0) northing += 10000000;

  return {
    zone,
    hemisphere: lat >= 0 ? 'N' : 'S',
    easting: Math.round(easting),
    northing: Math.round(northing),
  };
}

export function formatUtm(u: UtmCoord): string {
  return `${u.zone}${u.hemisphere} ${u.easting}E ${u.northing}N`;
}

export function formatLatLng(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}
