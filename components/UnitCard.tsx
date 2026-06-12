import React, { useState, useEffect, useRef } from 'react';
import { UnitData, UnitStatus, MobileReference, PERSONNEL_NAMES, RADIOS, FUEL_TYPES, SECTORS } from '../types';
import AutocompleteInput from './AutocompleteInput';
import MultiSelectAutocomplete from './MultiSelectAutocomplete';

interface UnitCardProps {
  unit: UnitData;
  allUnits: UnitData[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updated: UnitData) => void;
  onCancel: () => void;
  mobileData?: MobileReference[];
  statusOptions?: string[];
  indicativeOptions?: string[];
  personnelOptions?: string[];
  quadrantOptions?: string[];
  radioOptions?: string[];
  lugarOptions?: string[];
  motivoStatusOptions?: Record<string, string[]>;
  currentDate: string;
  currentShift: string;
  isSaving?: boolean;
  saveStatus?: Record<string, 'saving' | 'saved' | 'error'>;
  readOnly?: boolean;
  personnelRegimenMap?: Record<string, string>;
  codigoTaserOptions?: string[];
}

const UnitCard: React.FC<UnitCardProps> = ({
  unit, allUnits, isEditing, onEdit, onSave, onCancel, mobileData,
  statusOptions, indicativeOptions, personnelOptions, quadrantOptions, radioOptions, lugarOptions, motivoStatusOptions,
  currentDate, currentShift, isSaving, saveStatus, readOnly, personnelRegimenMap, codigoTaserOptions
}) => {
  const [formData, setFormData] = useState<UnitData>(unit);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [kmStart, setKmStart] = useState('');
  const [kmEnd, setKmEnd] = useState('');
  const [kmDiff, setKmDiff] = useState('0');
  const [kmRecarga, setKmRecarga] = useState('');

  const [fuelType, setFuelType] = useState('');
  const [fuelQty, setFuelQty] = useState('');

  // Use provided status options or fallback to constants
  const activeStatusOptions = statusOptions && statusOptions.length > 0 ? statusOptions : Object.values(UnitStatus);
  const activeIndicativeOptions = indicativeOptions || [];
  const activePersonnelOptions = personnelOptions && personnelOptions.length > 0 ? personnelOptions : PERSONNEL_NAMES;
  const activeQuadrantOptions = quadrantOptions && quadrantOptions.length > 0 ? quadrantOptions : (mobileData ? Array.from(new Set(mobileData.map(d => d.quadrant).filter(q => q))) as string[] : []);

  const formatKmStartForEdit = (value: string | undefined) => {
    const trimmed = String(value ?? '').trim();
    return trimmed !== '' && trimmed !== '0' ? trimmed : '';
  };

  useEffect(() => {
    if (isEditing) {
      setKmStart(formatKmStartForEdit(unit.kmStart));
      setKmEnd(String(unit.kmEnd || '0'));
      setKmRecarga(String(unit.kmRecarga || '0'));

      const fuelParts = String(unit.fuel || '').split('/').map(p => p.trim());
      setFuelType(fuelParts[0] || '');
      setFuelQty(fuelParts[1] || '0');

      // Always set formData to unit, ID field will be empty for new units
      setFormData(unit);

      setErrors({});
    }
  }, [isEditing, unit.id, unit.kmStart, unit.kmEnd, unit.kmRecarga, unit.fuel]);

  useEffect(() => {
    const start = parseFloat(kmStart) || 0;
    const end = parseFloat(kmEnd) || 0;
    const diff = end >= start ? (end - start).toFixed(1) : '0';
    setKmDiff(diff);

    setFormData(prev => ({
      ...prev,
      km: `${kmStart || '0'} / ${kmEnd || '0'} / ${diff} / ${kmRecarga || '0'}`,
      kmStart: kmStart || '0',
      kmEnd: kmEnd || '0',
      totalKm: diff,
      kmRecarga: kmRecarga || '0',
      fuel: `${fuelType || '--'} / ${fuelQty || '0'}`
    }));
  }, [kmStart, kmEnd, kmRecarga, fuelType, fuelQty]);

  const lastKmFetchedIdRef = useRef<string>('');

  useEffect(() => {
    if (isEditing && formData.id && formData.id !== lastKmFetchedIdRef.current) {
      const unitId = String(formData.id).trim().toUpperCase();
      if (unitId === '' || unitId.startsWith('AR-')) return;

      lastKmFetchedIdRef.current = formData.id;

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler((km: string) => {
            if (km && km !== '0' && km !== 'undefined' && String(km).trim() !== '') {
              setKmStart(String(km));
            }
          })
          .getPreviousKmEnd(currentDate, currentShift, formData.id, unit.sector || '');
      }
    }
  }, [formData.id, isEditing, unit.sector, currentDate, currentShift]);

  useEffect(() => {
    if (isEditing && (unit.type === 'CHOFER' || unit.type === 'MOTO' || unit.type === 'SERENO')) {
      const dataSource = mobileData || [];
      const unitId = (formData.id || '').toString().toUpperCase();

      // Skip auto-population for 'RETEN' units (AR-)
      if (unitId.startsWith('AR-')) return;

      const found = dataSource.find(v => v.id === formData.id);

      if (found) {
        setFormData(prev => {
          const isIdChanged = formData.id !== unit.id;

          return {
            ...prev,
            plate: found.plate || (isIdChanged ? '' : prev.plate),
            model: found.model || (isIdChanged ? '' : prev.model),
            quadrant: isIdChanged ? (found.quadrant || '') : (prev.quadrant || found.quadrant || '')
          };
        });
      }
    }
  }, [formData.id, isEditing, unit.type, mobileData, unit.id]);

  useEffect(() => {
    if (!isEditing) {
      lastKmFetchedIdRef.current = '';
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleValidateAndSave = () => {
    const isIdDuplicate = formData.id && allUnits.some(u => u.id === formData.id && u.id !== unit.id);

    const specialStatuses = [
      UnitStatus.SIN_VEHICULO,
      UnitStatus.FALTO,
      UnitStatus.APOYO_OTRA_AREA,
      UnitStatus.MANTENIMIENTO,
      UnitStatus.DESPERFECTOS,
      UnitStatus.SIN_CONDUCTOR,
      UnitStatus.SIN_DOCUMENTOS,
      UnitStatus.SINIESTRO,
      UnitStatus.FIN_APOYO
    ];
    const isSpecialStatus = specialStatuses.includes(formData.status?.toUpperCase());
    const isNoPersonnelStatus = [
      UnitStatus.SIN_CONDUCTOR,
      UnitStatus.MANTENIMIENTO,
      UnitStatus.DESPERFECTOS,
      UnitStatus.SIN_DOCUMENTOS,
      UnitStatus.SINIESTRO,
      UnitStatus.FIN_APOYO
    ].includes(formData.status?.toUpperCase());

    const isDesperfectos = formData.status?.toUpperCase() === UnitStatus.DESPERFECTOS;

    const isValidMobileId = !formData.id || String(formData.id).trim() === '' ||
      isSereno ||
      (mobileData && mobileData.some(m => m.id === formData.id));

    const statusKey = formData.status?.toUpperCase();
    const hasMotivoOptions = !!(motivoStatusOptions && statusKey && motivoStatusOptions[statusKey]?.length);

    const newErrors: Record<string, boolean> = {
      status: !formData.status || String(formData.status).trim() === '',
      id: (!isSpecialStatus && (!formData.id || String(formData.id).trim() === '' || isIdDuplicate)) ||
        ((isChofer || isMoto) && formData.id && String(formData.id).trim() !== '' && !isValidMobileId),
      personnel1: !isNoPersonnelStatus && (!formData.personnel1 || String(formData.personnel1).trim() === ''),
      radio: !isSpecialStatus && (!formData.radio || String(formData.radio).trim() === ''),
      quadrant: !isDesperfectos && !isSpecialStatus && !isSereno && !isRescate && (!formData.quadrant || String(formData.quadrant).trim() === ''),
      lugarEstado: hasMotivoOptions && statusKey !== 'FALTO' && (!formData.lugarEstado || String(formData.lugarEstado).trim() === ''),
      motivoEstado: hasMotivoOptions && (!formData.motivoEstado || String(formData.motivoEstado).trim() === ''),
      kmStart: !isSereno && String(kmStart).trim() === '',
    };

    // If ID is provided even in special status, still check for duplicates
    if (isSpecialStatus && formData.id && isIdDuplicate) {
      newErrors.id = true;
    }

    setErrors(newErrors);

    if (Object.values(newErrors).some(v => v)) {
      if (isIdDuplicate && (formData.id || !isSpecialStatus)) {
        alert(`El ID "${formData.id}" ya existe en la vista actual. No se permiten IDs duplicados.`);
      } else if (newErrors.id && (isChofer || isMoto) && formData.id && !isValidMobileId) {
        alert(`El ID "${formData.id}" no es válido. Para Choferes/Motos debe seleccionar una unidad de la lista.`);
      }
      return;
    }
    onSave(formData);
  };

  const labelStyle = "text-[11px] font-medium text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
  const errorInputStyle = "border-red-500 ring-1 ring-red-500 bg-red-50";
  const inputStyle = (fieldName: string) => `w-full border ${errors[fieldName] ? errorInputStyle : 'border-slate-300 bg-white'} rounded px-2 py-1 text-[13px]  h-[32px] focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm`;
  const labelStyleEdit = "text-[11px] font-medium text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
  const errorMsgStyle = "text-[10px]  text-red-600 uppercase leading-tight mt-0.5";
  const infoValueStyle = "text-[13px] font-medium text-slate-800 truncate leading-tight uppercase";

  const badgeColors: Record<string, string> = {
    [UnitStatus.PATRULLANDO]: "bg-green-100 text-green-700 border-green-200",
    [UnitStatus.APOYO_OTRA_AREA]: "bg-blue-100 text-blue-700 border-blue-200",
    [UnitStatus.SIN_DOCUMENTOS]: "bg-amber-100 text-amber-700 border-amber-200",
    [UnitStatus.SIN_VEHICULO]: "bg-yellow-100 text-yellow-700 border-yellow-200",
    [UnitStatus.SIN_CONDUCTOR]: "bg-amber-100 text-amber-700 border-amber-200",
  };

  const redStatusPatterns = [
    UnitStatus.MANTENIMIENTO,
    UnitStatus.DESPERFECTOS,
    UnitStatus.SINIESTRO,
    UnitStatus.FALTO,
  ];

  const grayStatusPatterns = [
    UnitStatus.FIN_APOYO,
  ];

  const getBadgeClass = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (badgeColors[status]) return badgeColors[status];
    if (redStatusPatterns.includes(s)) return "bg-red-100 text-red-700 border-red-200";
    if (grayStatusPatterns.includes(s)) return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const isRescate = unit.sector === 'RESCATE';
  const isChofer = unit.type === 'CHOFER';
  const isMoto = unit.type === 'MOTO';
  const isSereno = unit.type === 'SERENO';
  const hasPersonnel2 = isChofer;
  const hasPlate = !isSereno;
  const hasIndicative = isChofer;

  const renderToggle = (field: 'taser' | 'bodycam', label: string) => {
    const isOn = formData[field] === 'SI';
    return (
      <div>
        <label className={labelStyleEdit}>{label}</label>
        <div className="flex items-center h-[32px]">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isOn} onChange={() => setFormData(prev => ({ ...prev, [field]: prev[field] === 'SI' ? '' : 'SI' }))} />
            <div className="w-9 h-5 bg-[#D0D5E8] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005ea5]"></div>
          </label>
          <span className={`ml-1.5 text-[10px] font-medium ${isOn ? 'text-[#005ea5]' : 'text-[#8888AA]'}`}>{isOn ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    );
  };
  const hasKmRecarga = (isChofer || isMoto) && !isRescate;

  // Configuración de estilo según tipo (Actualizado MOTO a Violeta)
  const typeConfig = {
    CHOFER: {
      lineBg: 'bg-blue-500',
      idBadge: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    MOTO: {
      lineBg: 'bg-violet-500',
      idBadge: 'bg-violet-100 text-violet-700 border-violet-200'
    },
    SERENO: {
      lineBg: 'bg-teal-500',
      idBadge: 'bg-teal-100 text-teal-700 border-teal-200'
    }
  }[unit.type] || { lineBg: 'bg-slate-500', idBadge: 'bg-slate-100 text-slate-700 border-slate-200' };

  const isC4orCOVV = unit.sector === 'C4' || unit.sector === 'COVV';
  const showTaserFields = !isC4orCOVV && !isRescate;
  const serenoLabel = isC4orCOVV ? 'Operador' : 'Sereno';
  const personalLabel = isC4orCOVV ? 'Operador' : 'Personal';

  if (isEditing) {
    const idStr = String(formData.id);
    const isNew = idStr === '';
    const labelStyleEdit = "text-[11px] font-medium text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
    return (
      <div className={`relative z-50 border-2 border-blue-500 bg-blue-50/50 rounded-xl p-4 mb-4 shadow-lg flex items-center gap-4`}>
        {/* Línea vertical distintiva estilo moderno */}
        <div className={`w-1.5 min-h-[220px] self-stretch ${typeConfig.lineBg} rounded-full shrink-0 shadow-sm`}></div>

        <div className="flex-1 min-w-0">
          {/* Línea 1: Identificación, Logística y Estado (Exactamente 12 cols) */}
          <div className="grid grid-cols-12 gap-1.5 pb-2">
            <div className="col-span-1">
              <label className={labelStyleEdit}>ID</label>
              <AutocompleteInput
                value={String(formData.id)}
                onChange={(val) => {
                  setFormData(prev => {
                    const newData = { ...prev, id: val };
                    if ((isChofer || isMoto) && mobileData) {
                      const matched = mobileData.find(m => m.id === val);
                      if (matched && matched.plate) {
                        newData.plate = matched.plate;
                      }
                    }
                    return newData;
                  });
                  setErrors(prev => ({ ...prev, id: false }));
                }}
                suggestions={isSereno ? [] : (mobileData || []).map(v => v.id).filter(vId => !allUnits.some(u => u.id === vId && u.id !== unit.id))}
                placeholder="M-01"
                error={errors.id}
                strict={isChofer || isMoto}
              />
              {errors.id && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            <div className="col-span-2">
              <label className={labelStyleEdit}>{isSereno ? personalLabel : isMoto ? 'Motorizado' : 'Chofer'}</label>
              <AutocompleteInput
                value={formData.personnel1}
                onChange={(val) => { setFormData(prev => ({ ...prev, personnel1: val })); setErrors(prev => ({ ...prev, personnel1: false })); }}
                suggestions={activePersonnelOptions}
                placeholder="Nombre..."
                error={errors.personnel1}
              />
              {errors.personnel1 && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            <div className="col-span-1">
              <label className={labelStyleEdit}>Radio</label>
              <AutocompleteInput
                value={formData.radio}
                onChange={(val) => {
                  if (val !== '' && !/^\d+$/.test(val)) return;
                  setFormData(prev => ({ ...prev, radio: val }));
                  setErrors(prev => ({ ...prev, radio: false }));
                }}
                suggestions={Array.from(new Set([
                  ...RADIOS,
                  ...(radioOptions || []),
                  ...(mobileData ? mobileData.map(d => d.radio).filter(r => r) : [])
                ])) as string[]}
                placeholder="20xxx"
                error={errors.radio}
              />
              {errors.radio && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            {isChofer && (
              <div className="col-span-2">
                <label className={labelStyleEdit}>Copiloto</label>
                <input
                  name="personnel2"
                  value={formData.personnel2 || ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.]/g, '');
                    setFormData(prev => ({ ...prev, personnel2: cleaned }));
                  }}
                  className={inputStyle('personnel2')}
                  placeholder="Nombre..."
                />
              </div>
            )}

            {isChofer && (
              <div className="col-span-1">
                <label className={labelStyleEdit}>Indicativo Copiloto</label>
                <select name="indicative" value={formData.indicative || ''} onChange={handleChange} className={`${inputStyle('indicative')} py-0 text-[12px]`}>
                  <option value="">--</option>
                  {formData.indicative && !activeIndicativeOptions.includes(formData.indicative) && <option value={formData.indicative}>{formData.indicative}</option>}
                  {activeIndicativeOptions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            )}

            {!isSereno && (
              <div className="col-span-1">
                <label className={labelStyleEdit}>Cuadrante</label>
                <MultiSelectAutocomplete
                  value={formData.quadrant || ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, quadrant: val }))}
                  suggestions={activeQuadrantOptions}
                  placeholder="Selec..."
                  error={errors.quadrant}
                  strict={true}
                />
                {errors.quadrant && <span className={errorMsgStyle}>Requerido</span>}
              </div>
            )}
            {isSereno && (
              <div className="col-span-1">
                <label className={labelStyleEdit}>Cuadrante</label>
                <MultiSelectAutocomplete
                  value={formData.quadrant || ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, quadrant: val }))}
                  suggestions={activeQuadrantOptions}
                  placeholder="Selec..."
                  strict={true}
                />
              </div>
            )}

            <div className="col-span-1">
              <label className={labelStyleEdit}>Estado <span className="text-red-500">*</span></label>
              <select name="status" value={formData.status} onChange={(e) => { handleChange(e); setErrors(prev => ({ ...prev, status: false })); }} onMouseDown={(e) => e.stopPropagation()} className={`${inputStyle('status')} py-0 text-[11px] font-medium`}>
                <option value="">--</option>
                {formData.status && !activeStatusOptions.includes(formData.status) && <option value={formData.status}>{formData.status}</option>}
                {activeStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.status && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            <div className="col-span-1">
              <label className={labelStyleEdit}>Lugar Estado</label>
              {lugarOptions && lugarOptions.length > 0 ? (
                <select name="lugarEstado" value={formData.lugarEstado || ''} onChange={handleChange} onMouseDown={(e) => e.stopPropagation()} className={`${inputStyle('lugarEstado')} py-0 text-[11px]`}>
                  <option value="">--</option>
                  {lugarOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input name="lugarEstado" value={formData.lugarEstado || ''} onChange={handleChange} className={inputStyle('lugarEstado')} placeholder="Lugar..." />
              )}
              {errors.lugarEstado && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            <div className="col-span-2">
              <label className={labelStyleEdit}>Motivo Estado</label>
              {(() => {
                const statusKey = formData.status?.toUpperCase();
                const motivoList = motivoStatusOptions && statusKey ? motivoStatusOptions[statusKey] : undefined;
                if (motivoList && motivoList.length > 0) {
                  return (
                    <select name="motivoEstado" value={formData.motivoEstado || ''} onChange={handleChange} onMouseDown={(e) => e.stopPropagation()} className={`${inputStyle('motivoEstado')} py-0 text-[11px]`}>
                      <option value="">--</option>
                      {motivoList.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  );
                }
                return <input name="motivoEstado" value={formData.motivoEstado || ''} onChange={handleChange} className={inputStyle('motivoEstado')} placeholder="Motivo..." />;
              })()}
              {errors.motivoEstado && <span className={errorMsgStyle}>Requerido</span>}
            </div>

            {isSereno && (
              <div className="col-span-2">
                <label className={labelStyleEdit}>Observaciones</label>
                <input name="mechanics" value={formData.mechanics || ''} onChange={handleChange} className={inputStyle('mechanics')} placeholder="Motivo | Fecha | Hora" />
              </div>
            )}

            <div className={isChofer ? "col-span-0" : isSereno ? "col-span-1" : "col-span-3"}></div>
          </div>

          {/* Línea 2: Operatividad Detallada + TASER (Exactamente 12 cols) */}
          <div className="grid grid-cols-12 gap-1.5 pt-0.5">
            {!isSereno ? (
              <>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>Placa</label>
                  <input name="plate" value={formData.plate} onChange={handleChange} readOnly={isChofer || isMoto} className={`${inputStyle('plate')} ${isChofer || isMoto ? 'bg-slate-50 text-slate-500' : ''}`} />
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>KM INICIO <span className="text-red-500">*</span></label>
                  <input type="number" name="kmStart" value={kmStart} min={0} step="0.1" placeholder="Km" onChange={(e) => { setKmStart(e.target.value); setErrors(prev => ({ ...prev, kmStart: false })); }} className={inputStyle('kmStart')} />
                  {errors.kmStart && <span className={errorMsgStyle}>Requerido</span>}
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>KM RECARGA</label><input type="number" value={kmRecarga} onChange={(e) => setKmRecarga(e.target.value)} className={`${inputStyle('kmRecarga')} bg-amber-50`} />
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>COMBUSTIBLE</label>
                  <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={`${inputStyle('fuelType')} py-0 text-[11px] font-medium`}>
                    <option value="">--</option>
                    {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>CANTIDAD</label><input type="number" step="0.01" value={fuelQty} onChange={(e) => setFuelQty(e.target.value)} className={inputStyle('fuelQty')} />
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>GASTO</label><input type="number" step="0.01" value={String(formData.expense || '').replace('S/ ', '')} onChange={(e) => setFormData(prev => ({ ...prev, expense: `S/ ${e.target.value}` }))} className={inputStyle('expense')} />
                </div>
                <div className="col-span-1">
                  <label className={labelStyleEdit}>Observaciones</label><input name="mechanics" value={formData.mechanics || ''} onChange={handleChange} className={inputStyle('mechanics')} placeholder="Motivo | Fecha | Hora" />
                </div>
                {showTaserFields && (
                  <>
                    <div className="col-span-1">
                      {renderToggle('taser', 'TASER')}
                    </div>
                    <div className="col-span-1">
                      {renderToggle('bodycam', 'BODYCAM')}
                    </div>
                    <div className="col-span-1">
                      <label className={labelStyleEdit}>CÓDIGO TASER</label>
                      <AutocompleteInput value={formData.codigoTaser} onChange={(val) => setFormData(prev => ({ ...prev, codigoTaser: val }))} suggestions={codigoTaserOptions || []} placeholder="Código..." />
                    </div>
                    <div className="col-span-2">
                      <label className={labelStyleEdit}>OBSERVACIONES TASER</label>
                      <input value={formData.obsTaser || ''} onChange={(e) => setFormData(prev => ({ ...prev, obsTaser: e.target.value }))} className={inputStyle('obsTaser')} placeholder="Observaciones..." />
                    </div>
                  </>
                )}
              </>
            ) : showTaserFields ? (
              <div className="col-span-12 grid grid-cols-12 gap-1.5">
                <div className="col-span-1">
                  {renderToggle('taser', 'TASER')}
                </div>
                <div className="col-span-1">
                  {renderToggle('bodycam', 'BODYCAM')}
                </div>
                <div className="col-span-3">
                  <label className={labelStyleEdit}>CÓDIGO TASER</label>
                  <AutocompleteInput value={formData.codigoTaser} onChange={(val) => setFormData(prev => ({ ...prev, codigoTaser: val }))} suggestions={codigoTaserOptions || []} placeholder="Código..." />
                </div>
                <div className="col-span-7">
                  <label className={labelStyleEdit}>OBS. TASER</label>
                  <input value={formData.obsTaser || ''} onChange={(e) => setFormData(prev => ({ ...prev, obsTaser: e.target.value }))} className={inputStyle('obsTaser')} placeholder="Observaciones..." />
                </div>
              </div>
            ) : (
              <></>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button onClick={onCancel} className="bg-white border border-slate-300 text-slate-600 text-[12px] font-medium py-2 px-5 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1">
              CANCELAR
            </button>
            <button
              onClick={handleValidateAndSave}
              disabled={isSaving}
              className={`bg-[#005cbb] text-white text-[12px] font-medium py-2 px-5 rounded-lg hover:bg-[#004a96] transition-all flex items-center gap-2 group ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <lord-icon
                src="https://cdn.lordicon.com/egiwmiit.json"
                trigger="hover"
                colors="primary:#ffffff"
                style={{ width: '16px', height: '16px' }}>
              </lord-icon>
              {isSaving ? 'GUARDANDO...' : (isNew ? 'GUARDAR' : 'GUARDAR')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`border border-slate-200 bg-white rounded-xl p-2.5 mb-2 hover:shadow-md transition-all group overflow-hidden flex items-center`}>
        {/* Línea vertical distintiva estilo moderno */}
        <div className={`w-1.5 h-9 ${typeConfig.lineBg} rounded-full ml-1 mr-3 shrink-0 shadow-sm`}></div>

        {/* Grid principal optimizado para lectura de ancho completo */}
        <div className={`grid items-center gap-2 flex-1 ${isSereno ? 'grid-cols-[140px_1.5fr_2fr_auto_60px_90px]' : 'grid-cols-[48px_1fr_2fr_auto_auto_0.7fr_0.7fr_1.1fr_75px] max-[1399px]:grid-cols-[48px_1fr_2fr_auto_0.7fr_1.1fr_75px]'}`}>

          {/* Columna ID (Ligeros) */}
          <div className="text-center">
            <div className={`${typeConfig.idBadge} h-9 flex items-center justify-center rounded-lg font-medium text-[13px] shadow-sm`}>
              {unit.id}
            </div>
          </div>

          {/* Columna Personal Principal y Copiloto */}
          <div className="border-r border-slate-100 pr-2 min-w-0">
            <label className={labelStyle}>{isSereno ? serenoLabel : isMoto ? 'Motorizado' : 'Chofer'}</label>
            <div className={infoValueStyle}>{unit.personnel1 || '--'}</div>
            {unit.personnel1 && personnelRegimenMap?.[unit.personnel1.trim().toUpperCase()] && (
              <div className="text-[9px] text-slate-400 uppercase tracking-tight leading-tight mt-0.5">
                {personnelRegimenMap[unit.personnel1.trim().toUpperCase()]}
              </div>
            )}
          </div>

          {/* Columna Logística Radio/Indicativo/Cuadrante */}
          <div className="flex gap-4 border-r border-slate-100 px-2 min-w-0">
            <div className="flex flex-col flex-1 min-w-[50px]">
              <label className={labelStyle}>Radio</label>
              <div className={`${infoValueStyle} text-slate-800`}>
                {unit.radio || '--'}
              </div>
            </div>
            {isChofer && (
              <div className="flex flex-col flex-1 min-w-[130px] max-[1399px]:hidden">
                <label className={labelStyle}>Copiloto</label>
                <div className={infoValueStyle}>{unit.personnel2 || '--'}</div>
              </div>
            )}
            {hasIndicative && (
              <div className="flex flex-col flex-1 min-w-[110px]">
                <label className={labelStyle}>Indicativo Copiloto</label>
                <div className={infoValueStyle}>{unit.indicative || '--'}</div>
              </div>
            )}
            {!isRescate && (
              <div className="flex flex-col flex-1 min-w-[80px]">
                <label className={labelStyle}>Cuadrante</label>
                <div className={infoValueStyle}>
                  {unit.quadrant || mobileData?.find(m => m.id === unit.id)?.quadrant || '--'}
                </div>
              </div>
            )}
          </div>

          {/* Columna Placa */}
          {hasPlate && (
            <div className="border-r border-slate-100 px-2 whitespace-nowrap max-[1399px]:hidden">
              <label className={labelStyle}>Placa</label>
              <div className="text-[10px] font-medium text-slate-800 bg-slate-50 px-1 rounded inline-block uppercase border border-slate-100">
                {mobileData?.find(m => m.id === unit.id)?.plate || ''}
              </div>
            </div>
          )}

          {/* Columna Estado */}
          <div className="border-r border-slate-100 px-2 w-32 shrink-0">
            <label className={labelStyle}>Estado</label>
            <span className={`px-1.5 rounded text-[13px] font-medium border uppercase inline-block ${getBadgeClass(unit.status)}`} style={{ whiteSpace: 'normal', lineHeight: '1.2' }}>
              {unit.status}
            </span>
            {unit.lugarEstado && <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Lugar: {unit.lugarEstado}</div>}
            {unit.motivoEstado && <div className="text-[9px] text-slate-500 leading-tight">Motivo: {unit.motivoEstado}</div>}
          </div>

          {!isSereno && (
            <>
              {/* Columna KM Centrada */}
              <div className="border-r border-slate-100 px-2">
                <label className={labelStyle}>KM (Inicio/Fin/Recorrido)</label>
                <div className="flex items-center gap-1 text-[13px] font-medium">
                  <span className="text-slate-400">{String(unit.km || '').split('/')[0] || '0'}</span>
                  <span className="text-slate-200">/</span>
                  <span className="text-slate-400">{String(unit.km || '').split('/')[1] || '0'}</span>
                  <span className="text-slate-200">/</span>
                  <span className="text-slate-900 font-medium">{String(unit.km || '').split('/')[2] || '0'}</span>
                </div>
              </div>

              {/* Columna Combustible Centrada con Recarga integrada */}
              <div className="border-r border-slate-100 px-2 max-[1399px]:hidden">
                <label className={labelStyle}>Combustible</label>
                <div className="flex items-center gap-1 text-[13px] font-medium">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span>{String(unit.fuel || '').split('/')[0] || '--'}</span>
                    {(() => {
                      const gal = String(unit.fuel || '').split('/')[1]?.trim();
                      return gal && gal !== '0' ? (
                        <span className="text-amber-600 text-[13px] font-medium" title="Galones">({gal} GL)</span>
                      ) : null;
                    })()}
                  </div>
                  <span className="text-slate-200">|</span>
                  <span className={`${unit.expense !== 'S/ 0.00' ? 'text-green-600' : 'text-slate-400'}`}>{unit.expense}</span>
                </div>
              </div>

              {/* Columna Observaciones */}
              <div className="border-r border-slate-100 px-2">
                <label className={labelStyle}>Observaciones</label>
                <div className="text-[11px] text-slate-600 leading-tight">
                  {unit.mechanics || '--'}
                </div>
              </div>
            </>
          )}

          {/* Columna Acciones */}
          <div className="text-right flex justify-end gap-2 items-center">
            {(() => {
              const key = unit.unit_id || unit.tempId || unit.id || '';
              const status = saveStatus?.[key];
              if (!status) return null;
              return status === 'saving'
                ? <span className="material-symbols-outlined text-amber-500 text-[18px] animate-spin">progress_activity</span>
                : status === 'saved'
                ? <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                : <span className="material-symbols-outlined text-red-500 text-[18px]" title="Error al guardar">cancel</span>;
            })()}
            {!readOnly && (
              <button onClick={onEdit} title="Editar" className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-all flex items-center group shadow-sm hover:shadow-md active:scale-95">
                <lord-icon
                  src="https://cdn.lordicon.com/puvaffet.json"
                  trigger="hover"
                  colors="primary:#2563eb,secondary:#1d4ed8"
                  style={{ width: '20px', height: '20px' }}>
                </lord-icon>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UnitCard;