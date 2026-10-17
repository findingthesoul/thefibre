// The tenant boundary, held by the accessor instead of by each route.
//
// Most routes do their work with the service-role client, which row level
// security never sees (handbook §2). Until this file, every one of those
// queries carried its own `.eq('workspace_id', ctx.workspaceId)` — or relied
// on an earlier line having proved that an id belonged to the caller's
// workspace — and the only way to know which was to read the whole handler.
// Both cross-workspace holes found in September 2026 were exactly that: a
// filter somebody did not write.
//
// `tenantDb(ctx)` makes the filter impossible to forget:
//
//   const db = tenantDb(ctx);
//   db.from('person').select('id, first_name').eq('id', id)   // + workspace_id = ctx's, always
//   db.from('person').update({ … }).eq('id', id)              // + workspace_id = ctx's, always
//   db.from('person').insert({ … })                           // workspace_id stamped; another one refused
//
// A table without a `workspace_id` column is reached through the parent that
// has one. `child()` proves the parent ids are in the workspace first, then
// forces the foreign key the same way:
//
//   const tags = await db.child('person_tag', { via: 'person', key: 'person_id', id: personId });
//   if (!tags) return c.json({ error: 'not found' }, 404);
//   tags.select('tag')                                        // + person_id = personId, always
//
// A query that must cross workspaces on purpose — a webhook that names a
// Stripe subscription, the scheduler, a public page resolved by slug — says
// so: `serviceRole('stripe webhook: the event names a subscription, not a
// workspace')`. That returns the raw client, and the reason is the review
// record. lib/service-role-boundary.test.ts refuses any NEW raw use of
// `adminClient` outside this file; every existing one is on its baseline,
// which only shrinks.
//
// What it does NOT scope: an EMBEDDED select. `select('*, person(first_name)')`
// follows the foreign key to whatever row it names, and the workspace filter
// applies to the outer table only. Today that is safe exactly as far as no
// row points across workspaces — which is what the stamping here protects
// going forward and what F3 (composite foreign keys on workspace_id) is meant
// to make true in the database. Until then, prefer a second scoped query over
// an embed when the embedded table holds anything personal.
//
// Failure is always closed: a missing row, never another workspace's row.
// Misuse (an insert naming another workspace, an upsert whose conflict target
// could match another workspace's row) throws, because a route that tried it
// has a bug a 500 should surface.

import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '../db.js';
import { isTenantTable, type TenantTable } from './tenant-tables.js';

export class TenancyError extends Error {
  constructor(message: string) {
    super(`[tenancy] ${message}`);
    this.name = 'TenancyError';
  }
}

type Row = Record<string, unknown>;
type Value = string | readonly string[];

// `any` below because the builders are untyped (no generated Database type)
// and each verb returns a differently-shaped generic builder.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Filterable = { eq: (k: string, v: any) => any; in: (k: string, v: any[]) => any };
type Count = 'exact' | 'planned' | 'estimated';

/** One table, with one column pinned to one value (or a set of values). */
export class Scoped {
  private readonly many: boolean;
  private readonly values: readonly string[];

  constructor(
    private readonly client: SupabaseClient,
    readonly table: string,
    readonly key: string,
    private readonly value: Value,
  ) {
    this.many = typeof value !== 'string';
    this.values = this.many ? (value as readonly string[]) : [value as string];
  }

  /** The value(s) this scope is pinned to. */
  get pinnedTo(): readonly string[] {
    return this.values;
  }

  // Unconstrained on purpose: checking a builder against a structural type
  // makes TypeScript instantiate supabase-js's query types without bound.
  private filter<B>(b: B): B {
    const q = b as unknown as Filterable;
    return (this.many ? q.in(this.key, [...this.values]) : q.eq(this.key, this.value)) as B;
  }

  private stamp(row: Row, verb: string): Row {
    const given = row[this.key];
    if (given === undefined || given === null) {
      if (this.many) throw new TenancyError(`${verb} on a table scoped to several ${this.key}s must name its ${this.key}`);
      return { ...row, [this.key]: this.value };
    }
    if (typeof given !== 'string' || !this.values.includes(given)) {
      throw new TenancyError(`${verb} names a ${this.key} outside this scope`);
    }
    return row;
  }

  private stampAll(rows: Row | Row[], verb: string): Row | Row[] {
    return Array.isArray(rows) ? rows.map((r) => this.stamp(r, verb)) : this.stamp(rows, verb);
  }

  /** select … where <key> = <value>. Chain more filters as usual. */
  select(columns?: string, options?: { head?: boolean; count?: Count }) {
    // `as '*'`: supabase-js parses a select string at the type level, and a
    // plain `string` sends that parser into unbounded recursion. The client
    // is untyped (no generated Database type), so rows are untyped either way.
    return this.filter(this.client.from(this.table).select(columns as '*', options));
  }

