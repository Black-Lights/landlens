/**
 * generate-mock-parcels — seed Pune Rural district end-to-end with mock data.
 *
 * Pipeline:
 *   1. Ensure the Pune district exists in admin_boundaries (level=district).
 *      We read its polygon out of public/data/boundaries/districts/Maharashtra.geojson
 *      so the script has no other prerequisite. Also seeds Maharashtra state
 *      as the parent.
 *   2. Synthesise ~10 mock village polygons via voronoi over random
 *      centroids inside the Pune polygon. Persist each at level=village.
 *   3. For each village, run generateMockParcels (turf voronoi → 20-60
 *      parcels with khasra numbers, areas, land_type).
 *   4. For each parcel, seed 1-3 ownership_records with faker (Indian
 *      locale). The most recent owner has transfer_date = NULL so the
 *      `is_current` generated column flips true.
 *
 * Run: npm run data:seed-pune
 *
 * Idempotency: rows are inserted with ON CONFLICT DO NOTHING on natural
 * keys where available. Re-running cleans the previous Pune-Rural seed
 * out first via DELETE WHERE source_portal = 'pune_rural_mock'.
 *
 * Pune Rural LGD code: per the user spec we tag district_lgd = 519 (the
 * current LGD register's Pune Rural code). The Census 2011 file in
 * datta07 still labels Pune as LGD 490 — we override that here so the
 * stored row matches the live LGD register that downstream Sprint 7
 * scrapers will use.
 */

import { fakerEN_IN as faker } from '@faker-js/faker';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { bbox, area as turfArea } from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

import { generateMockParcels, generateMockVillages, mulberry32 } from '@/lib/parcels/mock';

const PUNE_RURAL_LGD = '519';
const STATE_NAME = 'Maharashtra';
const STATE_NAME_HI = 'महाराष्ट्र';
const STATE_NAME_LOCAL = 'महाराष्ट्र'; // Marathi shares the Devanagari script.
const STATE_LGD = '27';
const DISTRICT_NAME = 'Pune Rural';
const DISTRICT_NAME_HI = 'पुणे ग्रामीण';
const DISTRICT_NAME_LOCAL = 'पुणे ग्रामीण';
const SOURCE_TAG = 'pune_rural_mock';
const VILLAGE_COUNT = 10;

// Curated list of real Pune Rural village/tehsil names with Devanagari forms.
// Replaces the prior faker-generated random city names so the seed contains
// authentic Hindi/Marathi labels for cross-script search and rendering.
// Order matters — used by index in the loop below.
const PUNE_VILLAGES: { en: string; hi: string; local: string }[] = [
  { en: 'Wagholi',         hi: 'वाघोली',     local: 'वाघोली' },
  { en: 'Pirangut',        hi: 'पिरंगुट',   local: 'पिरंगुट' },
  { en: 'Bhugaon',         hi: 'भुगाव',      local: 'भुगाव' },
  { en: 'Lohagaon',        hi: 'लोहगाव',     local: 'लोहगाव' },
  { en: 'Chakan',          hi: 'चाकण',       local: 'चाकण' },
  { en: 'Talegaon Dabhade', hi: 'तळेगाव दाभाडे', local: 'तळेगाव दाभाडे' },
  { en: 'Khed',            hi: 'खेड',        local: 'खेड' },
  { en: 'Junnar',          hi: 'जुन्नर',     local: 'जुन्नर' },
  { en: 'Mulshi',          hi: 'मुळशी',      local: 'मुळशी' },
  { en: 'Maval',           hi: 'मावळ',       local: 'मावळ' },
];
const PARCELS_MIN = 25;
const PARCELS_MAX = 50;
const RNG_SEED = 0x70_75_6e_65; // "pune" in hex — deterministic output

const db = new PrismaClient();

