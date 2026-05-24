# 06 — Internationalization

> How LandLens speaks twelve Indian languages, why Urdu ships at launch alongside English and Hindi, and how the UI mirrors itself for right-to-left scripts.

## Languages at Launch (Phase 1)

```
en  — English  (default)
hi  — Hindi
ur  — Urdu     (RTL)
```

That's three. Hindi covers the largest single-language audience. Urdu sounds unexpected for a Phase 1 launch — it's not.

### Why Urdu at launch, not Phase 2

- **J&K historical Jamabandi records are in Urdu/Persian script.** A platform that can't display them silently mistranslates the names.
- **Hyderabad / Telangana pre-1948 Nizam-era records are in Urdu.** Same problem.
- **Urdu is an official language in Bihar, Jharkhand, UP, WB, Telangana, J&K, and Delhi.** That's a non-trivial audience whose government already publishes in Urdu.
- **Building RTL infrastructure once is cheaper than retrofitting it.** Doing it in Sprint 5 means every component is RTL-correct from birth. Adding RTL in Phase 2 means a full UI audit.

If we postpone Urdu, J&K and pre-1948 Hyderabad records are second-class data. That's a coverage gap, not a translation gap.

## Languages in Phase 2 (Regional Hindi-belt → South → East)

```
mr  — Marathi
ta  — Tamil
te  — Telugu
kn  — Kannada
bn  — Bengali
```

## Languages in Phase 3

```
gu  — Gujarati
pa  — Punjabi
or  — Odia
ml  — Malayalam
```

Total at end of Phase 3: 12 languages, covering ~95% of India's primary-language speakers.

## Stack: `next-intl`

