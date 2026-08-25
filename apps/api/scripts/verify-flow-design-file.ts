/**
 * Validate a flow design file against the shape PUT /flows/:id/graph accepts,
 * without a server or a session.
 *
 *   pnpm --filter @thefibre/api exec tsx scripts/verify-flow-design-file.ts <file.json>
 *
 * Reports what the API would store, so a hand-authored or generated file can be
 * checked before anyone opens the builder.
 */
import { readFileSync } from 'node:fs';
import { Graph } from '../src/routes/flow.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: verify-flow-design-file.ts <file.json>');
  process.exit(2);
}

const parsed = Graph.safeParse(JSON.parse(readFileSync(path, 'utf8')));
if (!parsed.success) {
  console.error('INVALID\n', JSON.stringify(parsed.error.flatten(), null, 2));
  process.exit(1);
}
const g = parsed.data;

// The same structural rules the route enforces after schema validation.
const keys = new Set(g.steps.map((s) => s.key));
const problems: string[] = [];
if (keys.size !== g.steps.length) problems.push('duplicate step keys');
const entries = g.steps.filter((s) => s.kind === 'entry').length;
if (entries !== 1) problems.push(`exactly one entry step required, found ${entries}`);
if (!g.steps.some((s) => s.kind === 'end_positive' || s.kind === 'end_negative')) {
  problems.push('at least one end step required');
}
for (const t of g.transitions) {
  if (!keys.has(t.from)) problems.push(`transition.from "${t.from}" is not a step key`);
  if (!keys.has(t.to)) problems.push(`transition.to "${t.to}" is not a step key`);
}
for (const d of g.step_default_tasks) {
  if (!keys.has(d.step)) problems.push(`step_default_task.step "${d.step}" is not a step key`);
}

if (problems.length) {
  console.error('INVALID\n - ' + problems.join('\n - '));
  process.exit(1);
}

console.log('VALID');
console.log(`  steps              ${g.steps.length}`);
console.log(`  transitions        ${g.transitions.length}`);
console.log(`  default tasks      ${g.step_default_tasks.length}`);
console.log(`  gate tasks         ${g.transitions.reduce((n, t) => n + t.gate_tasks.length, 0)}`);
console.log(`  groups             ${[...new Set(g.steps.map((s) => s.group_key).filter(Boolean))].join(', ') || '—'}`);
console.log(`  progression        ${g.flow?.progression ?? '(unchanged)'}`);
console.log(`  system_key         ${g.flow?.system_key ?? '(unchanged)'}`);
