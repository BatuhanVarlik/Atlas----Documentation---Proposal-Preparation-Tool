'use client';

import { useState } from 'react';
import { useModuleBuilder } from '@/store/moduleBuilderStore';
import { formatIntegerInputTR, parseNumberTR, formatNumberTR } from '@/lib/utils';

interface FillingLine {
  id: string;
  name: string;
  capacity: number;
  valveType: string;
  valveControlUnit: string;
  calculatedDiameter: number | null;
  connectedTankCount: number;
}

interface Props {
  moduleId: string;
  line: FillingLine;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

export default function FillingLineForm({ moduleId, line, onSaved, onDeleted, onClose }: Props) {
  const [name, setName] = useState(line.name);
  const [capacity, setCapacity] = useState(formatIntegerInputTR(String(line.capacity)));
  const [connectedTankCount, setConnectedTankCount] = useState(String(line.connectedTankCount ?? 1));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const updateLine = useModuleBuilder((s) => s.updateFillingLine);
  const liveCalc = useModuleBuilder((s) => s.liveCalc);

  const cap = parseNumberTR(capacity);
  const isValid = name.trim() && !isNaN(cap) && cap > 0;

  function handleCapacityChange(v: string) {
    const formatted = formatIntegerInputTR(v);
    setCapacity(formatted);
    const n = parseNumberTR(formatted);
    if (!isNaN(n) && n > 0) {
      updateLine(line.id, { capacity: n });
    }
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/modules/${moduleId}/valve-cluster/filling-lines/${line.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), capacity: cap, connectedTankCount: parseInt(connectedTankCount, 10) || 0 }),
        }
      );
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hata'); return; }
      updateLine(line.id, { name: name.trim(), capacity: cap });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Bu dolum hattını silmek istiyor musunuz?')) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/modules/${moduleId}/valve-cluster/filling-lines/${line.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Silinemedi'); return; }
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  const fillingLines = useModuleBuilder((s) => s.fillingLines);
  const lineIdx = fillingLines.findIndex((l) => l.id === line.id);
  const liveDiam = liveCalc && lineIdx >= 0
    ? liveCalc.fillingDiameters[lineIdx]?.diameterMm
    : null;

  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hat Detayları</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Hat Adı *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="örn: Raw Milk Reception 1"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h) *</label>
          <input
            type="text"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => handleCapacityChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="örn: 30.000"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hatta Bağlı Tank Sayısı</label>
          <input
            type="number"
            value={connectedTankCount}
            onChange={(e) => setConnectedTankCount(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
          />
          <p className="text-[10px] text-slate-400 mt-0.5">Bu hattaki vana sayısı</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hesaplanan Çap</label>
          <div className="px-2.5 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono">
            {liveDiam ? `${formatNumberTR(liveDiam, { decimals: 1 })} mm` : '—'}
          </div>
        </div>
      </div>

      {liveCalc && (
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 font-mono">
          Seçilen Boru: <strong>{liveCalc.selectedDN.dn}</strong> (iç: {liveCalc.selectedDN.inner} mm) ·
          Drain: {liveCalc.drainValveSize} · CIP: {liveCalc.cipReturnSize} · Leakage: {liveCalc.leakageChamberMm} mm (sabit)
        </div>
      )}

      <div className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
        <p className="font-medium text-slate-600 mb-0.5">Bu dolum hattına sabit eklenen vana grubu (3 adet):</p>
        <p>• Drain Vanası — <strong>SW41</strong></p>
        <p>• Leakage Vanası — <strong>ESV</strong></p>
        <p>• CIP Dönüş Vanası — modül başlığındaki <strong>CIP Giriş/Dönüş</strong> seçimi</p>
        <p className="mt-1 text-slate-400">Vana tipi ve kontrol ünitesi modül başlığından tüm hatlara birlikte ayarlanır.</p>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-between pt-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Siliniyor...' : 'Sil'}
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
