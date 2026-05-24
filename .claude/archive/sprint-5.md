## Sprint 5 — Internationalization (closed 2026-05-24)

### What was built

**Full message catalogs for the three launch locales**
- `messages/en.json`, `messages/hi.json`, `messages/ur.json` — every user-facing string in the app translated. Sprint 1 stub catalogs were replaced wholesale.
- Namespaces: `Common`, `Header`, `LanguageSwitcher`, `Breadcrumb`, `Basemap`, `LocateMe`, `NorthArrow`, `CoordReadout`, `ParcelSidebar`, `Ownership`, `LandType`, `BoundarySource`, `Search`, `Errors`.
- Cadastral terminology translated consistently across hi/ur: *Khasra → खसरा / کھسرہ*, *Khatauni → खतौनी / کھتونی*, *Tehsil → तहसील / تحصیل*, *Village → गाँव / گاؤں*. Land-type and ownership-type vocabularies translated too (agricultural → कृषि / زرعی, joint → संयुक्त / مشترکہ, etc.).
- Search section labels (States/Districts/Villages/Khasra Nos/Owners), the placeholder, the `↑↓ navigate / ↵ open / esc close` footer, and the `tryHint` were all internationalized. The `pg_trgm`-powered footer line stays branded but its lead-in is translated.
- LandType and BoundarySource maps use keyed translations (the same string keys as `LAND_TYPE_COLORS` in `lib/map/constants.ts`), so adding a new land type only needs a new key per catalogue.

**Language switcher (`components/nav/LanguageSwitcher.tsx`)**
- Globe icon button + dropdown listing all three locales in their native script (English / हिन्दी / اردو) with the appropriate font class on each row so the script renders correctly even before the active locale's font is loaded.
- Floating top-right of the map, offset 60px to the left of `BasemapSwitcher` in LTR and 60px to the right in RTL — done with the Tailwind `rtl:` modifier on the wrapping `<div>` in `MapClient`.
- On selection, calls `router.replace(pathname, { locale: next })` from next-intl's shared-pathnames navigation helper, which keeps the user on the same page under the new locale prefix. We also explicitly set the `NEXT_LOCALE` cookie with `Max-Age=1y` client-side so a hard refresh doesn't re-trigger detection (middleware also sets it on the response, but the manual write closes the race window).
- Closes on outside click and `Escape`.

**Locale-scoped font loading (`i18n/fonts.ts`)**
- All three fonts declared via `next/font/google` (Inter, Noto Sans Devanagari, Noto Nastaliq Urdu) and exposed as CSS variables (`--font-sans`, `--font-devanagari`, `--font-nastaliq`).
- Each font helper opts out of `preload` for non-Latin scripts so English users don't pull Devanagari or Nastaliq `.woff2` files (the `@font-face` only resolves when the locale-scoped class is applied).
- `localeFontClass(locale)` returns the class string to apply on `<html>` in `app/[locale]/layout.tsx`. Confirmed in the rendered HTML:
  - `/en` → `class="__variable_<inter> font-sans"`
  - `/hi` → `class="__variable_<inter> __variable_<devanagari> font-devanagari"`
  - `/ur` → `class="__variable_<inter> __variable_<nastaliq> font-nastaliq"`
- `tailwind.config.ts` `fontFamily` entries now reference the CSS variables, falling back to the system names. The previous hardcoded family entries would have broken under next/font's hashed family names.

**RTL polish**
- `<html dir>` is set from `isRtl(locale)` in `app/[locale]/layout.tsx`.
- `ParcelSidebar` slides in from the right by default and from the left in RTL: `md:rtl:right-auto md:rtl:left-0 md:rtl:rounded-l-none md:rtl:rounded-r-2xl`. Closed state mirrors `md:rtl:-translate-x-full`. Mobile bottom-sheet behavior is unchanged in both directions.
- `Breadcrumb`'s chevron separator uses `rtl:-scale-x-100` so the arrow points the correct way without swapping the icon.
- `OwnershipTimeline` flips its vertical rail and avatar dots to the right edge in RTL via `rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-4` plus `rtl:-right-[21px]` on the marker.
- `SearchPalette` uses logical `ms-2` (margin-start) on the type-tag, so the small "state/district/village" caption aligns to the trailing edge in both directions.
- `MapView`'s search button uses logical `ps-3 pe-3.5` (padding start/end) instead of `pl-3 pr-3.5` so its kbd hint sits on the trailing edge.
- Map controls themselves do NOT mirror: `BasemapSwitcher` (`right-3 top-3`), `NorthArrow` (`right-3 top-16`), `LocateMe` (`right-4 bottom-24`), `CoordReadout` (`left-1/2 bottom-3`), MapLibre's `NavigationControl/ScaleControl/AttributionControl` all use physical positioning — exactly as the spec asked.

