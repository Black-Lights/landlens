// /[locale]/parcel/[id] — share-friendly URL for a parcel. The page itself
// just redirects to the map with `?parcel=<id>` so the map opens with that
// parcel's sidebar; the value of this route is the OG image neighbour at
// `opengraph-image.tsx` which gives social shares a rich preview.

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Row {
  khasra_no: string | null;
  village_name: string | null;
  district_name: string | null;
  state_name: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Site' });

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return { title: 'Parcel', description: t('metaDescription') };
  }
  const rows = await db.$queryRaw<Row[]>`
    SELECT p.khasra_no, v.name_en AS village_name, d.name_en AS district_name, s.name_en AS state_name
    FROM parcels p
    LEFT JOIN admin_boundaries v ON v.id = p.village_id
    LEFT JOIN admin_boundaries d ON d.id = v.parent_id
    LEFT JOIN admin_boundaries s ON s.id = d.parent_id
    WHERE p.id = ${params.id}::uuid
    LIMIT 1;
  `;
  const r = rows[0];
  const title = r?.khasra_no ? `Khasra ${r.khasra_no}` : 'Parcel';
  const place = [r?.village_name, r?.district_name, r?.state_name].filter(Boolean).join(', ');
  return {
    title,
    description: place ? `${title} · ${place} — LandLens` : t('metaDescription'),
  };
}

export default function ParcelRedirectPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  redirect(`/${params.locale}/?parcel=${params.id}`);
}
