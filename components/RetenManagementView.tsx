import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  fechaIngresoTaller?: string;
  horaIngresoTaller?: string;
  fechaSalidaTaller?: string;
  horaSalidaTaller?: string;
}

interface RetenManagementViewProps {
  settings: AppSettings;
  selectedDate: string;
  mobileData: { id: string, plate: string, sector?: string }[];
  motivoTallerOptions: string[];
}

declare const google: any;

const RetenManagementView: React.FC<RetenManagementViewProps> = ({ settings, selectedDate, mobileData, motivoTallerOptions }) => {
  const [replacements, setReplacements] = useState<RetenReplacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({ replacedUnit: false, motivo: false, fechaIngresoTaller: false, horaIngresoTaller: false, retenUnit: false });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fechaSalidaTaller: '', horaSalidaTaller: '' });
  const lastQueriedUnitRef = useRef<string>('');

  // Form State
  const [form, setForm] = useState({
    retenUnit: '',
    placaReten: '',
    replacedUnit: '',
    placa: '',
    motivo: '',
    turno: settings.turno,
    fechaIngresoTaller: '',
    horaIngresoTaller: '',
    fechaSalidaTaller: '',
    horaSalidaTaller: '',
  });

  const shifts = ['MAÑANA', 'TARDE', 'NOCHE'];
  const retenUnits = Array.from({ length: 12 }, (_, i) => `AR-${i + 1}`);

  const mobileIds = useMemo(() => mobileData.map(m => m.id), [mobileData]);

  const errors = {
    replacedUnit: !form.replacedUnit.trim() ? 'Campo requerido' : '',
    placa: !form.placa ? 'Unidad no encontrada' : '',
    motivo: !form.motivo.trim() ? 'El motivo es obligatorio' : '',
    fechaIngresoTaller: !form.fechaIngresoTaller ? 'Fecha requerida' : '',
    horaIngresoTaller: !form.horaIngresoTaller ? 'Hora requerida' : '',
    retenUnit: (form.replacedUnit.trim().toUpperCase().startsWith('M') && !form.retenUnit.trim()) ? 'Unidad Retén es obligatoria para unidades tipo M' : '',
  };

  const isFormValid = !errors.replacedUnit && !errors.placa && !errors.motivo && !errors.fechaIngresoTaller && !errors.horaIngresoTaller && !errors.retenUnit;

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
    setTouched({ replacedUnit: true, motivo: true, fechaIngresoTaller: true, horaIngresoTaller: true });

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
      fechaIngresoTaller: form.fechaIngresoTaller,
      horaIngresoTaller: form.horaIngresoTaller,
      fechaSalidaTaller: form.fechaSalidaTaller,
      horaSalidaTaller: form.horaSalidaTaller,
    };

    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(() => {
          setReplacements(prev => [newReplacement, ...prev]);
          setForm({ ...form, replacedUnit: '', placa: '', motivo: '', fechaIngresoTaller: '', horaIngresoTaller: '', fechaSalidaTaller: '', horaSalidaTaller: '' });
          setTouched({ replacedUnit: false, motivo: false, fechaIngresoTaller: false, horaIngresoTaller: false });
          setSaving(false);
        })
        .withFailureHandler((err: any) => {
          alert('Error al guardar: ' + err);
          setSaving(false);
        })
        .saveRetenData(newReplacement);
    } else {
      setReplacements(prev => [newReplacement, ...prev]);
      setForm({ ...form, replacedUnit: '', placa: '', motivo: '', fechaIngresoTaller: '', horaIngresoTaller: '', fechaSalidaTaller: '', horaSalidaTaller: '' });
      setTouched({ replacedUnit: false, motivo: false, fechaIngresoTaller: false, horaIngresoTaller: false });
      setSaving(false);
    }
  };

  const handleUpdateSalida = (replacement: RetenReplacement) => {
    const key = replacement.fecha + replacement.hora + replacement.retenUnit + replacement.replacedUnit;
    setUpdatingId(key);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, error?: string }) => {
          if (res.success) {
            setReplacements(prev => prev.map(r => {
              if (r.fecha === replacement.fecha && r.hora === replacement.hora && r.retenUnit === replacement.retenUnit && r.replacedUnit === replacement.replacedUnit) {
                return { ...r, fechaSalidaTaller: editForm.fechaSalidaTaller, horaSalidaTaller: editForm.horaSalidaTaller };
              }
              return r;
            }));
            setEditingKey(null);
          } else {
            alert('Error al actualizar: ' + res.error);
          }
          setUpdatingId(null);
        })
        .withFailureHandler((err: any) => {
          alert('Error de red: ' + err);
          setUpdatingId(null);
        })
        .updateRetenSalida({
          ...replacement,
          fechaSalidaTaller: editForm.fechaSalidaTaller,
          horaSalidaTaller: editForm.horaSalidaTaller
        });
    } else {
      // Mock update
      setReplacements(prev => prev.map(r => {
        if (r.fecha === replacement.fecha && r.hora === replacement.hora && r.retenUnit === replacement.retenUnit && r.replacedUnit === replacement.replacedUnit) {
          return { ...r, fechaSalidaTaller: editForm.fechaSalidaTaller, horaSalidaTaller: editForm.horaSalidaTaller };
        }
        return r;
      }));
      setEditingKey(null);
      setUpdatingId(null);
    }
  };

  const startEditing = (r: RetenReplacement) => {
    setEditingKey(r.fecha + r.hora + r.retenUnit + r.replacedUnit);
    setEditForm({
      fechaSalidaTaller: r.fechaSalidaTaller || '',
      horaSalidaTaller: r.horaSalidaTaller || ''
    });
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

    lastQueriedUnitRef.current = normalized;

    // Auto-fill taller entry from last record without exit
    if (typeof google !== 'undefined' && google.script && google.script.run && normalized) {
      google.script.run
        .withSuccessHandler((data: { fechaIngresoTaller: string, horaIngresoTaller: string } | null) => {
          if (lastQueriedUnitRef.current !== normalized) return; // Stale response
          setForm(prev => ({
            ...prev,
            fechaIngresoTaller: data?.fechaIngresoTaller || '',
            horaIngresoTaller: data?.horaIngresoTaller || ''
          }));
        })
        .withFailureHandler(() => { })
        .getLastUnitTallerEntry(normalized);
    } else if (normalized) {
      // Mock: search current replacements for last record without exit
      const found = replacements.filter(
        r => r.replacedUnit.toUpperCase() === normalized && r.fechaIngresoTaller
      );
      const last = found[found.length - 1];
      setForm(prev => ({
        ...prev,
        fechaIngresoTaller: (last && !last.fechaSalidaTaller) ? last.fechaIngresoTaller : '',
        horaIngresoTaller: (last && !last.fechaSalidaTaller) ? last.horaIngresoTaller : ''
      }));
    }
  };

  const handleRetenUnitChange = (value: string) => {
    const normalized = value.toUpperCase();
    const found = mobileData.find(m => m.id.toUpperCase() === normalized);
    setForm(prev => ({
      ...prev,
      retenUnit: value,
      placaReten: found ? found.plate : ''
    }));
    if (!touched.retenUnit) setTouched(prev => ({ ...prev, retenUnit: true }));
  };

  // Helper to find sector for a given unit ID
  const getUnitSector = (unitId: string) => {
    const found = mobileData.find(m => m.id.toUpperCase() === unitId.toUpperCase());
    return found?.sector || '-';
  };


  const columnHeaderStyle = "px-4 py-3 text-left text-[13px] font-semibold text-white uppercase tracking-widest border-b border-blue-800 bg-[#005ea5] sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]";
  const cellStyle = "px-4 py-3 text-[13px] text-slate-700 border-b border-slate-50 bg-white";
  const labelStyle = "text-[11px] font-medium text-[#004b93] uppercase tracking-wider mb-1 px-1 block";
  const inputBaseStyle = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all uppercase placeholder:text-slate-300 h-[38px]";

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toolbar / Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
        <form onSubmit={handleAdd} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-4">
            {/* Row 1 */}
            <div className="flex flex-col">
              <label className={labelStyle}>Turno</label>
              <div className="relative">
                <select
                  value={form.turno}
                  onChange={e => setForm({ ...form, turno: e.target.value })}
                  className={`${inputBaseStyle} appearance-none cursor-pointer pr-8`}
                >
                  {shifts.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Unidad Reemplazada</label>
              <AutocompleteInput
                value={form.replacedUnit}
                onChange={handleReplacedUnitChange}
                onBlur={() => setTouched(prev => ({ ...prev, replacedUnit: true }))}
                placeholder="M-15..."
                suggestions={mobileIds}
                error={touched.replacedUnit && !!errors.replacedUnit}
                className="!h-[38px] !rounded-lg !text-[13px] !bg-slate-50 !border-slate-200"
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Placa Reemplazada</label>
              <input
                type="text"
                value={form.placa}
                placeholder="-"
                readOnly
                className={`${inputBaseStyle} ${form.replacedUnit && !form.placa ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-100/50 text-slate-400 cursor-not-allowed'}`}
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Unidad Retén</label>
              <div className="relative">
                <select
                  value={form.retenUnit}
                  onChange={e => handleRetenUnitChange(e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, retenUnit: true }))}
                  className={`${inputBaseStyle} appearance-none cursor-pointer pr-8 ${touched.retenUnit && errors.retenUnit ? 'border-red-300 bg-red-50/30' : ''}`}
                >
                  <option value="">--</option>
                  {retenUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Placa Retén</label>
              <input
                type="text"
                value={form.placaReten}
                placeholder="-"
                readOnly
                className={`${inputBaseStyle} bg-slate-100/50 text-slate-400 cursor-not-allowed`}
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Motivo</label>
              <AutocompleteInput
                value={form.motivo}
                onChange={(val) => {
                  setForm({ ...form, motivo: val });
                  if (!touched.motivo) setTouched(prev => ({ ...prev, motivo: true }));
                }}
                onBlur={() => setTouched(prev => ({ ...prev, motivo: true }))}
                placeholder="Motivo..."
                suggestions={motivoTallerOptions}
                error={touched.motivo && !!errors.motivo}
                className="!h-[38px] !rounded-lg !text-[13px] !bg-slate-50 !border-slate-200"
              />
            </div>

            {/* Row 2 */}
            <div className="flex flex-col">
              <label className={labelStyle}>Fecha Ingreso Taller</label>
              <input
                type="date"
                value={form.fechaIngresoTaller}
                onChange={e => setForm({ ...form, fechaIngresoTaller: e.target.value })}
                className={`${inputBaseStyle} ${touched.fechaIngresoTaller && errors.fechaIngresoTaller ? 'border-red-300 bg-red-50/30' : ''}`}
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Hora Ingreso Taller</label>
              <input
                type="time"
                value={form.horaIngresoTaller}
                onChange={e => setForm({ ...form, horaIngresoTaller: e.target.value })}
                className={`${inputBaseStyle} ${touched.horaIngresoTaller && errors.horaIngresoTaller ? 'border-red-300 bg-red-50/30' : ''}`}
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Fecha Salida Taller</label>
              <input
                type="date"
                value={form.fechaSalidaTaller}
                onChange={e => setForm({ ...form, fechaSalidaTaller: e.target.value })}
                className={inputBaseStyle}
              />
            </div>

            <div className="flex flex-col">
              <label className={labelStyle}>Hora Salida Taller</label>
              <input
                type="time"
                value={form.horaSalidaTaller}
                onChange={e => setForm({ ...form, horaSalidaTaller: e.target.value })}
                className={inputBaseStyle}
              />
            </div>

            <div className="flex flex-col lg:col-span-2 justify-end">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !isFormValid}
                  className={`flex-1 flex items-center justify-center gap-2 h-[38px] rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm ${isFormValid
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  )}
                  REGISTRAR RELEVO
                </button>
                <button
                  type="button"
                  onClick={() => generateRetenExcel(replacements, selectedDate, settings.turno)}
                  className="flex items-center justify-center gap-2 h-[38px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm shadow-emerald-100"
                  title="Descargar Excel"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-widest">Cargando Relevos...</p>
              </div>
            </div>
          )}

          <table className="w-full border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={columnHeaderStyle}>Fecha/Hora</th>
                <th className={columnHeaderStyle}>Turno</th>
                <th className={columnHeaderStyle}>Unidad Reemplazada</th>
                <th className={columnHeaderStyle}>Sector</th>
                <th className={columnHeaderStyle}>Placa</th>
                <th className={columnHeaderStyle}>Unidad Retén</th>
                <th className={columnHeaderStyle}>Placa Retén</th>
                <th className={columnHeaderStyle}>Motivo</th>
                <th className={columnHeaderStyle}>Ingreso Taller</th>
                <th className={columnHeaderStyle}>Salida Taller</th>
                <th className={`${columnHeaderStyle} text-center`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {replacements.length === 0 && !loading ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">history_toggle_off</span>
                    <p className="text-[13px] font-medium text-slate-300 uppercase tracking-widest">No hay relevos registrados</p>
                  </td>
                </tr>
              ) : (
                replacements.map((r, idx) => {
                  const key = r.fecha + r.hora + r.retenUnit + r.replacedUnit;
                  const isEditing = editingKey === key;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className={cellStyle}>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[11px] leading-none mb-1">{r.fecha}</span>
                          <span className="font-semibold text-slate-700">{r.hora}</span>
                        </div>
                      </td>
                      <td className={cellStyle}>
                        <span className="font-bold text-slate-500">{r.turno}</span>
                      </td>
                      <td className={cellStyle}>
                        <span className="font-bold text-[#004b93]">{r.replacedUnit}</span>
                      </td>
                      <td className={cellStyle}>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
                          {getUnitSector(r.replacedUnit)}
                        </span>
                      </td>
                      <td className={`${cellStyle} font-mono text-slate-500`}>{r.placa}</td>
                      <td className={`${cellStyle} font-bold text-surco-blue`}>{r.retenUnit}</td>
                      <td className={`${cellStyle} font-mono text-slate-500`}>{r.placaReten}</td>
                      <td className={cellStyle}>
                        <span className="text-[12px] italic text-slate-500">{r.motivo || '--'}</span>
                      </td>
                      <td className={cellStyle}>
                        <div className="flex flex-col text-[12px]">
                          <span className="text-slate-400">{r.fechaIngresoTaller}</span>
                          <span className="font-medium">{r.horaIngresoTaller}</span>
                        </div>
                      </td>
                      <td className={cellStyle}>
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={editForm.fechaSalidaTaller}
                              onChange={e => setEditForm(prev => ({ ...prev, fechaSalidaTaller: e.target.value }))}
                              className="border border-slate-200 rounded px-2 py-0.5 text-[11px] outline-none bg-white"
                            />
                            <input
                              type="time"
                              value={editForm.horaSalidaTaller}
                              onChange={e => setEditForm(prev => ({ ...prev, horaSalidaTaller: e.target.value }))}
                              className="border border-slate-200 rounded px-2 py-0.5 text-[11px] outline-none bg-white"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col text-[12px]">
                            <span className="text-slate-400">{r.fechaSalidaTaller || '--'}</span>
                            <span className="font-medium">{r.horaSalidaTaller || '--'}</span>
                          </div>
                        )}
                      </td>
                      <td className={`${cellStyle} text-center`}>
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleUpdateSalida(r)}
                              disabled={updatingId === key}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Guardar"
                            >
                              {updatingId === key ? (
                                <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
                              ) : (
                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                              )}
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(r)}
                            className="flex items-center gap-1 px-3 py-1.5 mx-auto bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-100 text-[11px] font-bold uppercase tracking-wider"
                            title="Registrar Salida de Taller"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                            SALIDA
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 uppercase tracking-wider">
          <span>{replacements.length} Relevos registrados para el turno {settings.turno}</span>
        </div>
      </div>
    </div>
  );
};

export default RetenManagementView;