**Locale-aware date formatting**
- `OwnershipTimeline.fmtDate` uses `new Intl.DateTimeFormat(\`${locale}-IN-u-nu-latn\`, { year: 'numeric', month: 'short' })` so registration/transfer dates format as:
  - en → `Feb 2022`
  - hi → `फ़र॰ 2022`
  - ur → `فروری 2022`
- `numberingSystem: 'latn'` (via the `-u-nu-latn` Unicode extension) explicitly forces Indo-Arabic digits even on `ur-IN`, where the default would emit Eastern Arabic numerals (١,٢,٣). Indian Urdu uses Western digits per editorial convention, so the catalogues never need to override.
- `ParcelSidebar` applies the same locale tag to `Intl.NumberFormat` for the area readouts so they stay in Latin digits across locales.

**Browser-language detection + cookie persistence**
- `middleware.ts` is unchanged — next-intl's `createMiddleware` already does the detection order we wanted (URL prefix → cookie → `Accept-Language` → defaultLocale) and writes `NEXT_LOCALE` on the response when the user navigates to a new prefix.
- Verified by hitting `/` on the dev server: middleware redirects with `307` to the matched locale prefix. Hitting `/en`, `/hi`, `/ur` each returns `200` with the correct `<html lang>` / `dir`.

**Multilingual seed data (`scripts/generate-mock-parcels.ts`)**
- `upsertAdminPolygon` now takes `nameHi` and `nameLocal` and writes both columns on insert + update.
- Maharashtra state → `name_hi='महाराष्ट्र', name_local='महाराष्ट्र'` (Marathi shares the Devanagari script).
- Pune Rural district → `name_hi='पुणे ग्रामीण', name_local='पुणे ग्रामीण'`.
- Mock villages no longer use random `faker.location.city()` names. A curated list of 10 real Pune Rural village/tehsil names with their Devanagari forms replaces it: Wagholi/वाघोली, Pirangut/पिरंगुट, Bhugaon/भुगाव, Lohagaon/लोहगाव, Chakan/चाकण, Talegaon Dabhade/तळेगाव दाभाडे, Khed/खेड, Junnar/जुन्नर, Mulshi/मुळशी, Maval/मावळ. The list cycles with a numeric suffix if `VILLAGE_COUNT` ever exceeds the curated set.
- Existing rows are updated on re-seed because `upsertAdminPolygon` flows `name_hi` / `name_local` through the LGD-key `UPDATE` branch too.
- Cross-script search benefits immediately: typing `Pune` and `पुणे` both match the district; `Wagholi` and `वाघोली` both match the village.

**Privacy + DPDP alignment**
- Locale switch is in-memory + cookie only (`NEXT_LOCALE`, Max-Age 1 year, SameSite=Lax). No backend record of the user's language choice.
- No new PII collected. The cookie value is the locale code (`en`/`hi`/`ur`) only.

### Files changed

