import { describe, expect, it } from 'vitest';
import { joinLink, placeLink } from './meeting-links';

describe('the way in', () => {
  it('prefers the calendar’s own conferencing entry over the location', () => {
    expect(joinLink('Room 2', 'https://meet.google.com/abc-defg-hij')).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      kind: 'meet',
    });
  });

  it('finds a link somebody typed into the location', () => {
    expect(joinLink('Zoom: https://us02web.zoom.us/j/12345 (code 9999)', null)).toEqual({
      url: 'https://us02web.zoom.us/j/12345',
      kind: 'zoom',
    });
  });

  it('names Teams, Meet and anything else', () => {
    expect(joinLink('https://teams.microsoft.com/l/meetup-join/x', null)!.kind).toBe('teams');
    expect(joinLink('https://teams.live.com/meet/x', null)!.kind).toBe('teams');
    expect(joinLink('https://meet.google.com/x', null)!.kind).toBe('meet');
    expect(joinLink('https://whereby.com/room', null)!.kind).toBe('video');
  });

  it('is not fooled by a host that merely ends in the name', () => {
    expect(joinLink('https://notzoom.us/j/1', null)!.kind).toBe('video');
    expect(joinLink('https://evil.com/zoom.us/j/1', null)!.kind).toBe('video');
  });

  it('drops punctuation the sentence put after the link', () => {
    expect(joinLink('Join at https://zoom.us/j/12345.', null)!.url).toBe('https://zoom.us/j/12345');
  });

  it('refuses anything that is not http(s)', () => {
    expect(joinLink('javascript:alert(1)', null)).toBeNull();
    expect(joinLink(null, 'javascript:alert(1)')).toBeNull();
    expect(joinLink('data:text/html,<script>', null)).toBeNull();
  });

  it('is null for a plain address and for nothing at all', () => {
    expect(joinLink('EBBF office, Athens', null)).toBeNull();
    expect(joinLink(null, null)).toBeNull();
    expect(joinLink('', '')).toBeNull();
  });
});

describe('the place', () => {
  it('searches maps for free text, exactly as written', () => {
    const p = placeLink('EBBF office, Athens')!;
    expect(p.label).toBe('EBBF office, Athens');
    expect(p.url).toBe(
      'https://www.google.com/maps/search/?api=1&query=EBBF%20office%2C%20Athens',
    );
  });

  it('is null for a location that is only a link — Zoom puts one there', () => {
    expect(placeLink('https://us02web.zoom.us/j/12345')).toBeNull();
  });

  it('keeps the room when the location is a room AND a link', () => {
    expect(placeLink('Room 2, https://zoom.us/j/1')!.label).toBe('Room 2');
  });

  it('flattens an address typed over several lines', () => {
    expect(placeLink('Paasheuvelgroep\n30 Het Frussel\n8076 RE Vierhouten')!.label).toBe(
      'Paasheuvelgroep 30 Het Frussel 8076 RE Vierhouten',
    );
  });

  it('is null for a desk number, an empty string and nothing', () => {
    expect(placeLink('2')).toBeNull();
    expect(placeLink('   ')).toBeNull();
    expect(placeLink(null)).toBeNull();
  });
});
