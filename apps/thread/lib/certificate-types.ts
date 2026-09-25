// Re-export shim. The certificate document model lives in
// `@thefibre/shared/certificate` since 2026-09-25 — the portal renders a
// person's own certificate from the same shapes, and two copies of a document
// model is how the per-app date fields drifted (v0.13.104).
//
// Import from the shared path in new code; this exists so the builder's forty
// import sites did not all have to move in one commit.
export * from '@thefibre/shared/certificate';
