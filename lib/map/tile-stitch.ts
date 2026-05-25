// Server-side static-map composer that uses MapTiler tile endpoints (free
// tier) instead of the Static Maps API (paid tier). Fetches a 2×2 grid of
// 512×512 tiles around a centre point and composites them with sharp into
// a single 1024×1024 PNG, then crops to the requested output size so the
// centre point lands at the centre of the returned image.
//
// Optionally overlays a polygon outline using an SVG layer. Polygon
// coordinates are projected into the same Web Mercator tile space so the
// overlay aligns precisely with the raster underneath.
//
// Used by:
//   - PDF "Location" image (lib/export/pdf.tsx)
//   - Dynamic per-parcel OpenGraph image (app/[locale]/parcel/[id]/opengraph-image.tsx)
//   - Saved-parcels page thumbnails via the API at /api/static-map

import sharp from 'sharp';
import type { Geometry } from 'geojson';

const TILE_SIZE = 512;
const TILE_TEMPLATE = 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg';

type StitchOptions = {
  width: number;
  height: number;
  zoom?: number;
  geometry?: Geometry | null;
};

// Web Mercator: lng/lat → fractional tile (x, y) at the given zoom.
function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  };
}

function tileUrl(z: number, x: number, y: number, key: string): string {
  return TILE_TEMPLATE.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)) + `?key=${key}`;
}

export async function stitchStaticMap(
  center: [number, number],
  opts: StitchOptions,
): Promise<Buffer | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return null;

  // When geometry is provided, pick the zoom that keeps the polygon inside
  // the output frame with ~30% padding — otherwise large parcels get
  // clipped and small ones become invisible dots. Caller's `zoom` becomes
  // the upper bound so we never zoom *past* the requested detail level.
  const zoom = opts.geometry
    ? fitZoomToGeometry(opts.geometry, opts.width, opts.height, opts.zoom ?? 17)
    : Math.round(opts.zoom ?? 16);

  // Crop centre: when geometry is supplied, use the *bbox midpoint* rather
  // than the polygon's centroid of mass. PostGIS `ST_Centroid` returns the
  // mass centroid which is offset from the bbox centre for irregular
  // shapes, and that offset is what was clipping the parcel's bottom edge
  // even when the zoom level technically fit.
  const cropCenter = opts.geometry
    ? bboxCenter(opts.geometry) ?? center
    : center;
  const { x: cx, y: cy } = lngLatToTile(cropCenter[0], cropCenter[1], zoom);

  // Anchor a 2×2 grid so the centre tile sits at floor(cx), floor(cy).
  const baseX = Math.floor(cx) - 1;
  const baseY = Math.floor(cy) - 1;
  const tiles: { col: number; row: number; x: number; y: number }[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      tiles.push({ col, row, x: baseX + col + 1, y: baseY + row + 1 });
    }
  }

  // Fetch all four tiles in parallel. Any failure aborts the stitch — better
  // to return null and let the caller fall back than to ship a half-rendered
  // composite with one black quadrant.
  let tileBuffers: { col: number; row: number; buffer: Buffer }[];
  try {
    tileBuffers = await Promise.all(
      tiles.map(async (t) => {
        const res = await fetch(tileUrl(zoom, t.x, t.y, key), { cache: 'no-store' });
        if (!res.ok) throw new Error(`tile ${t.x}/${t.y} ${res.status}`);
        return { col: t.col, row: t.row, buffer: Buffer.from(await res.arrayBuffer()) };
      }),
    );
  } catch (err) {
    console.warn('[tile-stitch] tile fetch failed', err);
    return null;
  }

  const canvasW = TILE_SIZE * 2;
  const canvasH = TILE_SIZE * 2;

  // Composite the four tiles onto a transparent canvas.
  let composite = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(
      tileBuffers.map((t) => ({
        input: t.buffer,
        top: t.row * TILE_SIZE,
        left: t.col * TILE_SIZE,
      })),
    )
    .png()
    .toBuffer();

  // The centre point on the canvas sits at the centre of the grid — but the
  // tiles round-down to whole tiles, so the actual lng/lat is offset by the
  // fractional part of (cx, cy). Compute the pixel coordinates of the centre
  // so we can crop symmetrically around it.
  const centrePxX = (cx - baseX) * TILE_SIZE;
  const centrePxY = (cy - baseY) * TILE_SIZE;

  // Optional polygon overlay via SVG.
  if (opts.geometry) {
    const svg = polygonSvg(opts.geometry, baseX, baseY, zoom, canvasW, canvasH);
    if (svg) {
      composite = await sharp(composite)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
  }

  // Crop to the requested output size, centred on the parcel.
  const left = Math.max(0, Math.min(canvasW - opts.width, Math.round(centrePxX - opts.width / 2)));
  const top = Math.max(0, Math.min(canvasH - opts.height, Math.round(centrePxY - opts.height / 2)));
  return sharp(composite)
    .extract({ left, top, width: opts.width, height: opts.height })
    .png()
    .toBuffer();
}

// Geometric centre of a polygon's bounding box. Returns null when the
// geometry isn't a polygon (or has no exterior ring).
function bboxCenter(geometry: Geometry): [number, number] | null {
  if (geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) return null;
  const ring = geometry.coordinates[0] as [number, number][];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

// Pick the highest integer zoom where the polygon's bounding box fits
// inside `width × height` with the configured padding ratio on each side.
// Walks zooms top-down so we always return the most detailed level that
// still leaves room for context. Clamped between [10, maxZoom].
const PADDING_RATIO = 0.7; // fraction of the frame the polygon may occupy

function fitZoomToGeometry(
  geometry: Geometry,
  width: number,
  height: number,
  maxZoom: number,
): number {
  if (geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) {
    return Math.round(maxZoom);
  }
  const ring = geometry.coordinates[0] as [number, number][];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  for (let z = Math.round(maxZoom); z >= 10; z--) {
    const tl = lngLatToTile(minLng, maxLat, z);
    const br = lngLatToTile(maxLng, minLat, z);
    const pxW = (br.x - tl.x) * TILE_SIZE;
    const pxH = (br.y - tl.y) * TILE_SIZE;
    if (pxW <= width * PADDING_RATIO && pxH <= height * PADDING_RATIO) {
      return z;
    }
  }
  return 10;
}

function polygonSvg(
  geometry: Geometry,
  baseTileX: number,
  baseTileY: number,
  zoom: number,
  width: number,
  height: number,
): string | null {
  if (geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) return null;
  const ring = geometry.coordinates[0] as [number, number][];
  const pts = ring
    .map(([lng, lat]) => {
      const { x, y } = lngLatToTile(lng, lat, zoom);
      return `${((x - baseTileX) * TILE_SIZE).toFixed(2)},${((y - baseTileY) * TILE_SIZE).toFixed(2)}`;
    })
    .join(' ');
  // Outline only — leaving the parcel interior transparent so the satellite
  // imagery underneath is fully readable. A thin white halo under the
  // indigo stroke keeps it legible against dark fields.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polygon points="${pts}" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="${pts}" fill="none" stroke="rgb(79,70,229)" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}
