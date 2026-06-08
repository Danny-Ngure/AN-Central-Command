# Footer images

The `<SiteFooter />` component swaps the hero photo on the right based on
which top-nav page the user is on. Drop the four Alfayo Nelson photos
here using these exact filenames:

| Filename                | Used by                  | Vibe (caption shown over the photo) |
|-------------------------|--------------------------|-------------------------------------|
| `stage-crowd.jpg`       | Home, Data Import        | **On the stage** — stage-back shot, hand raised, addressing a packed crowd |
| `street-rally.jpg`      | Wards, Voter Search, Polling Stations | **On the ground** — street rally, hand raised, supporters and banners |
| `media-interview.jpg`   | Pollings & Analysis, Audit Logs | **On record** — graduation robes, surrounded by media microphones |
| `cap-smile.jpg`         | Meetings, Team Directory | **With the people** — ANHF cap, big smile, in the crowd |

## Format guidance

- **Type:** JPG / PNG / WebP
- **Aspect:** landscape, roughly 4:3 (the slot is `aspect-[4/3]`)
- **Resolution:** ~1600×1200 is plenty — the footer renders at ~400px wide
- **Subject placement:** keep the main subject (Alfayo) roughly centered or
  slightly left, since the caption ribbon sits over the bottom edge

## Fallback behaviour

If a file is missing, the slot renders a styled brand panel ("AN" mark on
a teal→deep-blue→dark-gray gradient with the page's caption underneath).
This means the footer never looks broken even before the real photos land
— so you can ship the layout today and add the photos at your own pace.

## How to add a new page mapping

1. Edit `apps/web/components/site-footer.tsx`
2. Add the route prefix to `FOOTER_IMAGES` with `{ src, alt, caption }`
3. Drop the file here

The component prefix-matches, so `/wards/abc-123` automatically picks up
the `/wards` entry.
