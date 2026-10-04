'use client';

// Moved to @thefibre/shared on 2026-10-04 so the profile bio could use the
// same editor (CLAUDE.md, "Components first": extract, never fork). This shim
// keeps Thread's four call sites and their import path unchanged — edit the
// shared copy, never re-add an implementation here.
export { RichTextField } from '@thefibre/shared/ui/rich-text-field';
