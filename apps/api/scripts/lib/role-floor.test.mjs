import { describe, expect, it } from 'vitest';
import { planMember, splitSeatHolders } from './role-floor.mjs';

// NEVER LOWER A ROLE. The sweep is "everybody Internal and at least
// Organiser" — so a super_admin (Sjoerd, in soul.com) and an admin keep what
// they have, and only the missing or lesser roles rise.
describe('planMember — the role is a floor', () => {
  const target = { role: 'organiser', relationship: 'internal' };

  it('a super_admin keeps super_admin, and is only made internal', () => {
    expect(planMember({ workspace_role: 'super_admin', relationship_type: 'external' }, target)).toMatchObject({
      nextRole: 'super_admin',
      roleChanges: false,
      nextRel: 'internal',
      relChanges: true,
      senior: true,
    });
  });

  it('an admin keeps admin', () => {
    expect(planMember({ workspace_role: 'admin', relationship_type: 'internal' }, target)).toMatchObject({
      nextRole: 'admin',
      roleChanges: false,
      relChanges: false,
    });
  });

  it('no role, or an unknown pre-migration value, is RAISED to organiser', () => {
    expect(planMember({ workspace_role: null, relationship_type: 'external' }, target)).toMatchObject({
      nextRole: 'organiser',
      roleChanges: true,
    });
    expect(planMember({ workspace_role: 'member', relationship_type: 'external' }, target).nextRole).toBe('organiser');
  });

  it('an organiser who is already internal is left alone entirely', () => {
    const p = planMember({ workspace_role: 'organiser', relationship_type: 'internal' }, target);
    expect(p.roleChanges || p.relChanges).toBe(false);
  });

  it('with no relationship given, the relationship is kept', () => {
    expect(planMember({ workspace_role: null, relationship_type: 'external' }, { role: 'organiser' }).nextRel).toBe('external');
  });
});

// SEAT HOLDERS ARE LEFT ALONE. A paying member whose tier gives them a Fibre
// seat has a workspace_member row the seat sync owns (external, its own
// role). The sweep is for the organisation's own people.
describe('splitSeatHolders', () => {
  const rows = [{ user_id: 'staff' }, { user_id: 'payer' }];
  it('a seat holder is not swept, and is listed', () => {
    const { sweep, seatHolders } = splitSeatHolders(rows, new Set(['payer']));
    expect(sweep.map((r) => r.user_id)).toEqual(['staff']);
    expect(seatHolders.map((r) => r.user_id)).toEqual(['payer']);
  });
  it('only when asked by name are seat holders swept too', () => {
    expect(splitSeatHolders(rows, new Set(['payer']), true).sweep).toHaveLength(2);
  });
});
