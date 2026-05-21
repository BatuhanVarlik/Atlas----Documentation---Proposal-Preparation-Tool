'use client';

import { useEffect, useState } from 'react';
import { formatIntegerInputTR, formatNumberTR, parseNumberTR } from '@/lib/utils';

interface Props {
  value: number | null;
  onChange: (next: number | null) => void;
  mode?: 'integer' | 'decimal';
  decimals?: number;
  placeholder?: string;
  className?: string;
  min?: number;
  disabled?: boolean;
}

/**
 * Türkçe locale uyumlu sayı input'u.
 *
 * - integer modu: yazım sırasında binlik nokta uygular ("30000" → "30.000")
 * - decimal modu: virgül veya nokta ondalık ayırıcı olarak kabul edilir
 *
 * `value` her zaman saf number (veya null) — TR formatlama yalnızca görselde.
 * type="text" kullanıldığı için tarayıcının `type="number"` davranışından
 * kaynaklanan locale-bağlı yuvarlama / kesme sorunları oluşmaz.
 */
export default function NumberInputTR({
  value,
  onChange,
  mode = 'integer',
  decimals = 2,
  placeholder,
  className,
  min,
  disabled,
}: Props) {
  const [text, setText] = useState<string>(() => formatFromValue(value, mode, decimals));

  // Dış value değişirse (örn. parent reset, fetch sonrası) text'i senkronize et —
  // ama kullanıcı yazma sırasında parse(text) === value olduğu sürece dokunma.
  useEffect(() => {
    const currentParsed = parseNumberTR(text);
    if (value == null && text === '') return;
    if (value != null && !isNaN(currentParsed) && Math.abs(currentParsed - value) < 1e-9) return;
    setText(formatFromValue(value, mode, decimals));
  }, [value, mode, decimals, text]);

  function handleChange(raw: string) {
    if (mode === 'integer') {
      const formatted = formatIntegerInputTR(raw);
      setText(formatted);
      const n = parseNumberTR(formatted);
      onChange(isNaN(n) ? null : n);
    } else {
      // decimal: yalnızca rakam, virgül, nokta ve eksi izinli
      const cleaned = raw.replace(/[^0-9,.\-]/g, '');
      setText(cleaned);
      const n = parseNumberTR(cleaned);
      onChange(isNaN(n) ? null : n);
    }
  }

  return (
    <input
      type="text"
      inputMode={mode === 'integer' ? 'numeric' : 'decimal'}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        // Blur sırasında value'dan tekrar formatla — kullanıcının yarım yazımını temizle
        setText(formatFromValue(value, mode, decimals));
      }}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      min={min}
    />
  );
}

function formatFromValue(value: number | null, mode: 'integer' | 'decimal', decimals: number): string {
  if (value == null || !isFinite(value)) return '';
  if (mode === 'integer') return formatIntegerInputTR(String(Math.round(value)));
  return formatNumberTR(value, { decimals });
}
