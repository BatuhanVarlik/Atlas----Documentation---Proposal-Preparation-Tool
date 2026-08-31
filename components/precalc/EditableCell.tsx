'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { CellValue } from '@/lib/precalc/formula';
import type { RawValue } from '@/lib/precalc/types';
import { cn } from '@/lib/utils';
import { formatCell, parseEditText, toEditText } from './cellFormat';
import type { CellFormat } from './columns';

interface Props {
  value: CellValue;
  format: CellFormat;
  align?: 'left' | 'right' | 'center';
  /** Kullanıcı tarafından girilmiş (kaynak dosyadan farklı) değer mi? */
  edited: boolean;
  /** Hücre boşken gösterilecek ipucu metni. */
  placeholder?: string;
  onCommit: (value: RawValue) => void;
}

/**
 * Düzenlenebilir hücre. Yazarken yerel durumda tutulur, yalnızca odak
 * kaybında ya da Enter'da motora yazılır — böylece her tuş vuruşunda
 * tüm tablo yeniden hesaplanmaz.
 */
function EditableCellBase({ value, format, align = 'left', edited, placeholder, onCommit }: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Dışarıdan değer değişirse (sıfırlama vb.) düzenleme metnini tazele
  useEffect(() => {
    if (!focused) setDraft(toEditText(value, format));
  }, [value, format, focused]);

  const commit = () => {
    const parsed = parseEditText(draft, format);
    const current = toEditText(value, format);
    if (draft.trim() !== current.trim()) onCommit(parsed);
    setFocused(false);
  };

  const display = formatCell(value, format);

  return (
    <input
      ref={inputRef}
      type={format === 'date' ? 'date' : 'text'}
      inputMode={format === 'text' || format === 'date' ? undefined : 'decimal'}
      value={focused || format === 'date' ? draft : display}
      placeholder={placeholder}
      onFocus={() => { setDraft(toEditText(value, format)); setFocused(true); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); inputRef.current?.blur(); }
        if (e.key === 'Escape') { setDraft(toEditText(value, format)); setFocused(false); inputRef.current?.blur(); }
      }}
      className={cn(
        'w-full h-full px-2 bg-transparent text-xs outline-none rounded-sm',
        // Kenarlık her zaman görünür: hangi hücrelere yazılabildiği üzerine
        // gelmeden anlaşılsın (imleçle arayarak bulunmasın).
        'border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:bg-white',
        'focus:ring-1 focus:ring-blue-500/30',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        edited && 'bg-amber-50 font-medium text-amber-900',
      )}
    />
  );
}

export const EditableCell = memo(EditableCellBase);
