// Dynamic Open Graph image for a parcel.
// Rendered on demand via Next's built-in ImageResponse (Satori under the hood)
// at /[locale]/parcel/[id]/opengraph-image.
//
// Composition:
//   - Left: parcel summary (khasra, village/district/state, area)
//   - Right: MapTiler static-map snapshot with the parcel outlined
//   - Footer: LandLens watermark + tagline (translated)

import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { staticMapUrl } from '@/lib/map/static-image';
import { getTranslations } from 'next-intl/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1200×630 is the de facto standard for Open Graph + Twitter.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LandLens parcel snapshot';

interface Row {
  khasra_no: string | null;
  area_acres: string | null;
  area_sqm: string;
  village_name: string | null;
  district_name: string | null;
  state_name: string | null;
  centroid_lng: number | null;
  centroid_lat: number | null;
  geometry: string;
}

export default async function ParcelOgImage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'Site' });

  // Defensive: bail to a generic image if the id isn't a UUID.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return new ImageResponse(<Fallback tagline={t('ogTagline')} />, { ...size });
  }

  const rows = await db.$queryRaw<Row[]>`
    SELECT
      p.khasra_no,
      p.area_acres::text,
      p.area_sqm::text,
      v.name_en  AS village_name,
      d.name_en  AS district_name,
      s.name_en  AS state_name,
      ST_X(p.centroid)::float AS centroid_lng,
      ST_Y(p.centroid)::float AS centroid_lat,
      ST_AsGeoJSON(p.geom) AS geometry
    FROM parcels p
    LEFT JOIN admin_boundaries v ON v.id = p.village_id
    LEFT JOIN admin_boundaries d ON d.id = v.parent_id
    LEFT JOIN admin_boundaries s ON s.id = d.parent_id
    WHERE p.id = ${params.id}::uuid
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return new ImageResponse(<Fallback tagline={t('ogTagline')} />, { ...size });
  }
  const r = rows[0];
  const acres = r.area_acres ? Number(r.area_acres).toFixed(2) : (Number(r.area_sqm) / 4046.86).toFixed(2);
  const breadcrumb = [r.village_name, r.district_name, r.state_name].filter(Boolean).join(' · ');
  const center = r.centroid_lng != null && r.centroid_lat != null
    ? [r.centroid_lng, r.centroid_lat] as [number, number]
    : null;
  const mapUrl = center
    ? staticMapUrl(center, { width: 600, height: 630, zoom: 16, style: 'satellite', geometry: JSON.parse(r.geometry) })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #4F46E5 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, opacity: 0.75, letterSpacing: 1 }}>LANDLENS</span>
            <span style={{ fontSize: 56, fontWeight: 700, marginTop: 28, lineHeight: 1.1 }}>
              Khasra {r.khasra_no ?? '—'}
            </span>
            <span style={{ fontSize: 26, opacity: 0.85, marginTop: 12 }}>
              {breadcrumb || 'India'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 18, opacity: 0.6, letterSpacing: 0.5 }}>AREA</span>
            <span style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>{acres} acres</span>
            <span style={{ fontSize: 18, marginTop: 28, opacity: 0.75 }}>{t('ogTagline')}</span>
          </div>
        </div>

        <div style={{ width: 600, height: '100%', display: 'flex', position: 'relative' }}>
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt="" width={600} height={630} style={{ width: 600, height: 630, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#312e81', display: 'flex' }} />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxShadow: 'inset 16px 0 32px rgba(30, 27, 75, 0.7)',
              display: 'flex',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}

function Fallback({ tagline }: { tagline: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #4F46E5 100%)',
        color: '#fff',
        fontFamily: 'sans-serif',
        padding: 80,
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.7, letterSpacing: 2 }}>LANDLENS</span>
      <span style={{ fontSize: 72, fontWeight: 700, marginTop: 18 }}>{tagline}</span>
    </div>
  );
}
