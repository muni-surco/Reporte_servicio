import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings } from '../types';
import { generateRetenExcel } from '../utils/reportGenerator';
import AutocompleteInput from './AutocompleteInput';

interface RetenReplacement {
  fecha: string;
  turno: string;
  retenUnit: string;
  replacedUnit: string;
  placa: string;
  motivo: string;
  hora: string;
}

interface RetenManagementViewProps {
  settings: AppSettings;
  selectedDate: string;
  mobileData: { id: string, plate: string }[];
}

declare const google: any;

const RetenManagementView: React.FC<RetenManagementViewProps> = ({ settings, selectedDate, mobileData }) => {
  const [replacements, setReplacements] = useState<RetenReplacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({ replacedUnit: false });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; index: number | null }>({
    isOpen: false,
    index: null,
  });

  // Form State
  const [form, setForm] = useState({
    retenUnit: 'AR-1',
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
  };

  const isFormValid = !errors.replacedUnit && !errors.placa;

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
    setTouched({ replacedUnit: true });

    if (!isFormValid) {
      return;
    }

    const newReplacement: RetenReplacement = {
      fecha: selectedDate,
      turno: form.turno,
      retenUnit: form.retenUnit,
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
          setTouched({ replacedUnit: false });
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
      setTouched({ replacedUnit: false });
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
    if (!touched.replacedUnit) setTouched({ replacedUnit: true });
  };

  const handleDelete = (index: number) => {
    setDeleteModal({ isOpen: true, index });
  };

  const confirmDelete = () => {
    if (deleteModal.index === null) return;

    const index = deleteModal.index;
    const replacementToDelete = replacements[index];
    const newReplacements = replacements.filter((_, i) => i !== index);
    setReplacements(newReplacements);

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run.deleteRetenData(replacementToDelete);
    }

    setDeleteModal({ isOpen: false, index: null });
  };

  return (
    <div className="mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-surco-navy p-4 text-white flex items-center justify-between">
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

        <form onSubmit={handleAdd} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-start bg-slate-50/50">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Turno</label>
            <select
              value={form.turno}
              onChange={e => setForm({ ...form, turno: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all cursor-pointer"
            >
              {shifts.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Unidad Retén</label>
            <select
              value={form.retenUnit}
              onChange={e => setForm({ ...form, retenUnit: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all cursor-pointer"
            >
              {retenUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">U. Reemplazada</label>
            <div className="relative">
              <AutocompleteInput
                value={form.replacedUnit}
                onChange={handleReplacedUnitChange}
                onBlur={() => setTouched({ replacedUnit: true })}
                placeholder="Ej: M-15..."
                suggestions={mobileIds}
                error={touched.replacedUnit && !!errors.replacedUnit}
                className="!h-[42px] !rounded-xl !px-4 !py-2.5 !text-sm !bg-white !border-slate-200"
              />
              {touched.replacedUnit && errors.replacedUnit && (
                <p className="text-[10px] text-red-500 font-medium mt-1 ml-1">{errors.replacedUnit}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Placa</label>
            <div className="relative">
              <input
                type="text"
                value={form.placa}
                placeholder=""
                readOnly
                className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all uppercase cursor-not-allowed ${
                  form.replacedUnit && !form.placa
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              />
              {form.replacedUnit && !form.placa && (
                <p className="text-[10px] text-red-500 font-medium mt-1 ml-1">Unidad no válida</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Motivo</label>
            <input
              type="text"
              value={form.motivo}
              placeholder="Opcional..."
              onChange={e => setForm({ ...form, motivo: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-surco-blue/20 focus:border-surco-blue outline-none transition-all"
            />
          </div>

          <div className="flex gap-2 h-[42px] mt-6 md:mt-0 self-start md:self-auto">
            <button
              type="submit"
              disabled={saving || !isFormValid}
              className={`flex-1 font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                isFormValid 
                  ? 'bg-secondary hover:bg-secondary-dark text-white shadow-secondary/20' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-xl">add_circle</span>
              )}
              REGISTRAR
            </button>
            <button
              type="button"
              onClick={() => generateRetenExcel(replacements, selectedDate, settings.turno)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 h-full"
              title="Generar Reporte Excel"
            >
              <span className="material-symbols-outlined text-xl">description</span>
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
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unidad Retén</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">U. Reemplazada</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Placa</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Motivo</th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-3 border-surco-blue/30 border-t-surco-blue rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm font-medium">Buscando registros...</p>
                    </div>
                  </td>
                </tr>
              ) : replacements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
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
                    <td className="px-4 py-4 font-semibold text-surco-blue">{r.retenUnit}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-sm">arrow_forward</span>
                        <span className="font-semibold text-slate-700">{r.replacedUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-500">{r.placa}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {r.motivo || '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar registro"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, index: null })}
          ></div>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
            <div className="bg-red-50 p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-red-600 text-4xl">delete_forever</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">¿Eliminar registro?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Esta acción eliminará el registro de la unidad retén de forma permanente en el sistema.
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, index: null })}
                className="flex-1 px-4 py-3 rounded-2xl font-semibold text-slate-600 hover:bg-slate-200 transition-all text-sm"
              >
                CANCELAR
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 rounded-2xl font-semibold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all text-sm"
              >
                SÍ, ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetenManagementView;
