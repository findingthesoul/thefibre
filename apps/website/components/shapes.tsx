// Re-export shim. The cut-out library moved to @thefibre/shared/ui/marks on
// 2026-09-24, when the public site themes became its second caller. Edit the
// shared copy; this file exists so the website's own imports did not all have
// to change in the same commit.
export {
  SHAPES,
  Shape,
  Vessel,
  Leaf,
  Figure,
  Burst,
  Wave,
  type ShapeName,
} from '@thefibre/shared/ui/marks';
