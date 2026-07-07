import React, { useEffect, useRef, useState } from 'react';
import { AppSettings } from '../types';
import AutocompleteInput from './AutocompleteInput';

interface Props {
  fieldPrefix: 'supervisor' | 'permanencia';
  personName: string;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  fieldEl: HTMLElement | null;
  codigoTaserOptions?: string[];
  codigoBodycamOptions?: string[];
  codigoTaserSuggestions?: string[];
  codigoBodycamSuggestions?: string[];
  radioOptions?: string[];
  personnelOptions?: string[];
  motivoFaltoOptions?: string[];
}

const STATUS_OPTIONS = ['Patrullando', 'Falto', 'Sin Supervision'];
const ABSENCE_STATUSES = ['Falto', 'Sin Supervision'];

const EquipmentPopover: React.FC<Props> = ({ fieldPrefix, personName, settings, onSave, onClose, anchorEl, fieldEl, codigoTaserOptions, codigoBodycamOptions, codigoTaserSuggestions, codigoBodycamSuggestions, radioOptions, personnelOptions, motivoFaltoOptions }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelPrefix = fieldPrefix === 'supervisor' ? 'supervisor' : 'permanencia';

  const [supTaser, setSupTaser] = useState(settings[`${labelPrefix}Taser` as keyof AppSettings] as string || '');
  const [supBodycam, setSupBodycam] = useState(settings[`${labelPrefix}Bodycam` as keyof AppSettings] as string || '');
  const [supCodTaser, setSupCodTaser] = useState(settings[`${labelPrefix}CodigoTaser` as keyof AppSettings] as string || '');
  const [supCodBodycam, setSupCodBodycam] = useState(settings[`${labelPrefix}CodigoBodycam` as keyof AppSettings] as string || '');
  const [estado, setEstado] = useState(settings[`${labelPrefix}Estado` as keyof AppSettings] as string || 'Patrullando');
  const [radio, setRadio] = useState(settings[`${labelPrefix}Radio` as keyof AppSettings] as string || '');
  const [encargado, setEncargado] = useState(settings[`${labelPrefix}Encargado` as keyof AppSettings] as string || '');
  const [motivo, setMotivo] = useState(settings[`${labelPrefix}Motivo` as keyof AppSettings] as string || '');
  const [personValue, setPersonValue] = useState(settings[labelPrefix] || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [arrowLeft, setArrowLeft] = useState(40);
  const [closing, setClosing] = useState(false);

  const POPOVER_WIDTH = 360;
  const ARROW_SIZE = 8;

  useEffect(() => {
    setSupTaser(settings[`${labelPrefix}Taser` as keyof AppSettings] as string || '');
    setSupBodycam(settings[`${labelPrefix}Bodycam` as keyof AppSettings] as string || '');
    setSupCodTaser(settings[`${labelPrefix}CodigoTaser` as keyof AppSettings] as string || '');
    setSupCodBodycam(settings[`${labelPrefix}CodigoBodycam` as keyof AppSettings] as string || '');
    setEstado(settings[`${labelPrefix}Estado` as keyof AppSettings] as string || 'Patrullando');
    setRadio(settings[`${labelPrefix}Radio` as keyof AppSettings] as string || '');
    setEncargado(settings[`${labelPrefix}Encargado` as keyof AppSettings] as string || '');
    setMotivo(settings[`${labelPrefix}Motivo` as keyof AppSettings] as string || '');
    setPersonValue(settings[labelPrefix] || '');
    setErrors({});
  }, [settings, labelPrefix]);

  useEffect(() => {
    if (fieldEl) {
      const fieldRect = fieldEl.getBoundingClientRect();
      let left = fieldRect.left + 20;
      const maxLeft = window.innerWidth - POPOVER_WIDTH - 8;
      if (left > maxLeft) left = maxLeft;
      left = Math.max(8, left);
      setPosition({ top: fieldRect.bottom + 8, left });
      setArrowLeft(fieldRect.left + fieldRect.width / 2 - left);
    }
  }, [fieldEl]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  };

  const isAbsent = fieldPrefix === 'supervisor' && ABSENCE_STATUSES.includes(estado);

  const buildUpdated = (): AppSettings => ({
    ...settings,
    [fieldPrefix]: personValue,
    [`${labelPrefix}Taser`]: supTaser,
    [`${labelPrefix}Bodycam`]: supBodycam,
    [`${labelPrefix}CodigoTaser`]: supCodTaser,
    [`${labelPrefix}CodigoBodycam`]: supCodBodycam,
    [`${labelPrefix}Estado`]: estado,
    [`${labelPrefix}Motivo`]: motivo,
    [`${labelPrefix}Radio`]: radio,
    [`${labelPrefix}Encargado`]: encargado,
  });

  const handleSave = () => {
    const newErrors: Record<string, string> = {};

    if (estado !== 'Sin Supervision' && (!personValue || String(personValue).trim() === '')) {
      newErrors.personValue = 'Campo requerido';
    }

    if (!estado) {
      newErrors.estado = 'Campo requerido';
    }

    if (isAbsent) {
      if (!encargado || String(encargado).trim() === '') {
        newErrors.encargado = 'Campo requerido';
      } else if (personnelOptions && !personnelOptions.includes(encargado)) {
        newErrors.encargado = 'Personal inválido';
      }
    }

    if (supTaser === 'SI') {
      if (!supCodTaser || String(supCodTaser).trim() === '') {
        newErrors.codigoTaser = 'Campo requerido';
      } else if (codigoTaserOptions && !codigoTaserOptions.includes(supCodTaser)) {
        newErrors.codigoTaser = 'Código inválido';
      }
    }

    if (supBodycam === 'SI') {
      if (!supCodBodycam || String(supCodBodycam).trim() === '') {
        newErrors.codigoBodycam = 'Campo requerido';
      } else if (codigoBodycamOptions && !codigoBodycamOptions.includes(supCodBodycam)) {
        newErrors.codigoBodycam = 'Código inválido';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSave(buildUpdated());
  };

  const label = fieldPrefix === 'supervisor' ? 'Supervisor' : 'Jefe de Área';
  const labelStyle = "text-[11px] font-medium text-slate-400 uppercase tracking-tighter block mb-0.5 leading-none";
  const selectStyle = "w-full border border-slate-200 bg-slate-50 rounded px-2 py-1 text-[12px] h-[32px] focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm cursor-pointer";

  return (
    <>
      <style>{`@keyframes equip-fade-in{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}@keyframes equip-fade-out{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(0.95) translateY(-4px)}}`}</style>
      <div
        ref={popoverRef}
        className="fixed z-[99999] bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[360px]"
        style={{ top: position.top, left: position.left, animation: `${closing ? 'equip-fade-out' : 'equip-fade-in'} 150ms ease forwards` }}
      >
        {/* Arrow pointing to the edit icon */}
        <div className="absolute w-0 h-0 z-10" style={{ top: -ARROW_SIZE, left: arrowLeft, marginLeft: `-${ARROW_SIZE}px`, borderLeft: `${ARROW_SIZE}px solid transparent`, borderRight: `${ARROW_SIZE}px solid transparent`, borderBottom: `${ARROW_SIZE}px solid white` }} />
        <div className="absolute w-0 h-0 z-0" style={{ top: -ARROW_SIZE - 1, left: arrowLeft, marginLeft: `-${ARROW_SIZE + 1}px`, borderLeft: `${ARROW_SIZE + 1}px solid transparent`, borderRight: `${ARROW_SIZE + 1}px solid transparent`, borderBottom: `${ARROW_SIZE + 1}px solid #e2e8f0` }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold text-[#002d5a] uppercase tracking-tight">ASISTENCIA Y EQUIPAMIENTO</span>
        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-[18px] leading-none">&times;</button>
      </div>
      <div className="mb-3">
        <label className={labelStyle}>Nombre <span className="text-red-500">*</span></label>
        <AutocompleteInput value={personValue} onChange={(v) => { setPersonValue(v); setErrors(prev => ({ ...prev, personValue: '' })); }} placeholder="Buscar..." suggestions={personnelOptions || []} className="!h-[32px] !text-[12px]" error={!!errors.personValue} strict={true} />
        {errors.personValue && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.personValue}</span>}
      </div>

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ASISTENCIA</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className={labelStyle}>Estado <span className="text-red-500">*</span></label>
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setErrors(prev => ({ ...prev, estado: '' })); }} className={`${selectStyle} uppercase ${errors.estado ? 'border-red-500 ring-1 ring-red-200 bg-red-50' : ''}`}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          {errors.estado && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.estado}</span>}
        </div>
        {estado === 'Falto' && (
        <div>
          <label className={labelStyle}>Motivo Estado</label>
          {motivoFaltoOptions && motivoFaltoOptions.length > 0 ? (
            <select value={motivo} onChange={(e) => { setMotivo(e.target.value); }} className={`${selectStyle} ${errors.motivo ? 'border-red-500 ring-1 ring-red-200 bg-red-50' : ''}`}>
              <option value="">--</option>
              {motivoFaltoOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <AutocompleteInput value={motivo} onChange={(v) => { setMotivo(v); }} placeholder="Motivo..." suggestions={[]} className="!h-[32px] !text-[12px]" />
          )}
        </div>
        )}
      </div>

      {isAbsent && (
        <div className="mb-3">
          <label className={labelStyle}>Encargado <span className="text-red-500">*</span></label>
          <AutocompleteInput value={encargado} onChange={(v) => { setEncargado(v); setErrors(prev => ({ ...prev, encargado: '' })); }} placeholder="Nombre..." suggestions={personnelOptions || []} className="!h-[32px] !text-[12px]" error={!!errors.encargado} />
          {errors.encargado && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.encargado}</span>}
        </div>
      )}

      <div className="border-t border-slate-200 my-3"></div>

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">EQUIPAMIENTO</div>
      <div className="w-1/2 mb-3">
        <label className={labelStyle}>Radio</label>
        <AutocompleteInput value={radio} onChange={(v) => { setRadio(v); }} placeholder="20xxx" suggestions={radioOptions || []} className="!h-[32px] !text-[12px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>TASER</label>
          <div className="flex items-center h-[32px] gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={supTaser === 'SI'} onChange={() => setSupTaser(supTaser === 'SI' ? '' : 'SI')} />
              <div className="w-9 h-5 bg-[#D0D5E8] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005ea5]"></div>
            </label>
            <span className={`text-[11px] font-semibold ${supTaser === 'SI' ? 'text-[#005ea5]' : 'text-slate-400'}`}>{supTaser === 'SI' ? 'SI' : 'NO'}</span>
          </div>
          {supTaser === 'SI' && (
            <div className="mt-1">
              <label className={labelStyle}>Código TASER</label>
              <AutocompleteInput value={supCodTaser} onChange={(v) => { setSupCodTaser(v); setErrors(prev => ({ ...prev, codigoTaser: '' })); }} placeholder="Código..." suggestions={codigoTaserSuggestions || []} className="!h-[32px] !text-[12px]" error={!!errors.codigoTaser} />
              {errors.codigoTaser && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.codigoTaser}</span>}
            </div>
          )}
        </div>

        <div>
          <label className={labelStyle}>BODYCAM</label>
          <div className="flex items-center h-[32px] gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={supBodycam === 'SI'} onChange={() => setSupBodycam(supBodycam === 'SI' ? '' : 'SI')} />
              <div className="w-9 h-5 bg-[#D0D5E8] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005ea5]"></div>
            </label>
            <span className={`text-[11px] font-semibold ${supBodycam === 'SI' ? 'text-[#005ea5]' : 'text-slate-400'}`}>{supBodycam === 'SI' ? 'SI' : 'NO'}</span>
          </div>
          {supBodycam === 'SI' && (
            <div className="mt-1">
              <label className={labelStyle}>Código BODYCAM</label>
              <AutocompleteInput value={supCodBodycam} onChange={(v) => { setSupCodBodycam(v); setErrors(prev => ({ ...prev, codigoBodycam: '' })); }} placeholder="Código..." suggestions={codigoBodycamSuggestions || []} className="!h-[32px] !text-[12px]" error={!!errors.codigoBodycam} />
              {errors.codigoBodycam && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.codigoBodycam}</span>}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-4 w-full bg-[#005ea5] text-white text-[12px] font-bold uppercase tracking-wider py-2 rounded-lg hover:bg-[#003D6B] transition-all"
      >
        GUARDAR
      </button>
      </div>
    </>
  );
};

export default EquipmentPopover;
