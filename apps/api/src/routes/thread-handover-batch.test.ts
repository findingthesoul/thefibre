import { describe, expect, it } from 'vitest';
import { suggestedForBatch } from './thread-handover.js';

// Which of a departed organiser's threads the admin's list ticks for them:
// upcoming or running ones. The day is passed in, never read from the clock.
describe('suggestedForBatch', () => {
  const today = '2026-10-16';
  it('ticks a draft or active thread that has not ended', () => {
    expect(suggestedForBatch({ status: 'active', ends_on: '2026-11-01' }, today)).toBe(true);
    expect(suggestedForBatch({ status: 'draft', ends_on: null }, today)).toBe(true);
    expect(suggestedForBatch({ status: 'active', ends_on: today }, today)).toBe(true); // ends today: still running
  });
  it('leaves past and completed threads unticked', () => {
    expect(suggestedForBatch({ status: 'active', ends_on: '2026-10-15' }, today)).toBe(false);
    expect(suggestedForBatch({ status: 'completed', ends_on: null }, today)).toBe(false);
    expect(suggestedForBatch({ status: null, ends_on: null }, today)).toBe(false);
  });
});
