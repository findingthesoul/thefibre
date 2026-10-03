import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Microsoft Teams connection: the OAuth legs, the Graph calls, the token
// rotation, and the connections-SPoT writes. fetch and the database are
// mocked; nothing here talks to Microsoft.

const upsert = vi.fn(async (..._a: unknown[]) => ({ error: null as { message: string } | null }));
const maybeSingle = vi.fn(async () => ({ data: null as Record<string, unknown> | null }));
vi.mock('../../db.js', () => ({
  adminClient: {
    from: () => ({
      upsert: (...a: unknown[]) => upsert(...a),
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
  },
}));

const {
  TEAMS_SCOPES,
  TeamsTokenError,
  createTeamsMeeting,
  deleteTeamsMeeting,
  exchangeCodeForTokens,
  fetchTeamsUser,
  isTeamsConfigured,
  refreshAccessToken,
  teamsAuthorizeUrl,
  teamsInstant,
  updateTeamsMeeting,
} = await import('./client.js');
const { clearTeamsTokenCache, teamsAccessTokenForUser } = await import('./host.js');
const { saveTeamsConnection } = await import('../connections.js');

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env.TEAMS_CLIENT_ID = 'client-id-123';
  process.env.TEAMS_CLIENT_SECRET = 'secret-value-xyz';
  process.env.PUBLIC_API_URL = 'https://api.example.test';
  clearTeamsTokenCache('u1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TEAMS_CLIENT_ID;
  delete process.env.TEAMS_CLIENT_SECRET;
  delete process.env.PUBLIC_API_URL;
});

describe('configuration', () => {
  it('needs both the id and the secret', () => {
    expect(isTeamsConfigured()).toBe(true);
    delete process.env.TEAMS_CLIENT_SECRET;
    expect(isTeamsConfigured()).toBe(false);
  });
});

describe('the authorize URL', () => {
  it('goes to the multi-tenant organizations endpoint with the three scopes', () => {
    const u = new URL(teamsAuthorizeUrl('signed.state.jwt'));
    expect(`${u.origin}${u.pathname}`).toBe(
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
    );
    expect(u.searchParams.get('client_id')).toBe('client-id-123');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('response_mode')).toBe('query');
    expect(u.searchParams.get('redirect_uri')).toBe(
      'https://api.example.test/api/v1/meet/teams/auth-callback',
    );
    expect(u.searchParams.get('state')).toBe('signed.state.jwt');
    expect(u.searchParams.get('scope')).toBe('offline_access OnlineMeetings.ReadWrite User.Read');
    expect(u.searchParams.get('scope')).toBe(TEAMS_SCOPES);
  });

  it('never carries the secret', () => {
    expect(teamsAuthorizeUrl('s')).not.toContain('secret-value-xyz');
  });
});

describe('the token endpoint', () => {
  it('exchanges a code with the client secret in the BODY, not a Basic header', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 }));

    const t = await exchangeCodeForTokens('the-code');

    expect(t).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresInSeconds: 3599 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://login.microsoftonline.com/organizations/oauth2/v2.0/token');
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'client-id-123',
      client_secret: 'secret-value-xyz',
      scope: 'offline_access OnlineMeetings.ReadWrite User.Read',
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: 'https://api.example.test/api/v1/meet/teams/auth-callback',
    });
  });

  it('refreshes with the refresh_token grant and returns the ROTATED token', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at2', refresh_token: 'rt-NEW', expires_in: 3000 }));

    const t = await refreshAccessToken('rt-OLD');

    expect(t.refreshToken).toBe('rt-NEW');
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]![1].body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-OLD');
    expect(body.get('client_secret')).toBe('secret-value-xyz');
  });

  it("surfaces Microsoft's error code on a failure", async () => {
    fetchMock.mockResolvedValue(json({ error: 'invalid_grant', error_description: 'AADSTS70008' }, 400));

    await expect(refreshAccessToken('x')).rejects.toMatchObject({
      name: 'TeamsTokenError',
      code: 'invalid_grant',
    });
  });

  it('refuses a response with no refresh token (offline_access not granted)', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at', expires_in: 3599 }));

    await expect(exchangeCodeForTokens('c')).rejects.toThrow(/no refresh_token/);
  });
});

