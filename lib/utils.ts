import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "30000" -> "30.000" (TR yerel ayar — binlik ayırıcı nokta)
export function formatNumberTR(value: number, opts: { decimals?: number } = {}): string {
  const { decimals = 0 } = opts;
  if (!isFinite(value)) return '';
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// "30.000" / "30000" / "30.000,5" -> 30000 ya da 30000.5
export function parseNumberTR(formatted: string): number {
  if (!formatted) return NaN;
  const cleaned = formatted.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned);
}

// Yazım sırasında binlik nokta uygulayan kapasite/hacim input'ları için.
// Sadece tam sayı kabul eder, ondalık kullanmaz.
export function formatIntegerInputTR(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (isNaN(n)) return '';
  return n.toLocaleString('tr-TR');
}
