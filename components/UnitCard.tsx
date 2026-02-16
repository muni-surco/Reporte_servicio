import React, { useState, useEffect } from 'react';
import { UnitData, UnitStatus } from '../types';
import AutocompleteInput from './AutocompleteInput';
import MultiSelectAutocomplete from './MultiSelectAutocomplete';
import { PERSONNEL_NAMES, RADIOS, FUEL_TYPES, SECTORS } from '../constants';

interface UnitCardProps {
  unit: UnitData;
  allUnits: UnitData[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updated: UnitData) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  mobileData?: { id: string; plate: string; radio?: string; quadrant?: string; sector?: string; }[];
  statusOptions?: string[];
  indicativeOptions?: string[];
  personnelOptions?: string[];
  quadrantOptions?: string[];
}

const UnitCard: React.FC<UnitCardProps> = ({
  unit, allUnits, isEditing, onEdit, onSave, onCancel, onDelete, mobileData,
  statusOptions, indicativeOptions, personnelOptions, quadrantOptions
}) => {
  const [formData, setFormData] = useState<UnitData>(unit);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [kmStart, setKmStart] = useState('');
  const [kmEnd, setKmEnd] = useState('');
  const [kmDiff, setKmDiff] = useState('0');
  const [kmRecarga, setKmRecarga] = useState('');

  const [hourStart, setHourStart] = useState('');
  const [hourEnd, setHourEnd] = useState('');

  const [fuelType, setFuelType] = useState('');
  const [fuelQty, setFuelQty] = useState('');

  // Use provided status options or fallback to constants
  const activeStatusOptions = statusOptions && statusOptions.length > 0 ? statusOptions : Object.values(UnitStatus);
  const activeIndicativeOptions = indicativeOptions || [];
  const activePersonnelOptions = personnelOptions && personnelOptions.length > 0 ? personnelOptions : PERSONNEL_NAMES;
  const activeQuadrantOptions = quadrantOptions && quadrantOptions.length > 0 ? quadrantOptions : (mobileData ? Array.from(new Set(mobileData.map(d => d.quadrant).filter(q => q))) as string[] : []);

  useEffect(() => {
    if (isEditing) {
      const kmParts = unit.km.split('/').map(p => p.trim());
      setKmStart(kmParts[0] || '0');
      setKmEnd(kmParts[1] || '0');
      setKmRecarga(kmParts[3] || '0');

      const hourParts = unit.hours.split('-').map(p => p.trim());
      setHourStart(hourParts[0] || '');
      setHourEnd(hourParts[1] || '');

      const fuelParts = unit.fuel.split('/').map(p => p.trim());
      setFuelType(fuelParts[0] || '');
      setFuelQty(fuelParts[1] || '0');

      // Always set formData to unit, ID field will be empty for new units
      setFormData(unit);

      setErrors({});
    }
  }, [isEditing, unit.id, unit.km, unit.hours, unit.fuel]);

  useEffect(() => {
    const start = parseFloat(kmStart) || 0;
    const end = parseFloat(kmEnd) || 0;
    const diff = end >= start ? (end - start).toFixed(1) : '0';
    setKmDiff(diff);

    setFormData(prev => ({
      ...prev,
      km: `${kmStart || '0'} / ${kmEnd || '0'} / ${diff} / ${kmRecarga || '0'}`,
      hours: `${hourStart || '--:--'} - ${hourEnd || '--:--'}`,
      fuel: `${fuelType || '--'} / ${fuelQty || '0'}`
    }));
  }, [kmStart, kmEnd, kmRecarga, hourStart, hourEnd, fuelType, fuelQty]);

  useEffect(() => {
    if (isEditing && (unit.type === 'CHOFER' || unit.type === 'MOTO' || unit.type === 'SERENO')) {
      const dataSource = mobileData || [];
      const found = dataSource.find(v => v.id === formData.id);

      if (found) {
        setFormData(prev => ({
          ...prev,
          plate: found.plate || prev.plate,
          // Only auto-fill quadrant if currently empty or '--'. Radio is now left blank by default.
          quadrant: (!prev.quadrant || prev.quadrant === '--') ? (found.quadrant || prev.quadrant) : prev.quadrant
        }));
      }
    }
  }, [formData.id, isEditing, unit.type, mobileData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleValidateAndSave = () => {
    const isIdDuplicate = allUnits.some(u => u.id === formData.id && u.id !== unit.id);

    const newErrors: Record<string, boolean> = {
      id: !formData.id || String(formData.id).trim() === '' || isIdDuplicate || String(formData.id).startsWith('NEW-'),
      personnel1: !formData.personnel1 || String(formData.personnel1).trim() === '',
      radio: !formData.radio || String(formData.radio).trim() === '',
      quadrant: !isRescate && (!formData.quadrant || String(formData.quadrant).trim() === ''),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(v => v)) {
      if (isIdDuplicate) {
        alert(`El ID "${formData.id}" ya existe en la vista actual. No se permiten IDs duplicados.`);
      }
      return;
    }
    onSave(formData);
  };

  const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
  const errorInputStyle = "border-red-500 ring-1 ring-red-500 bg-red-50";
  const inputStyle = (fieldName: string) => `w-full border ${errors[fieldName] ? errorInputStyle : 'border-slate-300 bg-white'} rounded px-2 py-1 text-[12px] font-medium h-[28px] focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm`;
  const infoValueStyle = "text-[11px] font-bold text-slate-800 truncate leading-tight uppercase";

  const badgeColors = {
    [UnitStatus.PATRULLANDO]: "bg-green-100 text-green-700 border-green-200",
    [UnitStatus.EXPLANADA]: "bg-blue-100 text-blue-700 border-blue-200",
    [UnitStatus.APOYO_OTRA_AREA]: "bg-blue-100 text-blue-700 border-blue-200",
    [UnitStatus.MAESTRANZA]: "bg-red-100 text-red-700 border-red-200",
    [UnitStatus.TALLER_PARTICULAR]: "bg-red-100 text-red-700 border-red-200",
    [UnitStatus.CHOFER_SIN_MOVIL]: "bg-red-100 text-red-700 border-red-200",
    [UnitStatus.EN_PC_X_DESPERFECTOS]: "bg-red-100 text-red-700 border-red-200",
    [UnitStatus.OPERATIVA_SIN_DOCUMENTOS]: "bg-amber-100 text-amber-700 border-amber-200",
    [UnitStatus.OPERATIVA_SIN_CHOFER]: "bg-amber-100 text-amber-700 border-amber-200"
  };

  const isRescate = unit.sector === 'RESCATE';
  const isChofer = unit.type === 'CHOFER';
  const isMoto = unit.type === 'MOTO';
  const isSereno = unit.type === 'SERENO';
  const hasPersonnel2 = isChofer;
  const hasPlate = !isSereno;
  const hasIndicative = isChofer;
  const hasKmRecarga = (isChofer || isMoto) && !isRescate;

  // Configuración de estilo según tipo (Actualizado MOTO a Violeta)
  const typeConfig = {
    CHOFER: {
      borderLeft: 'border-l-blue-500',
      idBadge: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    MOTO: {
      borderLeft: 'border-l-violet-500',
      idBadge: 'bg-violet-100 text-violet-700 border-violet-200'
    },
    SERENO: {
      borderLeft: 'border-l-teal-500',
      idBadge: 'bg-teal-100 text-teal-700 border-teal-200'
    }
  }[unit.type];

  // (Modal logic omitted for brevity as it is unchanged)
  const DeleteConfirmationModal = () => (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-red-600 text-4xl">warning</span>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">¿Confirmar eliminación?</h3>
          <p className="text-slate-500 text-sm mb-6">
            Está a punto de eliminar la unidad <span className="font-medium text-slate-800">{unit.id}</span>.
            Esta acción no se puede deshacer.
          </p>
          <div className="flex w-full gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-200 transition-colors"
            >
              CANCELAR
            </button>
            <button
              onClick={() => { onDelete(unit.id); setShowDeleteModal(false); }}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium text-xs hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              SÍ, ELIMINAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isEditing) {
    const idStr = String(formData.id);
    const isNew = idStr === '' || idStr.startsWith('NEW-');
    const labelStyleEdit = "text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
    return (
      <div className={`relative z-50 border-2 border-blue-500 bg-blue-50/50 rounded-xl p-4 mb-4 shadow-lg ${typeConfig.borderLeft} border-l-4`}>
        <div className={`grid grid-cols-12 gap-3 ${!isSereno ? 'pb-3 mb-3 border-b border-blue-100' : ''}`}>
          <div className="col-span-1">
            <label className={labelStyleEdit}>ID {errors.id && <span className="text-red-600 font-bold ml-1">*</span>}</label>
            <AutocompleteInput
              value={String(formData.id).startsWith('NEW-') ? '' : String(formData.id)}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, id: val }));
                setErrors(prev => ({ ...prev, id: false }));
              }}
              suggestions={(mobileData || []).map(v => v.id).filter(vId => !allUnits.some(u => u.id === vId && u.id !== unit.id))}
              placeholder="M-00"
              className={errors.id ? errorInputStyle : ''}
            />
          </div>

          <div className={isSereno || isMoto ? 'col-span-3' : 'col-span-2'}>
            <label className={labelStyleEdit}>{isSereno ? 'Sereno' : isMoto ? 'Motorizado' : 'Chofer'} {errors.personnel1 && <span className="text-red-600 font-bold ml-1">*</span>}</label>
            <AutocompleteInput
              value={formData.personnel1}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, personnel1: val }));
                setErrors(prev => ({ ...prev, personnel1: false }));
              }}
              suggestions={activePersonnelOptions}
              placeholder="Nombre Personal..."
              error={errors.personnel1}
            />
          </div>

          {hasPersonnel2 && (
            <div className="col-span-2">
              <label className={labelStyleEdit}>Copiloto</label>
              <AutocompleteInput
                value={formData.personnel2 || ''}
                onChange={(val) => setFormData(prev => ({ ...prev, personnel2: val }))}
                suggestions={activePersonnelOptions}
                placeholder="Nombre Copiloto..."
              />
            </div>
          )}

          {hasIndicative && (
            <div className="col-span-1">
              <label className={labelStyleEdit}>Indic.</label>
              <select
                name="indicative"
                value={formData.indicative || ''}
                onChange={handleChange}
                className={`${inputStyle('indicative')} py-0 text-[11px]`}
              >
                <option value="">--</option>
                {/* Add current value if not in options to avoid hidden state */}
                {formData.indicative && !activeIndicativeOptions.includes(formData.indicative) && (
                  <option value={formData.indicative}>{formData.indicative}</option>
                )}
                {activeIndicativeOptions.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          )}

          {hasPlate && (
            <div className="col-span-2">
              <label className={labelStyleEdit}>Placa</label>
              <input
                name="plate"
                value={formData.plate}
                onChange={handleChange}
                readOnly={isChofer || isMoto}
                className={`${inputStyle('plate')} ${isChofer || isMoto ? 'bg-slate-100 text-slate-500' : ''}`}
              />
            </div>
          )}

          <div className="col-span-1">
            <label className={labelStyleEdit}>Radio {errors.radio && <span className="text-red-600 font-bold ml-1">*</span>}</label>
            <AutocompleteInput
              value={formData.radio}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, radio: val }));
                setErrors(prev => ({ ...prev, radio: false }));
              }}
              // Dynamically build radio list from mobileData and RADIOS constant
              suggestions={Array.from(new Set([
                ...RADIOS,
                ...(mobileData ? mobileData.map(d => d.radio).filter(r => r) : [])
              ])) as string[]}
              placeholder="20000"
              className={errors.radio ? errorInputStyle : ''}
            />
          </div>

          {!isRescate && (
            <div className="col-span-2">
              <label className={labelStyleEdit}>Cuad.</label>
              <MultiSelectAutocomplete
                value={formData.quadrant}
                onChange={(val) => setFormData(prev => ({ ...prev, quadrant: val }))}
                suggestions={activeQuadrantOptions}
                placeholder="Seleccionar..."
                error={errors.quadrant}
              />
            </div>
          )}

          <div className={isSereno ? 'col-span-2' : 'col-span-1'}>
            <label className={labelStyleEdit}>Motivo</label>
            <input name="reason" value={formData.reason} onChange={handleChange} className={inputStyle('reason')} />
          </div>

          {isSereno && (
            <>
              <div className="col-span-1">
                <label className={labelStyleEdit}>Estado</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={`${inputStyle('status')} py-0`}
                >
                  <option value="">--</option>
                  {/* Add current value if not in options */}
                  {formData.status && !activeStatusOptions.includes(formData.status) && (
                    <option value={formData.status}>{formData.status}</option>
                  )}
                  {activeStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelStyleEdit}>Partes</label>
                <input type="number" name="parts" value={formData.parts} onChange={handleChange} className={inputStyle('parts')} />
              </div>
            </>
          )}
        </div>

        {!isSereno && (
          <div className="grid grid-cols-12 gap-3 pb-3">
            <div className="col-span-1">
              <label className={labelStyleEdit}>Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`${inputStyle('status')} py-0`}
              >
                <option value="">--</option>
                {/* Add current value if not in options */}
                {formData.status && !activeStatusOptions.includes(formData.status) && (
                  <option value={formData.status}>{formData.status}</option>
                )}
                {activeStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-3 grid grid-cols-3 gap-1">
              <div><label className={labelStyleEdit}>KM INICIO</label><input type="number" value={kmStart} onChange={(e) => setKmStart(e.target.value)} className={inputStyle('kmStart')} /></div>
              <div><label className={labelStyleEdit}>KM FIN</label><input type="number" value={kmEnd} onChange={(e) => setKmEnd(e.target.value)} className={inputStyle('kmEnd')} /></div>
              <div><label className={labelStyleEdit}>TOTAL</label><div className="bg-blue-100 border border-blue-200 rounded px-2 py-1 text-[11px] font-medium text-blue-700 h-[28px] flex items-center justify-center">{kmDiff}</div></div>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <div><label className={labelStyleEdit}>INICIO H.</label><input type="time" value={hourStart} onChange={(e) => setHourStart(e.target.value)} className={inputStyle('hourStart')} /></div>
              <div><label className={labelStyleEdit}>FIN H.</label><input type="time" value={hourEnd} onChange={(e) => setHourEnd(e.target.value)} className={inputStyle('hourEnd')} /></div>
            </div>
            <div className={`col-span-${hasKmRecarga ? '4' : '3'} grid grid-cols-${hasKmRecarga ? '4' : '3'} gap-1`}>
              {hasKmRecarga && (
                <div><label className={labelStyleEdit}>RECARGA</label><input type="number" value={kmRecarga} onChange={(e) => setKmRecarga(e.target.value)} className={`${inputStyle('kmRecarga')} bg-amber-50`} /></div>
              )}
              <div><label className={labelStyleEdit}>TIPO COMB.</label>
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={`${inputStyle('fuelType')} py-0`}>
                  <option value="">--</option>
                  {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><label className={labelStyleEdit}>CANT.</label><input type="number" step="0.01" value={fuelQty} onChange={(e) => setFuelQty(e.target.value)} className={inputStyle('fuelQty')} /></div>
              <div><label className={labelStyleEdit}>GASTO (S/)</label><input type="number" step="0.01" value={formData.expense.replace('S/ ', '')} onChange={(e) => setFormData(prev => ({ ...prev, expense: `S/ ${e.target.value}` }))} className={inputStyle('expense')} /></div>
            </div>
            <div className="col-span-2">
              <label className={labelStyleEdit}>PARTES/INTERV.</label>
              <input type="number" name="parts" value={formData.parts} onChange={handleChange} className={inputStyle('parts')} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-blue-200/50">
          <button onClick={onCancel} className="bg-white border border-slate-300 text-slate-600 text-[10px] font-black py-2 px-5 rounded-lg hover:bg-slate-50 transition-all">CANCELAR</button>
          <button onClick={handleValidateAndSave} className="bg-blue-600 text-white text-[10px] font-black py-2 px-5 rounded-lg hover:bg-blue-700 transition-all">{isNew ? 'CREAR UNIDAD' : 'GUARDAR'}</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showDeleteModal && <DeleteConfirmationModal />}

      <div className={`border border-slate-200 bg-white rounded-xl p-2.5 mb-2 hover:shadow-md transition-all group overflow-hidden border-l-[5px] ${typeConfig.borderLeft}`}>
        {/* Grid principal optimizado para lectura de ancho completo */}
        <div className={`grid items-center gap-4 ${isSereno ? 'grid-cols-[48px_2fr_minmax(100px,1fr)_auto_min-content_1.5fr_64px]' : 'grid-cols-[48px_1.8fr_1.8fr_auto_auto_1.2fr_1fr_1.2fr_min-content_1.5fr_64px]'}`}>

          {/* Columna ID (Ligeros) */}
          <div className="text-center">
            <div className={`${typeConfig.idBadge} h-7 flex items-center justify-center rounded-lg font-black text-[11px] shadow-sm`}>
              {unit.id}
            </div>
          </div>

          {/* Columna Personal Principal y Copiloto */}
          <div className="border-r border-slate-100 pr-2 min-w-0">
            <label className={labelStyle}>{isSereno ? 'Sereno' : isMoto ? 'Motorizado' : 'Chofer'}</label>
            <div className={infoValueStyle}>{unit.personnel1 || '--'}</div>
            {hasPersonnel2 && unit.personnel2 && (
              <div className="flex items-center gap-1.5 mt-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Cop.</label>
                <div className="text-[10px] font-bold text-slate-500 truncate uppercase leading-none">{unit.personnel2}</div>
              </div>
            )}
          </div>

          {/* Columna Logística Radio/Indicativo/Cuadrante */}
          <div className="flex gap-4 border-r border-slate-100 px-2 min-w-0">
            <div className="flex flex-col flex-1 text-center">
              <label className={labelStyle}>Radio</label>
              <div className={`${infoValueStyle} text-slate-800`}>
                {unit.radio || ''}
              </div>
            </div>
            {unit.indicative && (
              <div className="flex flex-col flex-1 text-center">
                <label className={labelStyle}>Indicativo</label>
                <div className={infoValueStyle}>{unit.indicative}</div>
              </div>
            )}
            {!isRescate && (
              <div className="flex flex-col flex-1 text-center">
                <label className={labelStyle}>Cuadrante</label>
                <div className={infoValueStyle}>
                  {unit.quadrant || (mobileData?.find(m => m.id === unit.id)?.quadrant) || '--'}
                </div>
              </div>
            )}
          </div>

          {/* Columna Placa */}
          {hasPlate && (
            <div className="border-r border-slate-100 px-2 text-center whitespace-nowrap">
              <label className={labelStyle}>Placa</label>
              <div className="text-[10px] font-black text-slate-800 bg-slate-50 px-1 rounded inline-block uppercase border border-slate-100">
                {unit.plate || (mobileData?.find(m => m.id === unit.id)?.plate) || '--'}
              </div>
            </div>
          )}

          {/* Columna Estado */}
          <div className="border-r border-slate-100 px-2 text-center whitespace-nowrap">
            <label className={labelStyle}>Estado</label>
            <span className={`px-1.5 rounded text-[10px] font-black border uppercase inline-block whitespace-nowrap ${badgeColors[unit.status]}`}>
              {unit.status}
            </span>
          </div>

          {!isSereno && (
            <>
              {/* Columna KM Centrada */}
              <div className="border-r border-slate-100 px-2 text-center">
                <label className={labelStyle}>KM (Inicio/Fin/Recorrido)</label>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                  <span className="text-slate-400">{unit.km.split('/')[0] || '0'}</span>
                  <span className="text-slate-200">/</span>
                  <span className="text-slate-400">{unit.km.split('/')[1] || '0'}</span>
                  <span className="text-slate-200">/</span>
                  <span className="text-slate-900 font-black">{unit.km.split('/')[2] || '0'}</span>
                </div>
              </div>

              {/* Columna Horario */}
              <div className="border-r border-slate-100 px-2 text-center">
                <label className={labelStyle}>Horario</label>
                <div className="text-[10px] font-bold text-slate-600">{unit.hours || '--:--'}</div>
              </div>

              {/* Columna Combustible Centrada con Recarga integrada */}
              <div className="border-r border-slate-100 px-2 text-center">
                <label className={labelStyle}>Combustible</label>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span>{unit.fuel.split('/')[0] || '--'}</span>
                    {hasKmRecarga && unit.km.split('/')[3] && unit.km.split('/')[3].trim() !== '0' && (
                      <span className="text-amber-600 text-[10px] font-black" title="Recarga">(R:{unit.km.split('/')[3].trim()})</span>
                    )}
                  </div>
                  <span className="text-slate-200">|</span>
                  <span className={`${unit.expense !== 'S/ 0.00' ? 'text-green-600' : 'text-slate-400'}`}>{unit.expense}</span>
                </div>
              </div>
            </>
          )}

          {/* Columna Partes con Color Ámbar Suave */}
          <div className="border-r border-slate-100 px-2 text-center">
            <label className={labelStyle}>Partes</label>
            <div className="w-5 h-5 mx-auto flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-black shadow-sm">
              {unit.parts}
            </div>
          </div>

          {/* Columna Motivo */}
          <div className="px-2 min-w-0">
            <label className={labelStyle}>Motivo</label>
            <div className="text-[10px] font-black text-slate-500 truncate uppercase">{unit.reason || '--'}</div>
          </div>

          {/* Columna Acciones */}
          <div className="text-right flex justify-end gap-1">
            <button onClick={onEdit} title="Editar" className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2 rounded-lg transition-all"><span className="material-symbols-outlined text-[16px] mt-1">edit</span></button>
            <button onClick={() => setShowDeleteModal(true)} title="Eliminar" className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-2 rounded-lg transition-all"><span className="material-symbols-outlined text-[16px] mt-1">delete</span></button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UnitCard;