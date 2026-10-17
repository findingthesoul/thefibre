import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUS, toStatusFilter } from './thread-status-filter';

describe('the Threads list status (2026-10-17: "Show active as default")', () => {
  it('opens on Active when the address names nothing', () => {
    expect(DEFAULT_STATUS).toBe('active');
    expect(toStatusFilter(undefined)).toBe('active');
    expect(toStatusFilter(null)).toBe('active');
    expect(toStatusFilter('')).toBe('active');
  });
  it('an explicit choice wins, so links and the back button keep their meaning', () => {
    expect(toStatusFilter('all')).toBe('all');
    expect(toStatusFilter('draft')).toBe('draft');
    expect(toStatusFilter('past')).toBe('past');
    expect(toStatusFilter('active')).toBe('active');
  });
  it('anything else is the default, never a filter that hides everything', () => {
    expect(toStatusFilter('ALL')).toBe('active');
    expect(toStatusFilter('archived')).toBe('active');
  });
});
