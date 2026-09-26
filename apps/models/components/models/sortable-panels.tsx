'use client';

// The result panels in the order this person wants them (Sjoerd,
// 2026-09-26: "the above window, drag and drop how the elements are ordered
// and save for this person"). Plain HTML drag and drop on a grip; the order
// is remembered in this browser per model and per view.

import { useEffect, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

export type PanelDef = { id: string; node: ReactNode };

export function SortablePanels({ storageKey, panels, title }: { storageKey: string; panels: PanelDef[]; title: string }) {
  const ids = panels.map((p) => p.id);
  const [order, setOrder] = useState<string[]>(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as string[] | null;
      if (Array.isArray(saved)) setOrder([...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))]);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  function drop(target: string, from: string) {
    if (from === target || !order.includes(from)) return;
    const next = order.filter((id) => id !== from);
    next.splice(next.indexOf(target), 0, from);
    setOrder(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  return (
    <div className="flex flex-col gap-4">
      {order.map((id) => {
        const p = panels.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div key={id} draggable
            // Safari drops nothing unless the drag carries data, and the id
            // travels in the transfer as well so a drop does not depend on
            // state having caught up.
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDragging(id); }}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== id) setOver(id); }}
            onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain') || dragging; if (from) drop(id, from); setOver(null); setDragging(null); }} className={`relative rounded-lg transition-shadow ${over === id && dragging !== id ? 'ring-2 ring-line-strong' : ''} ${dragging === id ? 'opacity-60' : ''}`}>
            <div className="absolute -left-5 top-3 hidden cursor-grab text-ink-muted hover:text-ink lg:block" title={title}><GripVertical size={14} /></div>
            {p.node}
          </div>
        );
      })}
    </div>
  );
}