  /** update … where <key> = <value>. Moving a row to another scope is refused. */
  update(values: Row, options?: { count?: Count }) {
    if (this.key in values && !(typeof values[this.key] === 'string' && this.values.includes(values[this.key] as string))) {
      throw new TenancyError(`update would move a ${this.table} row to another ${this.key}`);
    }
    return this.filter(this.client.from(this.table).update(values, options));
  }

  /** delete … where <key> = <value>. */
  delete(options?: { count?: Count }) {
    return this.filter(this.client.from(this.table).delete(options));
  }

  /** insert, with <key> stamped; a row naming another value is refused. */
  insert(rows: Row | Row[], options?: { count?: Count; defaultToNull?: boolean }) {
    return this.client.from(this.table).insert(this.stampAll(rows, 'insert'), options);
  }

  /**
   * upsert, with <key> stamped. The conflict target MUST include <key>: an
   * upsert on a key that does not would update the row it collides with
   * whichever workspace that row belongs to, and stamp it as ours.
   */
  upsert(rows: Row | Row[], options: { onConflict: string; ignoreDuplicates?: boolean; count?: Count; defaultToNull?: boolean }) {
    const target = (options?.onConflict ?? '').split(',').map((s) => s.trim());
    if (!target.includes(this.key)) {
      throw new TenancyError(
        `upsert on ${this.table} must name ${this.key} in onConflict (got "${options?.onConflict ?? ''}") — ` +
          `otherwise it can overwrite another scope's row`,
      );
    }
    return this.client.from(this.table).upsert(this.stampAll(rows, 'upsert'), options);
  }

  /**
   * A table with no `workspace_id`, reached through this one. Proves every
   * id in `id` is a row of THIS scope (so of the workspace), then returns
   * the child table pinned to `key` in those ids. Null when any id is not
   * ours — a missing row and another workspace's row are the same answer,
   * on purpose, so the caller cannot learn that an id exists elsewhere.
   */
  async child(childTable: string, ref: { key: string; id: Value; parentKey?: string }): Promise<Scoped | null> {
    if (isTenantTable(childTable)) {
      throw new TenancyError(`${childTable} has its own workspace_id — use from('${childTable}'), not child()`);
    }
    const ids = [...new Set(typeof ref.id === 'string' ? [ref.id] : ref.id)];
    if (ids.length === 0 || ids.some((i) => typeof i !== 'string' || !i)) return null;
    const parentKey = ref.parentKey ?? 'id';
    const { data, error } = await this.select(parentKey).in(parentKey, ids);
    if (error) throw new TenancyError(`checking ${this.table}.${parentKey} for ${childTable}: ${error.message}`);
    const found = new Set(((data ?? []) as unknown as Row[]).map((r) => String(r[parentKey])));
    if (!ids.every((i) => found.has(i))) return null;
    return new Scoped(this.client, childTable, ref.key, typeof ref.id === 'string' ? ref.id : ids);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The service-role client with the caller's workspace bound in. Takes a
 * RequestContext (anything with `workspaceId`) or a workspace id — the
 * scheduler and webhooks resolve the workspace from the row first, then
 * scope everything after it.
 */
export function tenantDb(scope: { workspaceId: string } | string, client: SupabaseClient = adminClient) {
  const workspaceId = typeof scope === 'string' ? scope : scope.workspaceId;
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new TenancyError('tenantDb needs a workspace id; this request has none');
  }
  const from = (table: TenantTable) => {
    if (!isTenantTable(table)) {
      throw new TenancyError(`${table} has no workspace_id — reach it with child() through its parent`);
    }
    return new Scoped(client, table, 'workspace_id', workspaceId);
  };
  return {
    workspaceId,
    from,
    /** The caller's own `workspace` row, pinned on its id. */
    workspace() {
      return new Scoped(client, 'workspace', 'id', workspaceId);
    },
    /** Shorthand for `from(via).child(table, { key, id })`. */
    child(table: string, ref: { via: TenantTable; key: string; id: Value; parentKey?: string }) {
      return from(ref.via).child(table, ref);
    },
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;

/**
 * The raw service-role client, for a query that must not be scoped to one
 * workspace. The reason is required and is read by the boundary test: it is
 * the review record for why this line may cross workspaces. Write it for the
 * next reviewer — what the query is keyed on instead, and why that is safe.
 */
export function serviceRole(reason: string): SupabaseClient {
  if (typeof reason !== 'string' || reason.trim().length < 12) {
    throw new TenancyError('serviceRole() needs a reason a reviewer can check');
  }
  return adminClient;
}
