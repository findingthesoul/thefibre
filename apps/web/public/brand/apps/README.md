# App tiles

One square per app, used by the dashboard launcher and as each app's own tile
at the top left of its sidebar. Served from fibre web — the brand-asset single
point of truth — and resolved by `tileArtUrl()` in packages/shared/branding.ts,
which maps slug → file name. Swap the art by swapping the file; the names are
the contract, the pictures are not.

**Since 2026-09-23** these are Sjoerd's "PNG 3" set: the same painted marks
WITHOUT the word underneath. The launcher and the sidebar already print the
app's name beside the tile, so the word inside the picture was saying it
twice.

`thethread.png` is the odd one and it is DELIBERATE — confirmed by Sjoerd on
2026-09-23. It is the handwritten wordmark zoomed in and cut off mid-word
("thr") where the other six are centred shapes. It reads as a crop, not a
mistake. Do not "fix" it.

Sources are 753px; they are resized to the set's 600px square and re-encoded
with sharp (`compressionLevel: 9, effort: 10, palette: true, quality: 92`),
which took them from ~500KB each to 115-200KB with the paint texture intact.
Worth doing: seven tiles load together in the launcher.

The previous set (2026-09-22, the inverted `-dia` files from "PNG 2", shape in
white on the app's colour WITH the word) is in git history.

The first cut (2026-09-21, shape on white, cropped above the wordmark) is in
git history if the quieter version is ever wanted back. The full lockups —
shape WITH the name under it — live in `../lockups/` and are for surfaces
with room to read: the landing page, the sign-in page.

`learn.png` is still the older Matisse crop: Fibre Learn does not exist yet
(Sjoerd, 2026-09-21), so there is no new icon for it.