describe('who connected', () => {
  it('reads /me and prefers mail over the UPN', async () => {
    fetchMock.mockResolvedValue(
      json({ id: 'graph-id', mail: 'ann@corp.test', userPrincipalName: 'ann@corp.onmicrosoft.com', displayName: 'Ann' }),
    );

    const me = await fetchTeamsUser('at');

    expect(me).toEqual({ id: 'graph-id', email: 'ann@corp.test', displayName: 'Ann' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url).startsWith('https://graph.microsoft.com/v1.0/me?')).toBe(true);
    expect(init.headers.Authorization).toBe('Bearer at');
  });

  it('falls back to the UPN for an account with no mailbox', async () => {
    fetchMock.mockResolvedValue(json({ id: 'g', mail: null, userPrincipalName: 'ann@corp.onmicrosoft.com' }));

    expect((await fetchTeamsUser('at')).email).toBe('ann@corp.onmicrosoft.com');
  });
});

describe('the instants sent to Graph', () => {
  // The Zoom client sent a UTC string AND a timezone name and Zoom read the
  // UTC digits as local time: every meeting two hours wrong, for months. Graph
  // has no timezone field, so the rule here is simpler and is pinned exactly:
  // UTC, a trailing Z, no milliseconds.
  it('is UTC with a Z and no milliseconds', () => {
    expect(teamsInstant(new Date('2026-11-03T10:00:00.000Z'))).toBe('2026-11-03T10:00:00Z');
    expect(teamsInstant('2026-11-03T11:30:00.789Z')).toBe('2026-11-03T11:30:00Z');
  });

  it('turns an offset into the equivalent UTC instant', () => {
    // 13:30 in Amsterdam (UTC+1 in November) is 12:30Z — the same booking
    // that came out as 11:30 in Zoom.
    expect(teamsInstant('2026-11-03T13:30:00+01:00')).toBe('2026-11-03T12:30:00Z');
  });

  it('rejects a date it cannot read instead of sending garbage', () => {
    expect(() => teamsInstant('not a date')).toThrow(/invalid date/);
  });
});

describe('creating a meeting', () => {
  it('POSTs subject and the exact start/end strings to /me/onlineMeetings', async () => {
    fetchMock.mockResolvedValue(json({ id: 'MSpkYz', joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/abc' }, 201));

    const m = await createTeamsMeeting('at', {
      topic: 'Opening session',
      startsAt: new Date('2026-11-03T10:00:00Z'),
      endsAt: new Date('2026-11-03T11:30:00Z'),
    });

    expect(m).toEqual({ meetingId: 'MSpkYz', joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/onlineMeetings');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer at');
    // The bytes on the wire, not a looser matcher.
    expect(init.body).toBe(
      '{"startDateTime":"2026-11-03T10:00:00Z","endDateTime":"2026-11-03T11:30:00Z","subject":"Opening session"}',
    );
  });

  it('is a failure when Graph answers without a join URL', async () => {
    fetchMock.mockResolvedValue(json({ id: 'x' }, 201));

    await expect(
      createTeamsMeeting('at', { topic: 't', startsAt: new Date(), endsAt: new Date() }),
    ).rejects.toThrow(/no id \/ joinWebUrl/);
  });

  it('is a failure on a non-2xx, with the status in the message', async () => {
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));

    await expect(
      createTeamsMeeting('at', { topic: 't', startsAt: new Date(), endsAt: new Date() }),
    ).rejects.toThrow(/403/);
  });
});

describe('updating and deleting', () => {
  it('PATCH carries BOTH start and end, as Microsoft requires', async () => {
    fetchMock.mockResolvedValue(json({}, 200));

    await updateTeamsMeeting('at', 'MSpk:1@x', {
      startsAt: '2026-11-04T09:00:00Z',
      endsAt: '2026-11-04T10:00:00Z',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/onlineMeetings/MSpk%3A1%40x');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"startDateTime":"2026-11-04T09:00:00Z","endDateTime":"2026-11-04T10:00:00Z"}');
  });

  it('DELETE treats 204 and 404 as done, anything else as a failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteTeamsMeeting('at', 'id1');
    expect(fetchMock.mock.calls[0]![1].method).toBe('DELETE');

    fetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }));
    await deleteTeamsMeeting('at', 'id1');

    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(deleteTeamsMeeting('at', 'id1')).rejects.toThrow(/500/);
  });
});

