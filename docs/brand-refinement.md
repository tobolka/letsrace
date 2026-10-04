# Brand refinement — branch proposal

This is a local design proposal on `codex/brand-refinement`, based on the
existing Let's Race wordmark, Stone palette and forest MTB OG photograph.

## Visual rules

- Keep Geist, the white page surface and the compact application shell.
- Brand red (`--brand`, `#c81d25`) identifies the wordmark, active navigation,
  keyboard focus on browse cards, and a small forward-leaning ribbon.
- Discipline colours retain their existing meaning across map pins and browse
  icons. They are data cues, not additional brand colours.
- Use the existing forest image only on the browse entry and welcome card.
  Country cards use flags. Discipline and series cards remain compact text
  links with genuine catalogue counts.
- Photography is decorative; it must not imply a real event or country.
- Keep the logo bar at 48px across map, list, calendar and browse.
- Countries, disciplines and series share the same intro typography, divider,
  card spacing, hover colour and visible keyboard focus.
- On phones, shorten the photo and cards, wrap labels and retain bottom tabs.
- Loading states use the same layout and card dimensions as loaded pages.

## Asset

`public/brand/riding/mtb.webp` is a 720 × 480 WebP derivative of the existing
`public/og-race-v2.png`. It is encoded ahead of time; no image-processing code
is added to the application runtime.

The generated road-image exploration was rejected and is not part of this
proposal. No new generated photography is referenced by the application.
