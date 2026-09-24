#!/usr/bin/env node
// docs/mcp-personal-access-plan.md — the sign-in and the first tool call,
// walked end to end against a live API, the way Claude.ai or Claude Desktop
// would walk it:
//
//   1. discovery: the 401 challenge → protected-resource doc → auth-server doc
//   2. dynamic client registration (public client, PKCE)
//   3. /authorize → 302 to The Fibre's /connect with the request intact
//   4. consent, as a signed-in person (the /connect page's server action)
//   5. code → tokens at /token, with the PKCE verifier; a wrong verifier fails
//   6. MCP over HTTP: initialize, tools/list follows the scopes, one real read
//   7. refresh rotates; the old refresh token is dead
//   8. disconnect from Settings → the token is dead on the next call
//
// Writes: one oauth_client row (removed), one mcp_grant (revoked, then
// removed), one oauth_code (used, removed). Nothing else. The signed-in
// session is minted the same way verify-external-app.mjs mints its admin:
// generateLink → verifyOtp, no email sent.
//
// Usage:
//   FIBRE_ENV_FILE=.env.staging FIBRE_API=http://localhost:8080 node scripts/verify-mcp-personal.mjs
//   FIBRE_ENV_FILE=.env.staging FIBRE_API=https://thefibre-api-staging.fly.dev node scripts/verify-mcp-personal.mjs

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { supabaseEnv } from './lib/env.mjs';

