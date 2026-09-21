// The assistant's stored-key encryption lives in lib/secret-box.ts since
// v0.82.0 — the MCP grants use the same box. This module keeps the old import
// path working; the tests beside it exercise the shared implementation.
export { currentKid, decryptSecret, encryptSecret, hintOf, kidOf } from '../secret-box.js';
