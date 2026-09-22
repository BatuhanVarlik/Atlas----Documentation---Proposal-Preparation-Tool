'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue } from '@/lib/precalc/types';
import { readCashflow } from '@/lib/precalc/cashflow';
import { cn, formatNumberTR } from '@/lib/utils';
import { EditableCell } from './EditableCell';

interface Props {
  engine: PrecalcEngine;
  /** Gecikmeli sürüm — ağır hesap durunca tazelenir. */
  settledVersion: number;
  calculating: boolean;
  currency: string;
  onSetCell: (addr: string, value: RawValue) => void;
}

/** Kaynak Excel'deki grafiğin turuncusu. */
const NET_COLOR = '#ED7D31';
const GELIR_COLOR = '#2E7D32';
const GIDER_COLOR = '#C62828';

/**
 * Projenin haftalık nakit akışı.
 *
 * Değerler kitabın kendi formüllerinden okunur (lib/precalc/cashflow.ts);
 * Excel'e giden CASHFLOW sayfası da aynı fonksiyonu kullanır, bu yüzden
 * ekrandaki çizgi ile dosyadaki çizgi hiçbir zaman ayrışmaz.
 */
export default function CashflowPanel({
  engine, settledVersion, calculating, currency, onSetCell,
}: Props) {
  const [showGelir, setShowGelir] = useState(false);
  const [showGider, setShowGider] = useState(false);

  // settledVersion kasıtlı bağımlılıktır: motor sonuçları mutasyonla değişir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => readCashflow(engine), [engine, settledVersion]);

  const money = (n: number) => (n === 0 ? '—' : formatNumberTR(n, { decimals: 2 }));
  const short = (n: number) => formatNumberTR(Math.round(n), { decimals: 0 });

  return (
    <div className={cn('space-y-3 transition-opacity', calculating && 'opacity-60')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Toplam Gelir (${currency})`} value={money(data.totalGelir)} tone="emerald" />
        <Stat label={`Toplam Gider (${currency})`} value={money(data.totalGider)} tone="rose" />
        <Stat
          label={`En Düşük Net (${currency})`}
          value={`${money(data.lowest.net)} · ${data.lowest.week}. hafta`}
          tone={data.lowest.net < 0 ? 'rose' : 'slate'}
        />
        <Stat label={`Kapanış Net (${currency})`} value={money(data.closingNet)} tone="slate" />
      </div>

      {/* Ödeme planı — oran ve hafta düzenlenebilir, tutar formülden gelir */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700">Ödeme Planı</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-500 border-b border-slate-100">
              <th className="text-left font-medium px-4 py-1.5">Aşama</th>
              <th className="text-right font-medium px-2 py-1.5 w-28">Oran</th>
              <th className="text-right font-medium px-2 py-1.5 w-24">Hafta</th>
              <th className="text-right font-medium px-4 py-1.5 w-36">Tutar</th>
              <th className="text-right font-medium px-4 py-1.5 w-32">Tahsilat Haftası</th>
            </tr>
          </thead>
          <tbody>
            {data.stages.map((s) => (
              <tr key={s.row} className="border-b border-slate-50">
                <td className="px-4 py-1.5 text-slate-600">{s.label}</td>
                <td className="px-2 py-1">
                  <EditableCell
                    value={engine.value('B' + s.row)}
                    format="factor"
                    align="right"
                    edited={engine.isUserEntry('B' + s.row)}
                    onCommit={(v) => onSetCell('B' + s.row, v)}
                  />
                </td>
                <td className="px-2 py-1">
                  {engine.hasFormula('C' + s.row) ? (
                    <div className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 font-mono text-[11px] text-right text-violet-700">
                      {s.week || '–'}
                    </div>
                  ) : (
                    <EditableCell
                      value={engine.value('C' + s.row)}
                      format="int"
                      align="right"
                      edited={engine.isUserEntry('C' + s.row)}
                      onCommit={(v) => onSetCell('C' + s.row, v)}
                    />
                  )}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-600">{money(s.amount)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-400">{s.collectWeek || '–'}</td>
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td className="px-4 py-2 font-bold text-slate-800" colSpan={3}>TOPLAM</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">
                {money(data.stageTotal)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Grafik */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-700">Haftalık Nakit Akışı</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <Toggle on={showGelir} onClick={() => setShowGelir((v) => !v)} color={GELIR_COLOR}>Gelir</Toggle>
            <Toggle on={showGider} onClick={() => setShowGider((v) => !v)} color={GIDER_COLOR}>Gider</Toggle>
          </div>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeks} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={short} width={70} />
              <Tooltip
                formatter={(v: number) => `${money(v)} ${currency}`}
                labelFormatter={(w) => `${w}. hafta`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="linear" dataKey="net" name="NET" stroke={NET_COLOR} strokeWidth={2} dot={false} />
              {showGelir && (
                <Line type="linear" dataKey="gelir" name="GELİR" stroke={GELIR_COLOR} strokeWidth={1.5} dot={false} />
              )}
              {showGider && (
                <Line type="linear" dataKey="gider" name="GİDER" stroke={GIDER_COLOR} strokeWidth={1.5} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 52 haftalık tablo */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700">Hafta Hafta</h3>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 360 }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-slate-100 bg-white sticky top-0">
                <th className="text-right font-medium px-4 py-1.5 w-20">Hafta</th>
                <th className="text-right font-medium px-4 py-1.5">Gelir</th>
                <th className="text-right font-medium px-4 py-1.5">Gider</th>
                <th className="text-right font-medium px-4 py-1.5">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w) => (
                <tr key={w.week} className="border-b border-slate-50">
                  <td className="px-4 py-1 text-right font-mono text-slate-400">{w.week}</td>
                  <td className="px-4 py-1 text-right font-mono text-emerald-700">{money(w.gelir)}</td>
                  <td className="px-4 py-1 text-right font-mono text-rose-700">{money(w.gider)}</td>
                  <td className={cn(
                    'px-4 py-1 text-right font-mono font-semibold',
                    w.net < 0 ? 'text-rose-700' : 'text-slate-800',
                  )}>
                    {money(w.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, color, children }: {
  on: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors',
        on ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-400',
      )}
    >
      <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: on ? color : '#CBD5E1' }} />
      {children}
    </button>
  );
}

function Stat({ label, value, tone = 'slate' }: {
  label: string; value: string; tone?: 'slate' | 'emerald' | 'rose';
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={cn(
        'text-lg font-semibold font-mono',
        tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-700' : 'text-slate-900',
      )}>
        {value}
      </p>
    </div>
  );
}
