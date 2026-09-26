'use client';

// One number field, as the Numbers tab renders every variable.

import { FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import type { NumberInput } from '@/lib/engine';

export function Field({ def, value, onChange, disabled = false }: { def: NumberInput; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2 py-1">
      <label className="text-[12.5px] leading-tight">{def.label}{def.unit && <span className="block text-[11px] text-ink-muted">{def.unit}</span>}</label>
      <input type="number" step={def.step ?? 1} value={value} disabled={disabled} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} className={`${FIELD_INPUT_CLASS} h-8 text-right tabular-nums`} />
    </div>
  );
}
