// OSM Overpass — fetch administrative polygons (admin_level=7|8 = village/block)
// inside a bounding box. Used as the source-of-truth for village boundaries
// before any state portal scraper (Sprint 7) is wired.
//
// We intentionally keep this dependency-light: no osmtogeojson library, just
// parse the Overpass JSON result into geojson Polygons by walking members.
// Tehsil/block coverage in OSM is incomplete; expect partial results.

import type { Feature, FeatureCollection, Polygon } from 'geojson';

const OVERPASS_ENDPOINT = process.env.OVERPASS_ENDPOINT ?? 'https://overpass-api.de/api/interpreter';

export type AdminLevelTarget = 7 | 8;

type OverpassNode = { type: 'node'; id: number; lat: number; lon: number };
type OverpassWay = { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> };
type OverpassRel = {
  type: 'relation';
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
};
type OverpassEl = OverpassNode | OverpassWay | OverpassRel;
type OverpassResponse = { elements: OverpassEl[] };

export interface OverpassVillageFC extends FeatureCollection<Polygon, OverpassVillageProps> {}
export interface OverpassVillageProps {
  osm_id: number;
  name: string;
  name_local?: string;
  admin_level: number;
}

/** Build the Overpass QL for admin polygons in a bbox. */
export function buildVillageQuery(bbox: [number, number, number, number]): string {
  // bbox is [west, south, east, north] in lng/lat; Overpass wants south,west,north,east
  const [w, s, e, n] = bbox;
  return `[out:json][timeout:60];
(
  way["boundary"="administrative"]["admin_level"~"^(7|8)$"](${s},${w},${n},${e});
  relation["boundary"="administrative"]["admin_level"~"^(7|8)$"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;
}

export async function fetchVillagePolygons(
  bbox: [number, number, number, number],
  signal?: AbortSignal,
): Promise<OverpassVillageFC> {
  const query = buildVillageQuery(bbox);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) {
    throw new Error(`Overpass error ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const json = (await res.json()) as OverpassResponse;
  return parseOverpass(json);
}

function parseOverpass(json: OverpassResponse): OverpassVillageFC {
  const nodes = new Map<number, [number, number]>();
  const ways = new Map<number, OverpassWay>();
  const rels: OverpassRel[] = [];

  for (const el of json.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
    else if (el.type === 'way') ways.set(el.id, el);
    else if (el.type === 'relation') rels.push(el);
  }

  const features: Feature<Polygon, OverpassVillageProps>[] = [];

  // Closed ways with admin tags ↔ direct polygons
  for (const w of ways.values()) {
    if (!w.tags?.boundary || w.tags.boundary !== 'administrative') continue;
    const lvl = Number(w.tags.admin_level);
    if (lvl !== 7 && lvl !== 8) continue;
    const ring = w.nodes.map((id) => nodes.get(id)).filter(Boolean) as [number, number][];
    if (ring.length < 4) continue;
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        osm_id: w.id,
        name: w.tags.name ?? 'Unnamed',
        name_local: w.tags['name:hi'] ?? w.tags['name:mr'] ?? undefined,
        admin_level: lvl,
      },
    });
  }

  // Relations: stitch outer ways into a ring (single-outer relations only —
  // multipart polygons we collapse to the first outer to keep this simple).
  for (const r of rels) {
    if (!r.tags?.boundary || r.tags.boundary !== 'administrative') continue;
    const lvl = Number(r.tags.admin_level);
    if (lvl !== 7 && lvl !== 8) continue;
    const outers = r.members.filter((m) => m.type === 'way' && m.role === 'outer');
    if (outers.length === 0) continue;
    const ring = stitchWays(outers.map((m) => ways.get(m.ref)).filter((w): w is OverpassWay => Boolean(w)), nodes);
    if (!ring || ring.length < 4) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        osm_id: r.id,
        name: r.tags.name ?? 'Unnamed',
        name_local: r.tags['name:hi'] ?? r.tags['name:mr'] ?? undefined,
        admin_level: lvl,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

function stitchWays(ways: OverpassWay[], nodes: Map<number, [number, number]>): [number, number][] | null {
  if (ways.length === 0) return null;
  const segments = ways.map((w) => w.nodes.slice());
  const ring: number[] = segments.shift()!;
  while (segments.length > 0) {
    const tail = ring[ring.length - 1];
    const idx = segments.findIndex((s) => s[0] === tail || s[s.length - 1] === tail);
    if (idx === -1) break;
    let seg = segments.splice(idx, 1)[0];
    if (seg[seg.length - 1] === tail) seg = seg.reverse();
    ring.push(...seg.slice(1));
  }
  // Close
  if (ring[0] !== ring[ring.length - 1]) ring.push(ring[0]);
  const coords = ring.map((id) => nodes.get(id)).filter(Boolean) as [number, number][];
  return coords;
}
