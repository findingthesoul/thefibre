# App tiles

One square per app, used by the dashboard launcher and as each app's own tile
at the top left of its sidebar. Served from fibre web — the brand-asset single
point of truth — and resolved by `tileArtUrl()` in packages/shared/branding.ts,
which maps slug → file name. Swap the art by swapping the file; the names are
the contract, the pictures are not.

**Since 2026-09-22** these are the INVERTED cut of Sjoerd's painted set
(branding/icons "PNG 2", the `-dia` files): the shape in white on the app's
own colour, filling the square. He asked for them by name for the small
icons — "it maybe stands out better" — and at 28 pixels in the sidebar a
coloured tile reads where a shape on white does not.

The first cut (2026-09-21, shape on white, cropped above the wordmark) is in
git history if the quieter version is ever wanted back. The full lockups —
shape WITH the name under it — live in `../lockups/` and are for surfaces
with room to read: the landing page, the sign-in page.

`learn.png` is still the older Matisse crop: Fibre Learn does not exist yet
(Sjoerd, 2026-09-21), so there is no new icon for it.
