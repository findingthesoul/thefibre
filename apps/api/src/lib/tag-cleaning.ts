// Which tags want tidying, and why.
//
// Sjoerd, 2026-09-14: *"there should be tag cleaning. Look for doubles...
// etc... look for ones that have not been used for a long time... etc..
// present a list for cleaning once in a while."*
//
// Tags are made by writing (`#retreat` in a note), matched by EXACT name on
// save, so `Retreat`, `retreat` and `retreats` become three tags within a
// month of real use — and the rarity rule (connections-model.md §3.5) then
// reads three weak links where there is one strong one.
//
// Pure: no database. The route reads the rows and asks this what they mean,
// so the rules can be tested without a workspace.
//
// ── What this proposes, and what it never does ──────────────────────────────
//
// It PROPOSES. Nothing here merges or deletes; a person reads the list and
// decides. A near-spelling is sometimes two real things (`#coach` and
// `#coaches` may be the same; `#art` and `#arts` may not), and the cost of a
// wrong merge is people losing a tag somebody gave them on purpose.

export type TagFacts = {
  id: string;
  name: string;
  organisation_id: string | null;
  /** How many people carry it. */
  people: number;
  /**
   * When it was last put to use — the later of a person being tagged and a
   * recent note mentioning it — or null when nothing dated says so. Null is
   * NOT "long ago": tags from before provenance was recorded have no honest
   * date, and calling them stale would be a guess presented as a finding.
   */
  last_used: string | null;
};

export type DoubleReason = 'spelling' | 'plural' | 'typo';

export type DoubleGroup = {
  /** The one to keep: an organisation's tag, else the most used, else the shortest name. */
  keep: TagFacts;
  others: TagFacts[];
  reason: DoubleReason;
};

/** Case, spaces, hyphens and punctuation do not make a different word. */
export function spellingKey(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * The same word in the singular, for the English and Dutch plurals people
 * actually type in tags. Deliberately crude, and only ever used to PROPOSE:
 * `retreats`→`retreat`, `workshops`→`workshop`, `trainingen`→`training`.
 * Short words are left alone, since `bus`, `gas` and `ons` are not plurals.
 */
export function singularKey(name: string): string {
  const k = spellingKey(name);
  if (k.length <= 4) return k;
  if (/(ches|shes|sses|xes)$/.test(k)) return k.slice(0, -2);
  if (k.endsWith('ies') && k.length > 5) return `${k.slice(0, -3)}y`;
  if (k.endsWith('en') && k.length > 6) return k.slice(0, -2);
  if (k.endsWith('s') && !k.endsWith('ss')) return k.slice(0, -1);
  return k;
}

/** True when a and b differ by exactly one insertion, deletion or substitution. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) === 1;
}

function pickKeep(group: TagFacts[]): TagFacts {
  return [...group].sort(
    (a, b) =>
      Number(Boolean(b.organisation_id)) - Number(Boolean(a.organisation_id)) ||
      b.people - a.people ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name),
  )[0]!;
}

/**
 * Groups of tags that are probably one word.
 *
 * Three passes, strongest first, and a tag is placed in at most one group:
 *   spelling — identical once case and punctuation are ignored
 *   plural   — identical once singular
 *   typo     — one letter apart, and only for words of six letters or more,
 *              because `#art`/`#arc` are two words and `#facilitaton` is not
 *
 * Two tags that BOTH name an organisation are never grouped: they point at two
 * real organisations, and merging would tell one company's people they belong
 * to the other.
 */
export function findDoubles(tags: readonly TagFacts[]): DoubleGroup[] {
  const placed = new Set<string>();
  const groups: DoubleGroup[] = [];

  const emit = (members: TagFacts[], reason: DoubleReason) => {
    const orgs = members.filter((m) => m.organisation_id);
    // Keep at most one organisation in a group.
    const usable = orgs.length > 1 ? members.filter((m) => !m.organisation_id || m === orgs[0]) : members;
    if (usable.length < 2) return;
    const keep = pickKeep(usable);
    for (const m of usable) placed.add(m.id);
    groups.push({
      keep,
      others: usable.filter((m) => m !== keep).sort((a, b) => a.name.localeCompare(b.name)),
      reason,
    });
  };

  const byKey = (key: (n: string) => string, reason: DoubleReason) => {
    const buckets = new Map<string, TagFacts[]>();
    for (const t of tags) {
      if (placed.has(t.id)) continue;
      const k = key(t.name);
      if (!k) continue;
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(t);
    }
    for (const members of buckets.values()) if (members.length > 1) emit(members, reason);
  };

  byKey(spellingKey, 'spelling');
  byKey(singularKey, 'plural');

  const rest = tags.filter((t) => !placed.has(t.id) && spellingKey(t.name).length >= 6);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (placed.has(a.id)) continue;
    const ka = spellingKey(a.name);
    const members = [a];
    for (let j = i + 1; j < rest.length; j++) {
      const b = rest[j]!;
      if (!placed.has(b.id) && oneEditApart(ka, spellingKey(b.name))) members.push(b);
    }
    if (members.length > 1) emit(members, 'typo');
  }

  return groups.sort((a, b) => b.keep.people - a.keep.people || a.keep.name.localeCompare(b.keep.name));
}

/**
 * Tags on nobody. Invisible everywhere else — the tag list hides them — so
 * this is the only place they can be seen and removed. An organisation's tag
 * is left out: the organisation still exists, and its tag is how writing its
 * name connects people to it.
 */
export function findUnused(tags: readonly TagFacts[]): TagFacts[] {
  return tags
    .filter((t) => t.people === 0 && !t.organisation_id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Tags still on people but not put to use in `days`. Oldest first.
 * A tag with no dated use is left out — see `last_used`.
 */
export function findStale(tags: readonly TagFacts[], now: Date, days: number): TagFacts[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return tags
    .filter((t) => t.people > 0 && !t.organisation_id && t.last_used && Date.parse(t.last_used) < cutoff)
    .sort((a, b) => Date.parse(a.last_used!) - Date.parse(b.last_used!));
}

/** Whether a note body mentions a tag: `#name`, or the name as whole words. */
export function mentions(body: string, tagName: string): boolean {
  const words = (s: string) =>
    ` ${s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
  const needle = words(tagName);
  return needle.trim().length > 0 && words(body).includes(needle);
}