| File | Change |
| --- | --- |
| `messages/en.json` · `messages/hi.json` · `messages/ur.json` | Sprint 1 stubs replaced with full catalogs |
| `i18n/config.ts` | (unchanged — locales/isRtl already in place from Sprint 1) |
| `i18n/navigation.ts` | **NEW** — `createSharedPathnamesNavigation` export for the language switcher |
| `i18n/fonts.ts` | **NEW** — locale-scoped Inter / Devanagari / Nastaliq via `next/font/google` |
| `app/[locale]/layout.tsx` | Applies `localeFontClass` to `<html>` |
| `tailwind.config.ts` | `fontFamily` references CSS variables instead of hardcoded family names |
| `components/nav/LanguageSwitcher.tsx` | **NEW** — globe button + dropdown, sets cookie, routes via next-intl |
| `components/map/MapClient.tsx` | Translates loading text, mounts `LanguageSwitcher` |
| `components/map/MapView.tsx` | Breadcrumb's India label, search button, structured-error fallbacks via `useTranslations` |
| `components/map/Breadcrumb.tsx` | Translated aria + India label; chevron mirrors in RTL |
| `components/map/BasemapSwitcher.tsx` | Translated labels |
| `components/map/LocateMe.tsx` | Translated toasts + button aria |
| `components/map/NorthArrow.tsx` | Translated aria |
| `components/map/CoordReadout.tsx` | Translated mode switch tooltip + UTM-unavailable label |
| `components/map/ParcelSidebar.tsx` | Translated headers, field labels, mock banner; RTL slide-from-left; locale-aware number formatting |
| `components/map/OwnershipTimeline.tsx` | Translated empty/current/relation/share/registered; locale-aware date formatting; RTL rail mirror |
| `components/map/SearchPalette.tsx` | Translated placeholder, section headers, keyboard hints, footer |
| `scripts/generate-mock-parcels.ts` | Curated Pune-Rural village list; writes `name_hi` and `name_local` on insert + update |

### How to verify

```
npm run typecheck          # passes
npm run lint               # passes
npm run dev                # boots, /, /en, /hi, /ur all render
npm run data:seed-pune     # re-seeds with name_hi / name_local populated
```

Manual smoke:
1. Open `/`. Middleware redirects to your browser locale (English by default).
2. Click the globe button (top-right, just left of basemap switcher). Pick हिन्दी — page reloads under `/hi`, all chrome text in Devanagari.
3. Pick اردو — `/ur` loads in `dir="rtl"`. Sidebar (open a parcel) slides from the LEFT. Breadcrumb arrows point left. Map controls stay where they were.
4. Open a parcel — dates render in Western digits with Hindi/Urdu month abbreviations.
5. Search `पुणे` finds Pune Rural (cross-script match against `name_hi`). Search `Pune` from the Urdu UI still works.

### Decisions

- **One catalog file per locale, not split by component.** Pragmatic for three locales; revisit when we add a fourth and the file starts pushing 500 lines.
- **Western digits in Urdu.** Per the user spec ("Indian Urdu uses Western digits, NOT Eastern Arabic"). Forced via `-u-nu-latn` Unicode extension on every `Intl.NumberFormat`/`Intl.DateTimeFormat` call rather than letting the catalogue try to format numbers itself.
- **Map controls do not mirror.** They're physical map UI; flipping zoom-out to the left would be confusing. Only flow content (breadcrumb, sidebar, palette) mirrors.
- **Curated village seed list.** The Sprint 3 faker-driven random names were never realistic and made cross-script search untestable. The curated list trades a tiny bit of variety for authenticity and unblocks Sprint 6+ work that depends on stable names.
- **`name_local` = `name_hi` for Maharashtra.** Marathi uses Devanagari with shared spellings for these proper nouns. Once non-Marathi states ship in Sprint 7, `name_local` will diverge per state language.
- **Browser-language detection left to next-intl.** Its default order matches the spec exactly; no custom middleware needed.

### Deferred to later sprints

- A fourth locale (Marathi as a standalone `mr`, Tamil, Bengali, etc.) — Phase 2.
- Translating dynamic data — district names from Census 2011 GeoJSON, owner names from real scrapers. Those carry their own vernacular fields; the cross-script search infra is ready.
- A "Share parcel" copy-link button on the sidebar header (was bundled into the Sprint 5 prompt's earlier draft but reassigned out of this sprint's scope per the working prompt).
- Right-to-left scale bar tick direction — MapLibre doesn't expose a `direction` prop; not visually disruptive.
- Hindi/Urdu translations for OpenAPI / `llms.txt` (those are dev-facing, English-only is fine for now).

### What's next

Sprint 6 — Auth & saved bookmarks. Supabase Auth (magic link + Google), saved-parcels CRUD bound to `auth.users(id)`, sidebar gets a heart icon for current user.
