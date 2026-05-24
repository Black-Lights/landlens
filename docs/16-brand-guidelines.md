# 16 — Brand Guidelines

> What the LandLens mark means, how to use it, and the rules that keep it consistent across the site, social previews, and the GitHub repo.

## The Mark

The LandLens mark is a lens-circle containing a parcel grid with one highlighted parcel in indigo and a center pin. Each element carries meaning:

| Element | What it means |
|---|---|
| Lens circle | The platform itself — a clear, focused view onto land records |
| Parcel grid (4 lines) | India's cadastral mosaic — every plot, every state, in one frame |
| Highlighted parcel (indigo) | The user's click — the core action of the product |
| Center pin | The exact spot, the ground truth — "this plot, right here" |

The composition deliberately echoes a surveyor's transit through a viewfinder: looking *into* the land rather than across it.

## Files

All brand assets live in [`public/brand/`](../public/brand/) so they ship with the site at predictable URLs.

| File | Use |
|---|---|
| `logo.svg` | Full lockup (icon + wordmark). Strokes use `currentColor` — best for inline-SVG use inside the app (via the `<Logo>` component) where the parent's text color drives the stroke. |
| `logo-light.svg` | Full lockup with **slate-900 strokes** baked in. Use on light backgrounds when you can't render inline (READMEs, third-party embeds, GitHub `<img>` tags). |
| `logo-dark.svg` | Full lockup with **white strokes** baked in, plus a slightly brighter indigo so it pops on dark surfaces. Pair with `logo-light.svg` inside a `<picture>` element for theme-aware READMEs. |
| `icon.svg` | Icon only, square. App tabs, compact contexts, footer marks. Also uses `currentColor`. |
| `app-icon.svg` | Solid-background variant — indigo fill, white strokes. Source for PWA / app store icons and the rasterized favicon. |
| `favicon.svg` | Small-size optimized icon, fixed colors (slate-900 strokes, indigo highlight). Used by `<link rel="icon">`. |
| `og-image.png` | 1200×630 social preview. Icon + wordmark centered on white. Used by Open Graph and Twitter Cards. |
| `/favicon.ico` | Multi-resolution `.ico` (16/32/48). Legacy browsers. |
| `/apple-touch-icon.png` | 180×180. iOS home-screen icon. |

The raster files (`favicon.ico`, `apple-touch-icon.png`, `og-image.png`) are regenerated from the SVG sources by [`scripts/generate-favicons.ts`](../scripts/generate-favicons.ts) — run it whenever the brand updates.

## Color Palette

| Token | Hex | Use |
|---|---|---|
| Indigo (brand) | `#2563EB` | Highlighted parcel, center pin, accents |
| Indigo hover | `#1D4ED8` | Hovered interactive states |
| Slate 900 | `#0F172A` | Lens-circle stroke + body text on light backgrounds |
| White | `#FFFFFF` | Strokes on the app-icon (solid indigo background) |

Tailwind reads the brand indigo as `accent` (see `tailwind.config.ts`). Use `text-accent` / `bg-accent` rather than hardcoding the hex.

## Typography

The wordmark uses **Inter**, the same family as the rest of the UI. Two weights stacked: "Land" at 500 (medium), "Lens" at 400 (regular) at 55% opacity. This visual hyphenation does two jobs at once — it tells the reader where the word breaks and it hints at the platform's two halves (registry data + lens onto satellite imagery).

Do not substitute another font for the wordmark. If Inter cannot load, use the icon-only variant instead.

## Do

- Use the SVG variants wherever possible — they scale crisply on retina displays.
- Let the strokes inherit `currentColor` for `logo.svg` and `icon.svg`; this lets a dark-mode page render the mark in white without extra files.
- Keep at least one full lens-radius (32 px at the source size) of clear space around the mark.
- On photographic or busy backgrounds, use `app-icon.svg` (solid indigo) so the mark stays legible.

## Don't

- Don't recolor the indigo highlighted parcel — that's the only saturated color in the system and stripping it kills the brand's recognition.
- Don't rotate, skew, or stretch the mark. The aspect ratios in the source files are the only valid ones.
- Don't add a drop shadow, glow, or stroke around the wordmark.
- Don't separate the icon from the wordmark in the full lockup; that's what `icon.svg` is for.
- Don't render the mark below 24 px in icon form or below 80 px in full-lockup form — sub-pixel grid lines collapse and the highlighted parcel becomes muddy.

## In Code

```tsx
import Logo from '@/components/nav/Logo';

// Full lockup — auto-adapts to the page's text color
<Logo variant="full" theme="auto" />

// Icon only, forced dark for use on a light hero
<Logo variant="icon" theme="dark" />
```

The `<Logo>` component inlines the SVG so the strokes can pick up `currentColor` and so there's no extra network request.

## In Markdown (READMEs, GitHub)

GitHub renders SVG as a flat `<img>` — `currentColor` falls back to black, which disappears on the dark theme. Use the baked-color variants inside a `<picture>` element so each theme picks the right one:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-dark.svg">
  <img src="public/brand/logo-light.svg" alt="LandLens" width="280">
</picture>
```

This is the pattern used by [the repo README](../README.md).

## What's Next

→ Read [Internationalization](./06-internationalization.md) to see how the wordmark behaves in RTL locales (the mark itself does not mirror — `dir="rtl"` only flips layout).
