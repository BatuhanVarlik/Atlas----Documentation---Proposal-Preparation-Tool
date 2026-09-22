import * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { profitRate } from '../profit';
import { S_BLOCK_TITLE, S_HEAD, itemStyle, totalStyle, type NumFmtKey } from '../exportStyle';
import type { PrecalcWorkbook } from '../types';
import { cellFor, styledBlank, type Style } from './cells';

export interface SummaryOptions {
  itemCount: number;
  /** Kaydın revizyon geçmişi, eskiden yeniye. Kayıtla ilişkilendirilmemiş
   * (henüz listeye girmemiş) teklifte boştur. */
  revisions?: { code: string; note: string; author: string; date: string }[];
}

/** Özet sayfası — teklifin tek bakışta rakamları. */
export function buildSummarySheet(
  wb: PrecalcWorkbook,
  engine: PrecalcEngine,
  opts: SummaryOptions,
): XLSX.WorkSheet {
  const AN = engine.anchors;
  const sheet: XLSX.WorkSheet = {};
  let r = 0;

  const put = (c: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (cell) sheet[XLSX.utils.encode_cell({ r, c })] = cell;
  };
  const row = (label: string, value: unknown, fmt?: NumFmtKey, total = false) => {
    put(0, label, total ? totalStyle() : itemStyle({ bold: true }));
    put(1, value, total ? totalStyle({ fmt, grand: true }) : itemStyle({ fmt, align: 'right' }));
    r++;
  };

  [0, 1].forEach((c) => put(c, c === 0 ? 'PRECALCULATION ÖZET' : '', S_BLOCK_TITLE));
  r += 2;
  row('Kaynak dosya', wb.meta.sourceFile);
  row('Oluşturulma', new Date().toLocaleString('tr-TR'));
  row('Para birimi', wb.meta.currency);
  row('Kalem sayısı (miktar girilmiş)', opts.itemCount, 'int');
  r++;
  row('ARA TOPLAM (maliyet)', engine.num('M' + AN.subtotalRow), 'money');
  row('ARA TOPLAM (satış)', engine.num('N' + AN.subtotalRow), 'money');
  row('Kâr oranı', profitRate(engine) ?? '—', 'percent');
  r++;
  row('GENEL TOPLAM (maliyet)', engine.num('M' + AN.grandTotalRow), 'money', true);
  row('GENEL TOPLAM (satış)', engine.num('N' + AN.grandTotalRow), 'money', true);

  /*
   * Revizyon geçmişi. Teklifin hangi sürümünde neyin değiştiği, dosyayı
   * açan kişinin ilk sorduğu şey; ekranda katlanır şeritte duran metnin
   * aynısı buraya da yazılır ki dosya tek başına da anlaşılsın.
   */
  const revisions = opts.revisions ?? [];
  if (revisions.length > 0) {
    r += 2;
    [0, 1].forEach((c) => put(c, c === 0 ? 'REVİZYON GEÇMİŞİ' : '', S_BLOCK_TITLE));
    r++;

    ['Revizyon', 'Açıklama', 'Hazırlayan', 'Tarih'].forEach((h, c) => put(c, h, S_HEAD));
    r++;

    // En yeni üstte: son ne olduğu ilk göze çarpsın.
    [...revisions].reverse().forEach((rev, i) => {
      [rev.code, rev.note, rev.author, rev.date].forEach((v, c) => put(c, v, itemStyle({
        align: 'left',
        striped: i % 2 === 1,
      })));
      r++;
    });
  }

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 3 } });
  sheet['!cols'] = [{ wch: 34 }, { wch: 90 }, { wch: 24 }, { wch: 14 }];
  return sheet;
}
