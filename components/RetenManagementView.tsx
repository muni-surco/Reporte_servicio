import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings } from '../types';
import { generateRetenExcel } from '../utils/reportGenerator';
import AutocompleteInput from './AutocompleteInput';

interface RetenReplacement {
  fecha: string;
  turno: string;
  retenUnit: string;
  placaReten: string;
  replacedUnit: string;
  placa: string;
  motivo: string;
  hora: string;
}

interface RetenManagementViewProps {
  settings: AppSettings;
  selectedDate: string;
  mobileData: { id: string, plate: string, sector?: string }[];
}

declare const google: any;

const RetenManagementView: React.FC<RetenManagementViewProps> = ({ settings, selectedDate, mobileData }) => {
  const [replacements, setReplacements] = useState<RetenReplacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({ replacedUnit: false, motivo: false });

  // Form State
  const [form, setForm] = useState({
    retenUnit: 'AR-1',
    placaReten: '',
    replacedUnit: '',
    placa: '',
    motivo: '',
    turno: settings.turno,
  });

  const shifts = ['MAÑANA', 'TARDE', 'NOCHE'];
  const retenUnits = Array.from({ length: 12 }, (_, i) => `AR-${i + 1}`);

  const mobileIds = useMemo(() => mobileData.map(m => m.id), [mobileData]);

  const errors = {
    replacedUnit: !form.replacedUnit.trim() ? 'Campo requerido' : '',
    placa: !form.placa ? 'Unidad no encontrada' : '',
    motivo: !form.motivo.trim() ? 'El motivo es obligatorio' : '',
  };

  const isFormValid = !errors.replacedUnit && !errors.placa && !errors.motivo;

  useEffect(() => {
    setForm(prev => ({ ...prev, turno: settings.turno }));
    loadRetenData();
  }, [selectedDate, settings.turno]);

  const loadRetenData = () => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: RetenReplacement[]) => {
          setReplacements(data || []);
          setLoading(false);
        })
        .withFailureHandler((err: any) => {
          console.error('Error loading reten data:', err);
          setLoading(false);
        })
        .getRetenData(selectedDate, settings.turno);
    } else {
      // Mock data for development
      setTimeout(() => {
        setReplacements([]);
        setLoading(false);
      }, 500);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ replacedUnit: true, motivo: true });

    if (!isFormValid) {
      return;
    }

    const newReplacement: RetenReplacement = {
      fecha: selectedDate,
      turno: form.turno,
      retenUnit: form.retenUnit,
      placaReten: form.placaReten.toUpperCase(),
      replacedUnit: form.replacedUnit.toUpperCase(),
      placa: form.placa.toUpperCase(),
      motivo: form.motivo,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(() => {
          setReplacements(prev => [newReplacement, ...prev]);
          setForm({ ...form, replacedUnit: '', placa: '', motivo: '' });
          setTouched({ replacedUnit: false, motivo: false });
          setSaving(false);
        })
        .withFailureHandler((err: any) => {
          alert('Error al guardar: ' + err);
          setSaving(false);
        })
        .saveRetenData(newReplacement);
    } else {
      setReplacements(prev => [newReplacement, ...prev]);
      setForm({ ...form, replacedUnit: '', placa: '', motivo: '' });
      setTouched({ replacedUnit: false, motivo: false });
      setSaving(false);
    }
  };

  const handleReplacedUnitChange = (value: string) => {
    const normalized = value.toUpperCase();
    const found = mobileData.find(m => m.id.toUpperCase() === normalized);
    setForm(prev => ({
      ...prev,
      replacedUnit: value,
      placa: found ? found.plate : ''
    }));
    if (!touched.replacedUnit) setTouched(prev => ({ ...prev, replacedUnit: true }));
  };

  const handleRetenUnitChange = (value: string) => {
    const normalized = value.toUpperCase();
    const found = mobileData.find(m => m.id.toUpperCase() === normalized);
    setForm(prev => ({
      ...prev,
      retenUnit: value,
      placaReten: found ? found.plate : ''
    }));
  };

  // Helper to find sector for a given unit ID
  const getUnitSector = (unitId: string) => {
    const found = mobileData.find(m => m.id.toUpperCase() === unitId.toUpperCase());
    return found?.sector || '-';
  };


  return (
    <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 overflow-hidden border border-slate-100 min-h-[600px] flex flex-col">
      <div className="p-8 pb-0">
        <div className="bg-surco-blue rounded-2xl p-6 text-white mb-8 shadow-xl shadow-surco-blue/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">swap_horizontal_circle</span>
              <h2 className="text-lg font-semibold tracking-tight">Registro de Unidades de Reemplazo /  Retén (AR)</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium opacity-80">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                {selectedDate}
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                TURNO {settings.turno}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleAdd} className="p-6 bg-slate-50/50 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 items-end">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Turno</label>
              <select
                value={form.turno}
                onChange={e => setForm({ ...form, turno: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all cursor-pointer h-[42px]"
              >
                {shifts.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">U. Reemplazada</label>
              <div className="relative">
                <AutocompleteInput
                  value={form.replacedUnit}
                  onChange={handleReplacedUnitChange}
                  onBlur={() => setTouched(prev => ({ ...prev, replacedUnit: true }))}
                  placeholder="Ej: M-15..."
                  suggestions={mobileIds}
                  error={touched.replacedUnit && !!errors.replacedUnit}
                  className="!h-[42px] !rounded-xl !px-4 !py-2.5 !text-sm !bg-white !border-slate-200"
                />
                {touched.replacedUnit && errors.replacedUnit && (
                  <p className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.replacedUnit}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Placa Reemp.</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.placa}
                  placeholder="-"
                  readOnly
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all uppercase cursor-not-allowed h-[42px] ${form.replacedUnit && !form.placa
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                />
                {form.replacedUnit && !form.placa && (
                  <p className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">No válida</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Unidad Retén</label>
              <select
                value={form.retenUnit}
                onChange={e => handleRetenUnitChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all cursor-pointer h-[42px]"
              >
                {retenUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Placa Retén</label>
              <input
                type="text"
                value={form.placaReten}
                placeholder="-"
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 outline-none transition-all uppercase cursor-not-allowed h-[42px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Motivo</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.motivo}
                  placeholder="Justificación del relevo..."
                  onBlur={() => setTouched(prev => ({ ...prev, motivo: true }))}
                  onChange={e => {
                    setForm({ ...form, motivo: e.target.value });
                    if (!touched.motivo) setTouched(prev => ({ ...prev, motivo: true }));
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all h-[42px] ${touched.motivo && errors.motivo
                    ? 'border-red-300 bg-red-50/30'
                    : 'bg-white border-slate-200'
                    }`}
                />
                {touched.motivo && errors.motivo && (
                  <p className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.motivo}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 h-[42px] justify-end">
            <button
              type="submit"
              disabled={saving || !isFormValid}
              className={`min-w-[200px] font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${isFormValid
                ? 'bg-secondary hover:bg-secondary-dark text-white shadow-secondary/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-xl">add_circle</span>
              )}
              REGISTRAR RELEVO
            </button>
            <button
              type="button"
              onClick={() => generateRetenExcel(replacements, selectedDate, settings.turno)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              title="Generar Reporte Excel"
            >
              <span className="material-symbols-outlined text-xl">description</span>
              DESCARGAR EXCEL
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 border-y border-slate-200">
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hora</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Turno</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unidad Reemplazada</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sector</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Placa Reemplazada</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unidad Retén</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Placa Retén</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-3 border-surco-blue/30 border-t-surco-blue rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm font-medium">Buscando registros...</p>
                    </div>
                  </td>
                </tr>
              ) : replacements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2 opacity-60">
                      <span className="material-symbols-outlined text-4xl text-slate-300">history_toggle_off</span>
                      <p className="text-sm font-medium">No hay relevos registrados para este turno.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                replacements.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4">
                      <span className="text-[11px] font-medium text-slate-500">{r.fecha}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[11px] font-semibold">
                        {r.hora}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[11px] font-semibold text-slate-500">{r.turno}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-slate-700">{r.replacedUnit}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                        {getUnitSector(r.replacedUnit)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-500">{r.placa}</span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-surco-blue">{r.retenUnit}</td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-500">{r.placaReten}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {r.motivo || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RetenManagementView;