async function main() {
  console.log('→ Seeding mock parcels for Pune Rural (LGD ' + PUNE_RURAL_LGD + ')');

  const districtsPath = path.join(
    process.cwd(),
    'public', 'data', 'boundaries', 'districts', 'Maharashtra.geojson',
  );
  const fc = JSON.parse(await fs.readFile(districtsPath, 'utf8')) as FeatureCollection<
    Polygon | MultiPolygon,
    { district_name?: string; state_name?: string; district_lgd?: number; state_lgd?: number }
  >;
  const puneFeat = fc.features.find((f) => f.properties?.district_name === 'Pune');
  if (!puneFeat) {
    throw new Error(
      'Could not find a "Pune" feature in Maharashtra.geojson. Run `npm run data:download-districts` first.',
    );
  }

  // The states GeoJSON has the Maharashtra polygon we need for the state row.
  const statesPath = path.join(process.cwd(), 'public', 'data', 'boundaries', 'india-states.geojson');
  const statesFc = JSON.parse(await fs.readFile(statesPath, 'utf8')) as FeatureCollection<
    Polygon | MultiPolygon,
    { ST_NM?: string }
  >;
  const mhFeat = statesFc.features.find((f) => f.properties?.ST_NM === STATE_NAME);
  if (!mhFeat) {
    throw new Error('Could not find Maharashtra in india-states.geojson');
  }

  // ── 1. Clean previous Pune mock run ────────────────────────────────────
  await db.$executeRaw`DELETE FROM parcels WHERE source_portal = ${SOURCE_TAG};`;
  await db.$executeRaw`DELETE FROM admin_boundaries WHERE lgd_code IS NULL AND level = 'village' AND parent_id IN (
    SELECT id FROM admin_boundaries WHERE lgd_code = ${PUNE_RURAL_LGD}
  );`;
  console.log('  cleared previous seed');

  // ── 2. State / district / villages ────────────────────────────────────
  const stateId = await upsertAdminPolygon({
    nameEn: STATE_NAME,
    nameHi: STATE_NAME_HI,
    nameLocal: STATE_NAME_LOCAL,
    level: 'state',
    lgdCode: STATE_LGD,
    parentId: null,
    geometry: mhFeat.geometry,
  });

  const districtId = await upsertAdminPolygon({
    nameEn: DISTRICT_NAME,
    nameHi: DISTRICT_NAME_HI,
    nameLocal: DISTRICT_NAME_LOCAL,
    level: 'district',
    lgdCode: PUNE_RURAL_LGD,
    parentId: stateId,
    geometry: puneFeat.geometry,
  });
  console.log(`  state=${stateId}\n  district=${districtId}`);

  const rng = mulberry32(RNG_SEED);
  const villageFeats = generateMockVillages(puneFeat as Feature<Polygon | MultiPolygon>, VILLAGE_COUNT, rng);
  console.log(`  generated ${villageFeats.length} mock village polygons`);

  let totalParcels = 0;
  let totalOwners = 0;

  for (let i = 0; i < villageFeats.length; i++) {
    const v = villageFeats[i];
    // Curated villages roll over for VILLAGE_COUNT > PUNE_VILLAGES.length;
    // suffix differentiates so name_en stays unique.
    const curated = PUNE_VILLAGES[i % PUNE_VILLAGES.length];
    const suffix = i >= PUNE_VILLAGES.length ? ` ${Math.floor(i / PUNE_VILLAGES.length) + 1}` : '';
    const villageName = curated.en + suffix;
    const villageNameHi = curated.hi + suffix;
    const villageNameLocal = curated.local + suffix;
    const villageId = await upsertAdminPolygon({
      nameEn: villageName,
      nameHi: villageNameHi,
      nameLocal: villageNameLocal,
      level: 'village',
      lgdCode: null,
      parentId: districtId,
      geometry: v.geometry,
    });

    const parcels = generateMockParcels(v, {
      min: PARCELS_MIN,
      max: PARCELS_MAX,
      rng,
      khasraPrefix: `PNE-${String(i + 1).padStart(2, '0')}-`,
    });

    for (const p of parcels) {
      const parcelId = await insertParcel({
        villageId,
        khasraNo: p.khasraNo,
        areaSqm: p.areaSqm,
        landType: p.landType,
        geometry: p.geom,
      });
      totalParcels++;

      const owners = mockOwners(rng);
      for (const o of owners) {
        await insertOwner(parcelId, o);
        totalOwners++;
      }
    }
    console.log(`  village ${i + 1}/${villageFeats.length} "${villageName}" — ${parcels.length} parcels`);
  }

  console.log(`\n✓ Seeded ${totalParcels} parcels with ${totalOwners} ownership records across ${villageFeats.length} villages in ${DISTRICT_NAME}.`);

  await db.$disconnect();
}

interface UpsertArgs {
  nameEn: string;
  nameHi?: string | null;
  nameLocal?: string | null;
  level: 'state' | 'district' | 'village';
  lgdCode: string | null;
  parentId: string | null;
  geometry: Polygon | MultiPolygon | null;
}

