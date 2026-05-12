'use client';

import { useEffect, useRef, useState } from 'react';

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | number)[];
  placeholder?: string;
  type?: 'text' | 'number';
  min?: number;
  step?: string;
  className?: string;
  id?: string;
}

const VISIBLE_ROWS = 4;
const ROW_PX = 32;

export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  type = 'text',
  min,
  step,
  className = '',
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => String(o).toLowerCase().includes(q))
    : options;

  function selectOption(o: string | number) {
    onChange(String(o));
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          else if (e.key === 'ArrowDown' && !open) setOpen(true);
        }}
        className={`w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto"
          style={{ maxHeight: `${VISIBLE_ROWS * ROW_PX}px` }}
        >
          {filtered.map((o) => {
            const s = String(o);
            const selected = s === value;
            return (
              <li
                key={s}
                onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}
                className={`px-2.5 text-sm cursor-pointer flex items-center hover:bg-blue-50 ${
                  selected ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-700'
                }`}
                style={{ height: `${ROW_PX}px` }}
              >
                {s}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