We use [`next-intl`](https://next-intl-docs.vercel.app/) because:

- **Native App Router support** — no monkey-patching
- **Type-safe message catalogs** — TS knows every key
- **Server + client component support** — same API both sides
- **Locale-prefixed routing** built in — `/en/parcel/123`, `/hi/parcel/123`, `/ur/parcel/123`

Alternatives considered: `next-i18next` (Pages Router era; awkward in App Router), `react-intl` (no routing). `next-intl` wins on App Router.

## File Layout

```
messages/
  en.json
  hi.json
  ur.json
  mr.json       ← Phase 2
  ...

lib/i18n/
  config.ts            ← locale list, default locale, RTL set
  transliterate.ts     ← Devanagari ↔ Latin owner-name conversion

middleware.ts          ← locale detection + redirect to /<locale>
```

## Message Catalog Conventions

Keys are namespaced by feature, not by page:

```json
{
  "map": {
    "scaleBar": { "km": "km", "m": "m" },
    "coordinates": { "lat": "Lat", "lng": "Lng" }
  },
  "parcel": {
    "details": {
      "khasra": "Khasra No.",
      "ulpin": "ULPIN",
      "area": "Area",
      "owner": "Owner"
    }
  },
  "cadastral": {
    "khasra": "Khasra",
    "khatauni": "Khatauni",
    "tehsil": "Tehsil",
    "ror": "Record of Rights"
  }
}
```

The `cadastral` namespace is dictionary terminology — terms that are translated *and* transliterated. The Hindi version of `khasra` is `खसरा`, not "plot number" — Indian users know the term, translating it is patronizing.

## URL Strategy

Locale lives in the path, not a query param or cookie:

```
land.trenlens.com/en/parcel/123
land.trenlens.com/hi/parcel/123
land.trenlens.com/ur/parcel/123
```

Why path-based:
- Shareable — `/hi/parcel/123` shared in WhatsApp opens in Hindi for the recipient
- SEO — Google indexes each locale as a separate page
- No JS required — server-rendered HTML is already in the right language

`middleware.ts` handles three cases:
1. URL has a locale prefix → render in that locale, set cookie
2. URL has no prefix, cookie exists → redirect to `/<cookie-locale>/<path>`
3. URL has no prefix, no cookie → detect from `Accept-Language`, redirect

## Language Switcher

Globe icon in the header, dropdown listing all available locales in **their own script**:

```
English
हिन्दी
اردو
मराठी
தமிழ்
```

Always the native name. "Hindi" in a Hindi UI is wrong; "हिन्दी" is right.

Switching locale preserves the path: clicking `हिन्दी` on `/en/parcel/123` goes to `/hi/parcel/123`, not to `/hi`.

## RTL Support (Urdu)

When `locale === 'ur'`:

```html
<html lang="ur" dir="rtl">
```

Tailwind handles the rest via the `rtl:` prefix:

```tsx
<aside className="left-0 rtl:left-auto rtl:right-0">
```

Components are written with **logical properties** where Tailwind supports them:
- `ms-4` / `me-4` instead of `ml-4` / `mr-4`
- `ps-4` / `pe-4` instead of `pl-4` / `pr-4`
- `start-0` / `end-0` instead of `left-0` / `right-0`

This makes most components RTL-correct without per-component `rtl:` prefixes.

### What flips in RTL

- Sidebar slides in from the **right** instead of the left
- Breadcrumb reads **right-to-left**: India → Jammu & Kashmir → Srinagar
- Icon-text pairs swap: `<Icon /> Search` becomes `Search <Icon />`
- Numbers stay **left-to-right** within RTL text (Indo-Arabic 1,2,3 not Eastern Arabic ١,٢,٣ — India uses Indo-Arabic even in Urdu)

### What does not flip

- The map. Maps are geographic, not textual. North stays up regardless of locale.
- Charts and timelines that have a fixed temporal direction.

## Fonts

```
Inter                  ← Latin script (en)
Noto Sans Devanagari   ← Devanagari (hi, mr, ne)
Noto Nastaliq Urdu     ← Persian/Nastaliq (ur)
Noto Sans Tamil        ← Tamil
Noto Sans Telugu       ← Telugu
Noto Sans Kannada      ← Kannada
Noto Sans Bengali      ← Bengali, Assamese
Noto Sans Gujarati     ← Gujarati
Noto Sans Gurmukhi     ← Punjabi
Noto Sans Oriya        ← Odia
Noto Sans Malayalam    ← Malayalam
```

All self-hosted via `next/font/google` (no runtime fetch from Google). Subsets loaded per locale — visiting `/en/...` never downloads Noto Nastaliq Urdu.

**Why Noto Nastaliq for Urdu, not Noto Sans Arabic:** Urdu is written in the Nastaliq style, not the modern Naskh style used for Arabic. Using Naskh for Urdu reads as foreign or computerized. Nastaliq reads as authentic.

## Hindi & Urdu Polish Checklist

Every Hindi / Urdu PR runs through:

- [ ] `font-feature-settings: "kern" 1` set on all Devanagari elements (kerning fix)
- [ ] All UI tested at 1.3× text length (Hindi and Urdu are typically longer than English)
- [ ] Right-side panels: no truncation at 30 characters
- [ ] All sidebar / drawer animations RTL-mirrored
- [ ] Numbers in Urdu use Indo-Arabic (1,2,3), not Eastern Arabic
- [ ] Optional Devanagari numeral toggle in Hindi (`१२३` instead of `123`)
- [ ] Owner names display in original script + transliteration toggle

## Owner Names — A Special Case

Owner names are not "translated." They are **transliterated** and **stored in original script**:

```
ownership_records.owner_name        = "राजेश कुमार"  (original script)
ownership_records.owner_name_en     = "Rajesh Kumar" (transliteration for search)
ownership_records.owner_name_masked = "Rajesh K."    (privacy)
```

UI shows original script + Latin transliteration in parentheses. Search hits both columns. See [Database Schema](./02-database-schema.md#ownership_records).

## Location Feature Copy

The "Locate me" feature (GPS-based parcel discovery) ships at launch in all three Phase 1 locales. The `locate.*` namespace is treated as launch-blocking — missing translations here mean the feature is unusable for that locale.

| Key | English | Hindi | Urdu |
|---|---|---|---|
| `locate.button` | Find land around me | मेरे आस-पास की ज़मीन ढूँढें | میری اطراف زمین تلاش کریں |
| `locate.permission_prompt` | LandLens needs your location to show parcels nearby | LandLens को पास के पार्सल दिखाने के लिए आपका स्थान चाहिए | قریبی پارسلز دکھانے کے لیے LandLens کو آپ کا مقام درکار ہے |
| `locate.permission_denied` | Enable location in your browser settings to use this | इसका उपयोग करने के लिए ब्राउज़र सेटिंग्स में स्थान सक्षम करें | اسے استعمال کرنے کے لیے براؤزر کی ترتیبات میں مقام فعال کریں |
| `locate.accuracy_low` | Location accuracy is low — try moving to open sky | स्थान सटीकता कम है — खुले आसमान में जाने का प्रयास करें | مقام کی درستگی کم ہے — کھلے آسمان کے نیچے جانے کی کوشش کریں |
| `locate.no_parcels_nearby` | No parcels mapped in this area yet | इस क्षेत्र में अभी कोई पार्सल मैप नहीं है | اس علاقے میں ابھی تک کوئی پارسل میپ نہیں ہے |

Notes:
- All five strings must be present in `messages/en.json`, `hi.json`, `ur.json` before the feature flag is flipped on.
- The Urdu strings are RTL-rendered automatically via `dir="rtl"` on `<html>` — no per-string formatting needed.
- The browser's own geolocation permission prompt is **not** translatable by us; the OS/browser controls that. Our `locate.permission_prompt` is shown as in-app context **before** we call `getCurrentPosition()`, so the user knows what the browser dialog is about.

## Cadastral Terminology

Some terms have no clean English equivalent and shouldn't be translated:

| Term | Devanagari | Translation? |
|---|---|---|
| Khasra | खसरा | No — it's a specific plot ID concept |
| Khatauni | खतौनी | No — Indian RoR document |
| Patwari | पटवारी | No — village revenue official |
| Tehsil | तहसील | No — admin unit |
| Jamabandi | जमाबंदी | No — RoR variant |
| ULPIN | — | "Bhu-Aadhaar" in Hindi |

These live in the `cadastral` namespace and are surfaced with tooltips that explain them to non-Indian users in the English locale.

## Testing

- Snapshot tests run for each locale on critical screens
- Visual regression (Percy / Chromatic) flips between `en` and `ur` to catch RTL regressions
- A dedicated `/dev/i18n-audit` page lists every translation key and flags missing translations per locale

## What's Next

→ Read [Deployment](./07-deployment.md) to see how the multi-locale site ships to production.