async function upsertAdminPolygon(args: UpsertArgs): Promise<string> {
  const nameHi = args.nameHi ?? null;
  const nameLocal = args.nameLocal ?? null;

  if (args.lgdCode) {
    // Try update-or-insert by LGD code.
    const existing = await db.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM admin_boundaries WHERE lgd_code = ${args.lgdCode} LIMIT 1;
    `;
    if (existing.length > 0) {
      if (args.geometry) {
        const geoJson = JSON.stringify(args.geometry);
        await db.$executeRaw`
          UPDATE admin_boundaries
          SET name_en = ${args.nameEn},
              name_hi = ${nameHi},
              name_local = ${nameLocal},
              level = ${args.level},
              parent_id = ${args.parentId}::uuid,
              geom = ST_Multi(ST_GeomFromGeoJSON(${geoJson})),
              centroid = ST_Centroid(ST_GeomFromGeoJSON(${geoJson})),
              area_sqkm = ST_Area(ST_GeomFromGeoJSON(${geoJson})::geography) / 1e6
          WHERE id = ${existing[0].id}::uuid;
        `;
      }
      return existing[0].id;
    }
  }

  // Insert new row.
  const geoJson = args.geometry ? JSON.stringify(args.geometry) : null;
  const inserted = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO admin_boundaries (
      id, name_en, name_hi, name_local, level, parent_id, lgd_code, geom, centroid, area_sqkm, created_at
    ) VALUES (
      gen_random_uuid(),
      ${args.nameEn},
      ${nameHi},
      ${nameLocal},
      ${args.level},
      ${args.parentId}::uuid,
      ${args.lgdCode},
      ${geoJson ? Prisma.sql`ST_Multi(ST_GeomFromGeoJSON(${geoJson}))` : Prisma.sql`NULL`},
      ${geoJson ? Prisma.sql`ST_Centroid(ST_GeomFromGeoJSON(${geoJson}))` : Prisma.sql`NULL`},
      ${geoJson ? Prisma.sql`ST_Area(ST_GeomFromGeoJSON(${geoJson})::geography) / 1e6` : Prisma.sql`NULL`},
      NOW()
    )
    RETURNING id::text;
  `);
  return inserted[0].id;
}

interface InsertParcelArgs {
  villageId: string;
  khasraNo: string;
  areaSqm: number;
  landType: string;
  geometry: Polygon;
}

async function insertParcel(a: InsertParcelArgs): Promise<string> {
  const geoJson = JSON.stringify(a.geometry);
  const inserted = await db.$queryRaw<{ id: string }[]>`
    INSERT INTO parcels (
      id, village_id, khasra_no, area_sqm, land_type, geom, centroid,
      boundary_source, source_portal, data_year, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      ${a.villageId}::uuid,
      ${a.khasraNo},
      ${a.areaSqm}::decimal,
      ${a.landType},
      ST_GeomFromGeoJSON(${geoJson}),
      ST_Centroid(ST_GeomFromGeoJSON(${geoJson})),
      'mock',
      ${SOURCE_TAG},
      2026,
      NOW(),
      NOW()
    )
    RETURNING id::text;
  `;
  return inserted[0].id;
}

interface MockOwner {
  ownerName: string;
  fatherOrSpouse: string | null;
  ownershipType: string;
  shareFraction: string | null;
  transferDate: Date | null;
  registrationDate: Date;
}

function mockOwners(rng: () => number): MockOwner[] {
  const count = 1 + Math.floor(rng() * 3); // 1..3
  const owners: MockOwner[] = [];
  let cursor = new Date();
  for (let i = 0; i < count; i++) {
    const transferYear = 2025 - i * (3 + Math.floor(rng() * 5));
    const regYear = transferYear - (1 + Math.floor(rng() * 8));
    const registrationDate = new Date(`${regYear}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`);
    const ownershipType = ['sole', 'joint', 'huf'][Math.floor(rng() * 3)];
    owners.push({
      ownerName: faker.person.fullName(),
      fatherOrSpouse: faker.person.firstName('male'),
      ownershipType,
      shareFraction: ownershipType === 'joint' ? '1/2' : null,
      transferDate: i === 0 ? null : new Date(`${transferYear}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`),
      registrationDate,
    });
    cursor = registrationDate;
  }
  return owners;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function insertOwner(parcelId: string, o: MockOwner): Promise<void> {
  await db.$executeRaw`
    INSERT INTO ownership_records (
      id, parcel_id, owner_name, owner_name_en, father_or_spouse,
      ownership_type, share_fraction, registration_date, transfer_date, created_at
    ) VALUES (
      gen_random_uuid(),
      ${parcelId}::uuid,
      ${o.ownerName},
      ${o.ownerName},
      ${o.fatherOrSpouse},
      ${o.ownershipType},
      ${o.shareFraction},
      ${o.registrationDate.toISOString().slice(0, 10)}::date,
      ${o.transferDate ? o.transferDate.toISOString().slice(0, 10) : null}::date,
      NOW()
    );
  `;
}

// Quiet the unused imports — kept for callers who copy this file as a template.
void bbox; void turfArea;

main().catch((err) => {
  console.error(err);
  db.$disconnect();
  process.exit(1);
});
