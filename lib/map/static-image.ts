// MapTiler Static Maps API URL builder. Used by the Saved page (thumbnails),
// the PDF report (inline mini-map), and the dynamic OpenGraph image.
//
// Docs: https://docs.maptiler.com/cloud/api/static-maps/
//
// We always pass a polygon overlay outlining the parcel so the snapshot is
// recognisable even at small sizes.

import type { Geometry } from 'geojson';

type Options = {
  width: number;
  height: number;
  zoom?: number;
  style?: 'satellite' | 'streets-v2';
  // Polygon to outline (LineString / Polygon GeoJSON).
  geometry?: Geometry | null;
};

export function staticMapUrl(
  center: [number, number],
  opts: Options,
): string | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return null;

  const style = opts.style ?? 'satellite';
  const zoom = opts.zoom ?? 16;
  const [lng, lat] = center;

  const overlay = polygonOverlay(opts.geometry);
  const overlayParam = overlay ? `&path=${encodeURIComponent(overlay)}` : '';

  return `https://api.maptiler.com/maps/${style}/static/${lng},${lat},${zoom}/${opts.width}x${opts.height}.png?key=${key}${overlayParam}`;
}

// Encode a polygon outline as MapTiler's `path` param.
// Format (per https://docs.maptiler.com/cloud/api/static-maps/#paths):
//   fill / stroke must be rgb(), rgba(), or #RRGGBB — bare hex is rejected.
//   pipes separate the parameter blocks and the lng,lat point list.
function polygonOverlay(geometry: Geometry | null | undefined): string | null {
  if (!geometry) return null;
  if (geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) return null;
  const ring = geometry.coordinates[0] as [number, number][];
  // MapTiler caps path length — sample down so the URL stays well under
  // the ~2KB practical limit for query strings.
  const sampled = sampleRing(ring, 24);
  const points = sampled.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join('|');
  return `fill:rgba(79,70,229,0.35)|stroke:rgb(79,70,229)|width:3|${points}`;
}

function sampleRing(ring: [number, number][], target: number): [number, number][] {
  if (ring.length <= target) return ring;
  const step = ring.length / target;
  const out: [number, number][] = [];
  for (let i = 0; i < target; i++) {
    out.push(ring[Math.floor(i * step)]);
  }
  // Always close the ring.
  out.push(ring[0]);
  return out;
}
