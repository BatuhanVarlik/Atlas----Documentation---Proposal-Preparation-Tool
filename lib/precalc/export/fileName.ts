/** Dosya adı: "PRECALCULATION 2026-08-19 14-30.xlsx" */
export function precalcFileName(prefix = 'PRECALCULATION'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}