const { url: SUPABASE_URL, anonKey: ANON_KEY, serviceKey: SERVICE_KEY } = supabaseEnv();
const API = (process.env.FIBRE_API ?? 'http://localhost:8080').replace(/\/+$/, '');
const EMAIL = process.env.FIBRE_ADMIN_EMAIL ?? 'sjoerd@soul.com';
const REDIRECT = 'http://localhost:6274/oauth/callback';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failures = 0;
const step = (n, label) => console.log(`\n── ${n}. ${label}`);
const check = (ok, label, detail) => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function http(path, { method = 'GET', body, headers = {}, form = false, redirect = 'manual' } = {}) {
  const h = { ...headers };
  let payload;
  if (body !== undefined) {
    if (form) {
      h['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(body).toString();
    } else {
      h['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, { method, headers: h, body: payload, redirect });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: json, text };
}

/** One MCP JSON-RPC call over Streamable HTTP; unwraps an SSE body if the server streams. */
async function mcp(token, method, params = {}, id = 1) {
  const res = await fetch(`${API}/api/v1/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await res.text();
  if (res.status !== 200) return { status: res.status, headers: res.headers, body: safeJson(text) };
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/event-stream')) {
    const line = text.split('\n').find((l) => l.startsWith('data:'));
    return { status: 200, headers: res.headers, body: safeJson(line?.slice(5).trim() ?? '') };
  }
  return { status: 200, headers: res.headers, body: safeJson(text) };
}
function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

async function personSession() {
  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: vErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
  if (vErr || !data.session) throw new Error(`verifyOtp: ${vErr?.message}`);
  return data.session.access_token;
}

let clientId = null;
let grantId = null;
let verifyThreadId = null;

async function cleanup() {
  if (verifyThreadId) {
    // The draft thread the write step made: its engagements, the thread, its programme.
    const { data: t } = await db.from('thread_thread').select('program_id').eq('id', verifyThreadId).maybeSingle();
    await db.from('thread_engagement').delete().eq('thread_id', verifyThreadId);
    await db.from('thread_thread').delete().eq('id', verifyThreadId);
    if (t?.program_id) await db.from('program').delete().eq('id', t.program_id);
  }
  if (grantId) await db.from('mcp_grant').delete().eq('id', grantId);
  if (clientId) {
    await db.from('oauth_code').delete().eq('client_id', clientId);
    await db.from('oauth_client').delete().eq('client_id', clientId);
  }
}

async function main() {
  console.log(`API: ${API}`);

  step(1, 'Discovery: the endpoint challenges, and the documents lead to the endpoints');
  const bare = await http('/api/v1/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: 0, method: 'initialize', params: {} } });
  check(bare.status === 401, 'no token → 401', `HTTP ${bare.status}`);
  const www = bare.headers.get('www-authenticate') ?? '';
  const metaUrl = /resource_metadata="([^"]+)"/.exec(www)?.[1];
  check(!!metaUrl, 'WWW-Authenticate names the resource metadata', metaUrl);
  const pr = await http(metaUrl ?? `${API}/.well-known/oauth-protected-resource/api/v1/mcp`);
  check(pr.status === 200 && pr.body?.resource?.endsWith('/api/v1/mcp'), 'protected-resource document', pr.body?.resource);
  const asUrl = `${pr.body?.authorization_servers?.[0] ?? API}/.well-known/oauth-authorization-server`;
  const as = await http(asUrl);
  check(as.status === 200 && as.body?.code_challenge_methods_supported?.includes('S256'), 'authorization-server document, S256', as.body?.token_endpoint);
  const ORIGIN = pr.body?.authorization_servers?.[0] ?? API;

  step(2, 'A client registers itself: public, PKCE, redirect on the loopback');
  const bad = await http('/api/v1/oauth/register', { method: 'POST', body: { client_name: 'x', redirect_uris: ['http://evil.example/cb'] } });
  check(bad.status === 400, 'an http redirect off the loopback is refused', `HTTP ${bad.status}`);
  const reg = await http('/api/v1/oauth/register', {
    method: 'POST',
    body: { client_name: 'verify-mcp-personal', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] },
  });
  check(reg.status === 201 && reg.body?.client_id?.startsWith('mcp_'), 'registered', reg.body?.client_id);
  clientId = reg.body?.client_id;
  if (!clientId) throw new Error('no client_id');

  step(3, '/authorize sends the browser to /connect with the request intact');
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(8));
  const authz = new URL(`${API}/api/v1/oauth/authorize`);
  for (const [k, v] of Object.entries({ client_id: clientId, redirect_uri: REDIRECT, response_type: 'code', state, code_challenge: challenge, code_challenge_method: 'S256', scope: 'connections:read thread:read' }))
    authz.searchParams.set(k, v);
  const az = await http(authz.toString());
  const loc = az.headers.get('location') ?? '';
  check(az.status === 302 && loc.includes('/connect?'), '302 to /connect', loc.split('?')[0]);
  const fwd = new URL(loc);
  check(fwd.searchParams.get('code_challenge') === challenge && fwd.searchParams.get('state') === state, 'challenge and state travel with it');
  const noPkce = await http(`${API}/api/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code`);
  check(noPkce.status === 400, 'without PKCE the request is refused', `HTTP ${noPkce.status}`);

  step(4, 'Consent, as a signed-in person');
  const jwt = await personSession();
  const who = await http('/api/v1/mcp-auth/client?client_id=' + clientId, { headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' } });
  check(who.status === 200 && who.body?.name === 'verify-mcp-personal', 'the consent page can name the client', who.body?.scopes?.map((s) => s.scope).join(','));
  const denied = await http('/api/v1/mcp-auth/consent', {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' },
    body: { client_id: clientId, redirect_uri: REDIRECT, state, code_challenge: challenge, code_challenge_method: 'S256', decision: 'deny' },
  });
  check(denied.status === 200 && /error=access_denied/.test(denied.body?.redirect ?? ''), 'deny → access_denied, nothing stored', denied.body?.redirect?.split('?')[1]);
  const wrongUri = await http('/api/v1/mcp-auth/consent', {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' },
    body: { client_id: clientId, redirect_uri: 'http://localhost:6274/other', state, code_challenge: challenge, code_challenge_method: 'S256', decision: 'approve' },
  });
  check(wrongUri.status === 400, 'an unregistered redirect_uri is refused before anything is minted', `HTTP ${wrongUri.status}`);
  const ok = await http('/api/v1/mcp-auth/consent', {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' },
    body: { client_id: clientId, redirect_uri: REDIRECT, state, code_challenge: challenge, code_challenge_method: 'S256', scope: 'connections:read thread:read thread:write connections:write', decision: 'approve' },
  });
  const code = ok.body?.redirect ? new URL(ok.body.redirect).searchParams.get('code') : null;
  check(ok.status === 200 && !!code, 'approve → a code on the registered redirect', ok.body?.redirect?.split('?')[0]);
  const { data: grantRow } = await db.from('mcp_grant').select('id, scopes, activated_at, refresh_token_hash').eq('client_id', clientId).maybeSingle();
  grantId = grantRow?.id ?? null;
  check(!!grantId && !grantRow?.activated_at && !grantRow?.refresh_token_hash, 'a grant exists, not yet activated', grantId);
  check(JSON.stringify(grantRow?.scopes ?? []) === JSON.stringify(['connections:read', 'thread:read', 'thread:write']), 'an unknown scope was narrowed away; thread:write, asked for by name, kept', JSON.stringify(grantRow?.scopes));

  step(5, 'Code → tokens, with PKCE');
  const wrongVerifier = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: b64url(randomBytes(32)) } });
  check(wrongVerifier.status === 400 && wrongVerifier.body?.error === 'invalid_grant', 'a wrong verifier is refused, and the code survives', wrongVerifier.body?.error);
  const tok = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier } });
  check(tok.status === 200 && !!tok.body?.access_token && tok.body?.refresh_token?.startsWith('fibre_rt_'), 'access + refresh token issued', `scope="${tok.body?.scope}"`);
  const again = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier } });
  check(again.status === 400, 'a code is single-use', `HTTP ${again.status}`);
  let access = tok.body?.access_token;
  let refresh = tok.body?.refresh_token;

  step(6, 'MCP over HTTP, as the person');
  const init = await mcp(access, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify', version: '0' } });
  check(init.status === 200 && init.body?.result?.serverInfo?.name === 'thefibre', 'initialize', init.body?.result?.serverInfo?.version ?? JSON.stringify(init.body).slice(0, 160));
  check(/workspace "/.test(init.body?.result?.instructions ?? ''), 'instructions name the workspace');
  const list = await mcp(access, 'tools/list', {}, 2);
  const names = (list.body?.result?.tools ?? []).map((t) => t.name);
  check(names.includes('connections_today') && names.includes('thread_list') && names.includes('thread_create'), 'tools follow the three scopes', `${names.length} tools`);
  const toolsListed = list.body?.result?.tools ?? [];
  check(
    toolsListed.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name).sort().join(',') === 'thread_add_engagements,thread_create',
    'exactly the two write tools say they write; every other tool is read-only',
  );
  const promptsList = await mcp(access, 'prompts/list', {}, 20);
  check((promptsList.body?.result?.prompts ?? []).some((p) => p.name === 'plan_thread_from_schedule'), 'the schedule prompt is offered');
  const today = await mcp(access, 'tools/call', { name: 'connections_today', arguments: {} }, 3);
  const todayText = today.body?.result?.content?.[0]?.text ?? '';
  const todayErr = today.body?.result?.isError === true;
  // A person without Connections in this workspace gets a readable 403 — that
  // is the route's own answer, not a failure of the plumbing.
  check(today.status === 200 && (!todayErr || /403|Not allowed/.test(todayText)), 'a real read runs under the person’s own rights', todayErr ? todayText.split('\n')[0] : `${todayText.length} chars`);
  const threads = await mcp(access, 'tools/call', { name: 'thread_list', arguments: {} }, 4);
  check(threads.status === 200 && !threads.body?.result?.isError, 'thread_list answers', (threads.body?.result?.content?.[0]?.text ?? '').slice(0, 60).replace(/\s+/g, ' '));
  // --- the first write, as the person: a draft thread with a small schedule.
  step('6b', 'thread_create + thread_add_engagements, as the person, as drafts');
  const slug = `verify-mcp-${Date.now().toString(36)}`;
  const made = await mcp(access, 'tools/call', { name: 'thread_create', arguments: { title: 'verify-mcp-personal', slug, format: 'journey', starts_on: '2026-10-01', ends_on: '2027-12-31' } }, 30);
  const madeOut = safeJson(made.body?.result?.content?.[0]?.text ?? '{}');
  const madeErr = made.body?.result?.isError === true;
  check(made.status === 200 && !madeErr && madeOut.created === true && !!madeOut.thread_id, 'a draft thread is created as the person', madeErr ? (made.body?.result?.content?.[0]?.text ?? '').split('\n')[0] : madeOut.thread_id);
  verifyThreadId = madeOut.thread_id ?? null;
  if (verifyThreadId) {
    const { data: prog } = await db.from('thread_thread').select('id, program:program_id (status, title)').eq('id', verifyThreadId).maybeSingle();
    const p = Array.isArray(prog?.program) ? prog.program[0] : prog?.program;
    check(p?.status === 'draft' && p?.title === 'verify-mcp-personal', 'and it really is a draft in the database', p?.status);
    const laid = await mcp(access, 'tools/call', {
      name: 'thread_add_engagements',
      arguments: {
        thread_id: verifyThreadId,
        items: [
          { title: 'Fellowship introduced at the Quarterly Community Gathering', type: 'event', date: '2026-10-06' },
          { title: 'Invitation to all current facilitators', type: 'message', date: '2026-10-08' },
          { title: 'Written responses complete', type: 'event', date: '2026-11-23', show_in_agenda: false },
        ],
      },
    }, 31);
    const laidOut = safeJson(laid.body?.result?.content?.[0]?.text ?? '{}');
    // A workspace without custom timelines (plan gate) answers 403 per item; that
    // is the route's own rule, reported readably — not a plumbing failure.
    const gated = laidOut.added === 0 && /403|Not allowed|higher plan/.test(JSON.stringify(laidOut.items ?? []));
    check(laid.status === 200 && !laid.body?.result?.isError && (laidOut.added === 3 || gated), gated ? 'the schedule is refused by the plan gate, readably' : 'three rows land on the timeline as drafts', `added=${laidOut.added} failed=${laidOut.failed}`);
    if (laidOut.added === 3) {
      const { data: eng, error: engErr } = await db
        .from('thread_engagement')
        .select('title, type, status, starts_at, scheduled_at, show_in_agenda, position, system_role')
        .eq('thread_id', verifyThreadId)
        .order('position');
      const byTitle = (t) => (eng ?? []).find((e) => e.title === t);
      // A new thread arrives with The Thread's own "You're enrolled" message,
      // published — that is the app's standing behaviour, not ours. Judge only
      // the three rows the tool laid down.
      const ours = (eng ?? []).filter((e) => !e.system_role);
      check(ours.length === 3 && ours.every((e) => e.status === 'draft'), 'the three rows we added are drafts in the database', engErr?.message ?? ours.map((e) => `${e.type}:${e.status}`).join(' '));
      const sent = byTitle('Invitation to all current facilitators');
      check(sent?.type === 'message' && !!sent.scheduled_at && !sent.starts_at, 'the sent row became a fixed-time message', sent?.scheduled_at ?? 'missing');
      check(byTitle('Written responses complete')?.show_in_agenda === false, 'the internal row is hidden from the agenda');
    }
  }

  const sameWs = await db.from('mcp_grant').select('last_used_at, session_refresh_ciphertext').eq('id', grantId).maybeSingle();
  check(!!sameWs.data?.session_refresh_ciphertext && !sameWs.data.session_refresh_ciphertext.includes('.'), 'the stored session credential is ciphertext, not a token');

  step(7, 'Refresh rotates');
  const rf = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId } });
  check(rf.status === 200 && rf.body?.refresh_token && rf.body.refresh_token !== refresh, 'a new pair, a new refresh token', `HTTP ${rf.status}`);
  const stale = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId } });
  check(stale.status === 400, 'the old refresh token is dead', `HTTP ${stale.status}`);
  access = rf.body?.access_token ?? access;
  refresh = rf.body?.refresh_token ?? refresh;
  const afterRefresh = await mcp(access, 'tools/list', {}, 5);
  check(afterRefresh.status === 200, 'the new access token works', `HTTP ${afterRefresh.status}`);

  step(8, 'Disconnect from Settings kills it on the next call');
  const grants = await http('/api/v1/mcp-auth/grants', { headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' } });
  check(grants.status === 200 && grants.body?.items?.some((g) => g.id === grantId && g.active), 'Settings lists the connection as active');
  const del = await http(`/api/v1/mcp-auth/grants/${grantId}`, { method: 'DELETE', headers: { authorization: `Bearer ${jwt}`, 'x-app-id': 'fibre-platform' } });
  check(del.status === 200, 'disconnected', `HTTP ${del.status}`);
  const dead = await mcp(access, 'tools/list', {}, 6);
  check(dead.status === 401, 'the live access token is refused', `HTTP ${dead.status}`);
  const deadRefresh = await http('/api/v1/oauth/token', { method: 'POST', form: true, body: { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId } });
  check(deadRefresh.status === 400, 'and so is the refresh token', `HTTP ${deadRefresh.status}`);

  console.log('\n── cleanup');
  await cleanup();
  console.log(
    failures === 0
      ? '\nAll steps pass. An assistant can discover, register, be allowed by a signed-in person, exchange a PKCE code, read as that person, refresh, and be disconnected.'
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\nFAILED:', e.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
