'use client';

import { useState } from 'react';
import { Layers, Check } from 'lucide-react';
import { basemapOrder, basemaps, type BasemapId } from '@/lib/map/basemaps';

type Props = {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
  maptilerKey?: string;
};

export function BasemapSwitcher({ value, onChange, maptilerKey }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-3 top-3 z-20 pointer-events-auto">
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Change basemap"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-700 shadow-md ring-1 ring-black/5 hover:bg-slate-50"
        >
          <Layers className="h-5 w-5" />
        </button>

        {open && (
          <div
            role="menu"
            className="w-44 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5"
          >
            {basemapOrder.map((id) => {
              const b = basemaps[id];
              const isActive = id === value;
              const disabled = !b.available({ maptilerKey });
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  disabled={disabled}
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-slate-700 hover:bg-slate-50'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span>{b.label}</span>
                  {isActive && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
