'use client';

// The result panels in the order this person wants them (Sjoerd,
// 2026-09-26: "the above window, drag and drop how the elements are ordered
// and save for this person"). Two ways to move a panel — drag it by its
// grip, or the up and down arrows beside the grip — because HTML drag and
// drop is the one thing every browser does a little differently. The order
// is remembered in this browser per model and per view.

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

export type PanelDef = { id: string; node: ReactNode };

export function SortablePanels({ storageKey, panels, title }: { storageKey: string; panels: PanelDef[]; title: string }) {
  const ids = panels.map((p) => p.id);
  const [order, setOrder] = useState<string[]>(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // A new key (another view, another model) starts from that view's own
  // panels — the previous view's order must not leak in.
  useEffect(() => {
    let next = ids;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as string[] | null;
      if (Array.isArray(saved)) next = [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))];
    } catch {}
    setOrder(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, ids.join('|')]);
  function commit(next: string[]) {
    setOrder(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  function moveTo(from: string, target: string) {
    if (from === target || !order.includes(from) || !order.includes(target)) return;
    const next = order.filter((id) => id !== from);
    next.splice(next.indexOf(target), 0, from);
    commit(next);
  }
  function nudge(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  }
  const btn = 'rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30';
  return (
    <div className="flex flex-col gap-4">
      {order.map((id, i) => {
        const p = panels.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div key={id}
            onDragEnter={(e) => { e.preventDefault(); if (dragging && dragging !== id) setOver(id); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragging && dragging !== id && over !== id) setOver(id); }}
            onDragLeave={() => { if (over === id) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain') || dragging; if (from) moveTo(from, id); setOver(null); setDragging(null); }}
            className={`relative rounded-lg transition-shadow ${over === id && dragging !== id ? 'ring-2 ring-line-strong' : ''} ${dragging === id ? 'opacity-60' : ''}`}>
            <div className="absolute -left-6 top-2 hidden flex-col items-center lg:flex">
              <button type="button" onClick={() => nudge(id, -1)} disabled={i === 0} className={btn} title={title}><ChevronUp size={13} /></button>
              <span draggable title={title} className="cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing"
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDragging(id); }}
                onDragEnd={() => { setDragging(null); setOver(null); }}><GripVertical size={14} /></span>
              <button type="button" onClick={() => nudge(id, 1)} disabled={i === order.length - 1} className={btn} title={title}><ChevronDown size={13} /></button>
            </div>
            {p.node}
          </div>
        );
      })}
    </div>
  );
}
