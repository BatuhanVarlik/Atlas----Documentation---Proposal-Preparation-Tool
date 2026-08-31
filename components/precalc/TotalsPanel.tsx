'use client';

import { useMemo } from 'react';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue } from '@/lib/precalc/types';
import { cn, formatNumberTR } from '@/lib/utils';
import { EditableCell } from './EditableCell';

interface Props {
  engine: PrecalcEngine;
  /** Gecikmeli sürüm — ağır toplamlar yalnızca kullanıcı durunca yenilenir. */
  settledVersion: number;
  calculating: boolean;
  currency: string;
  /**
   * Verilirse genel gider satırlarının girdi hücreleri (oran / adet) ve
   * hesabı yöneten parametreler düzenlenebilir olur.
   */
  onSetCell?: (addr: string, value: RawValue) => void;
}

/**
 * Ara toplam ve genel gider bloğundaki kalemler. Satır numaraları sürümden
 * sürüme kaydığı için (36.01 -> 36.07 arasında +6) mutlak değil, ara toplam
 * satırına göre uzaklık olarak tutulur.
 * `input`, o satırın F hücresinin ne anlama geldiğini anlatır — Excel'de
 * kimi satırda oran (0,05), kimi satırda yüzde (40) ya da aç/kapa (0/1).
 */
const OVERHEAD_ROWS: { offset: number; label: string; input: string }[] = [
  { offset: 1, label: 'Acente Komisyonu', input: 'oran (maks. 0,05)' },
  { offset: 3, label: 'Beklenmeyen Giderler', input: '0 / 1 (öneri %3)' },
  { offset: 5, label: 'Garanti', input: '0 / 1 (öneri %2)' },
  { offset: 6, label: 'Garanti Uzatma', input: 'hafta' },
  { offset: 8, label: 'Risk', input: '0 / 1 (öneri %3)' },
  { offset: 10, label: 'Banka Teminat Mektubu', input: 'ön ödeme %' },
  { offset: 12, label: 'Garanti Teminat Mektubu', input: 'oran %' },
  { offset: 14, label: 'Damga Vergisi', input: '0 / 1' },
];

/** Hesabı yöneten parametre hücreleri — adresleri kitabın params listesinden. */
const PARAM_CELLS: { key: string; label: string; hint: string }[] = [
  { key: 'salesPrice', label: 'Satış Fiyatı (SALES PRICE)', hint: 'teklif edilen satış bedeli' },
  { key: 'profitMultiplier', label: 'Kâr Çarpanı (PROFIT MULTIPLIER)', hint: 'Satış = Maliyet ÷ çarpan' },
  { key: 'transportMultiplier', label: 'Nakliye Çarpanı (TRANSPORT)', hint: 'Nakliye = Net × çarpan × adet' },
];