describe('the token host', () => {
  it('persists the ROTATED refresh token every time it refreshes', async () => {
    maybeSingle.mockResolvedValue({ data: { teams_refresh_token: 'rt-OLD' } });
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt-NEW', expires_in: 3600 }));

    const token = await teamsAccessTokenForUser('u1');

    expect(token).toBe('at');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]![0]).toEqual({ user_id: 'u1', teams_refresh_token: 'rt-NEW' });
  });

  it('serves the second call from cache without rotating again', async () => {
    maybeSingle.mockResolvedValue({ data: { teams_refresh_token: 'rt-OLD' } });
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt-NEW', expires_in: 3600 }));

    await teamsAccessTokenForUser('u1');
    await teamsAccessTokenForUser('u1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent refreshes into one rotation', async () => {
    maybeSingle.mockResolvedValue({ data: { teams_refresh_token: 'rt-OLD' } });
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt-NEW', expires_in: 3600 }));

    const [a, b] = await Promise.all([teamsAccessTokenForUser('u1'), teamsAccessTokenForUser('u1')]);

    expect(a).toBe('at');
    expect(b).toBe('at');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalid_grant clears the whole connection and answers null', async () => {
    maybeSingle.mockResolvedValue({ data: { teams_refresh_token: 'rt-OLD' } });
    fetchMock.mockResolvedValue(json({ error: 'invalid_grant' }, 400));

    const token = await teamsAccessTokenForUser('u1');

    expect(token).toBeNull();
    expect(upsert.mock.calls[0]![0]).toEqual({
      user_id: 'u1',
      teams_refresh_token: null,
      teams_account_email: null,
      teams_user_id: null,
    });
  });

  it('invalid_client (OUR secret) does NOT wipe the person’s connection', async () => {
    maybeSingle.mockResolvedValue({ data: { teams_refresh_token: 'rt-OLD' } });
    fetchMock.mockResolvedValue(json({ error: 'invalid_client' }, 401));

    await expect(teamsAccessTokenForUser('u1')).rejects.toBeInstanceOf(TeamsTokenError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('answers null for someone who never connected, without calling Microsoft', async () => {
    maybeSingle.mockResolvedValue({ data: null });

    expect(await teamsAccessTokenForUser('u1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('saveTeamsConnection', () => {
  it('writes ONLY teams columns — never personal_room_url or a Zoom/Google column', async () => {
    await saveTeamsConnection('u1', 'rt', 'ann@corp.test', 'graph-id');

    const patch = upsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch).toEqual({
      user_id: 'u1',
      teams_refresh_token: 'rt',
      teams_account_email: 'ann@corp.test',
      teams_user_id: 'graph-id',
    });
    expect(Object.keys(patch).filter((k) => !k.startsWith('teams_') && k !== 'user_id')).toEqual([]);
    expect(upsert.mock.calls[0]![1]).toEqual({ onConflict: 'user_id' });
  });

  it('a rotation (token only) leaves the email and id alone', async () => {
    await saveTeamsConnection('u1', 'rt2');

    expect(upsert.mock.calls[0]![0]).toEqual({ user_id: 'u1', teams_refresh_token: 'rt2' });
  });

  it('null disconnects: token, email and id together, still nothing else', async () => {
    await saveTeamsConnection('u1', null);

    expect(upsert.mock.calls[0]![0]).toEqual({
      user_id: 'u1',
      teams_refresh_token: null,
      teams_account_email: null,
      teams_user_id: null,
    });
  });

  it('reports a database error instead of swallowing it', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'boom' } });

    expect(await saveTeamsConnection('u1', 'rt')).toEqual({ error: 'boom' });
  });
});
