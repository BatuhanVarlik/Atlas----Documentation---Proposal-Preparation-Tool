/**
 * Tablo hücresindeki giriş kutusundan aynı sütunda bir alt (ya da üst)
 * satırdaki giriş kutusuna geçer — Excel'de Enter'ın yaptığı gibi.
 *
 * Satırlar tabloya göre değil DOM'a göre gezilir: grup başlığı (colSpan'li
 * tek hücre), formül hücresi (giriş kutusu yok) ya da salt okunur satırlar
 * atlanır, ilk yazılabilir kutuda durulur. Sanallaştırılmış tablolarda
 * bir sonraki satır OVERSCAN payı sayesinde zaten DOM'dadır; odaklanan kutu
 * tarayıcı tarafından görünür alana kaydırılır.
 *
 * Geçecek kutu bulunursa true döner.
 */
export function focusVerticalNeighbor(from: HTMLElement, direction: 1 | -1): boolean {
  const td = from.closest('td');
  const tr = td?.parentElement as HTMLTableRowElement | null;
  if (!td || !tr) return false;
  const index = (td as HTMLTableCellElement).cellIndex;

  let row = (direction === 1 ? tr.nextElementSibling : tr.previousElementSibling) as HTMLTableRowElement | null;
  // Sonsuz döngüye karşı üst sınır: sanal pencerenin dışı zaten DOM'da değildir.
  for (let guard = 0; row && guard < 500; guard++) {
    // Grup başlıkları tek (colSpan'li) hücredir; sütun indeksi tutmaz.
    if (row.cells.length > index) {
      const input = row.cells[index].querySelector<HTMLInputElement>(
        'input:not([disabled]):not([readonly]):not([type="hidden"]):not([type="checkbox"])',
      );
      if (input) {
        input.focus();
        // Odakla birlikte React kutunun metnini (biçimli → ham) değiştirir;
        // seçim o yeniden çizimden sonra yapılmazsa kaybolur.
        requestAnimationFrame(() => input.select());
        return true;
      }
    }
    row = (direction === 1 ? row.nextElementSibling : row.previousElementSibling) as HTMLTableRowElement | null;
  }
  return false;
}