export default function TotalsPanel({ engine, settledVersion, calculating, currency, onSetCell }: Props) {
  const totals = useMemo(() => {
    const { subtotalRow, grandTotalRow } = engine.anchors;
    const subCost = engine.num('M' + subtotalRow);
    const subSales = engine.num('N' + subtotalRow);
    const grandCost = engine.num('M' + grandTotalRow);
    const grandSales = engine.num('N' + grandTotalRow);
    const profitRate = engine.num('M' + (subtotalRow + 19));

    return {
      subCost,
      subSales,
      grandCost,
      grandSales,
      profitRate,
      margin: grandSales > 0 ? (grandSales - grandCost) / grandSales : 0,
      overheads: OVERHEAD_ROWS.map((o) => {
        const row = subtotalRow + o.offset;
        return {
          ...o,
          row,
          driver: engine.value('F' + row),
          base: engine.num('I' + row),
          cost: engine.num('M' + row),
          sales: engine.num('N' + row),
          edited: engine.isUserEntry('F' + row),
        };
      }),
      params: PARAM_CELLS.map((p) => {
        const addr = engine.paramAddr(p.key) ?? '';
        return { ...p, addr, value: engine.value(addr), edited: engine.isUserEntry(addr) };
      }),
      // Teslim süresi: ödeme planı bloğundaki en uzun tedarik haftası.
      leadWeeks: engine.num('C' + (subtotalRow + 24)),
    };
    // settledVersion kasıtlı bağımlılıktır: motor sonuçları mutasyonla değişir,
    // bu sayaç artınca toplamların yeniden okunmasını sağlar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, settledVersion]);

  const money = (n: number) => (n === 0 ? '—' : formatNumberTR(n, { decimals: 2 }));

  return (
    <div className={cn('space-y-3 transition-opacity', calculating && 'opacity-60')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Ara Toplam — Maliyet (${currency})`} value={money(totals.subCost)} />
        <Stat label={`Ara Toplam — Satış (${currency})`} value={money(totals.subSales)} />
        <Stat label={`Genel Toplam — Maliyet (${currency})`} value={money(totals.grandCost)} tone="slate" />
        <Stat label={`Genel Toplam — Satış (${currency})`} value={money(totals.grandSales)} tone="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700">Genel Giderler ve Toplamlar</h3>
          {calculating && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              hesaplanıyor…
            </span>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-500 border-b border-slate-100">
              <th className="text-left font-medium px-4 py-1.5">Kalem</th>
              {onSetCell && <th className="text-right font-medium px-4 py-1.5 w-40">Girdi (F)</th>}
              {onSetCell && <th className="text-right font-medium px-4 py-1.5">Matrah (I)</th>}
              <th className="text-right font-medium px-4 py-1.5">Maliyet</th>
              <th className="text-right font-medium px-4 py-1.5">Satış</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td className="px-4 py-1.5 font-semibold text-slate-700">ARA TOPLAM</td>
              {onSetCell && <td colSpan={2} className="px-4 py-1.5 text-right text-[11px] text-slate-400">satır {engine.anchors.subtotalRow}</td>}
              <td className="px-4 py-1.5 text-right font-mono font-semibold">{money(totals.subCost)}</td>
              <td className="px-4 py-1.5 text-right font-mono font-semibold">{money(totals.subSales)}</td>
            </tr>
            {totals.overheads.map((o) => (
              <tr key={o.row} className="border-b border-slate-50">
                <td className="px-4 py-1.5 text-slate-600">
                  {o.label}
                  {onSetCell && <span className="ml-2 text-[10px] text-slate-400">{o.input}</span>}
                </td>
                {onSetCell && (
                  <td className="px-2 py-1">
                    <EditableCell
                      value={o.driver}
                      format="number"
                      align="right"
                      edited={o.edited}
                      onCommit={(v) => onSetCell('F' + o.row, v)}
                    />
                  </td>
                )}
                {onSetCell && (
                  <td className="px-4 py-1.5 text-right font-mono text-slate-400">{money(o.base)}</td>
                )}
                <td className="px-4 py-1.5 text-right font-mono text-slate-600">{money(o.cost)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-600">{money(o.sales)}</td>
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td className="px-4 py-2 font-bold text-slate-800">GENEL TOPLAM</td>
              {onSetCell && <td colSpan={2} className="px-4 py-2 text-right text-[11px] text-slate-400">satır {engine.anchors.grandTotalRow}</td>}
              <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">{money(totals.grandCost)}</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">{money(totals.grandSales)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {onSetCell && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-700">Hesap Parametreleri</h3>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {totals.params.map((p) => (
                <tr key={p.addr} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-1.5 text-slate-600">
                    {p.label}
                    <span className="ml-2 text-[10px] text-slate-400">{p.hint}</span>
                  </td>
                  <td className="px-4 py-1.5 text-right text-[10px] font-mono text-slate-300 w-20">{p.addr}</td>
                  <td className="px-2 py-1 w-40">
                    <EditableCell
                      value={p.value}
                      format="number"
                      align="right"
                      edited={p.edited}
                      onCommit={(v) => onSetCell(p.addr, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'slate' | 'emerald' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={cn(
        'text-lg font-semibold font-mono',
        tone === 'emerald' ? 'text-emerald-700' : tone === 'slate' ? 'text-slate-900' : 'text-slate-700',
      )}>
        {value}
      </p>
    </div>
  );
}
