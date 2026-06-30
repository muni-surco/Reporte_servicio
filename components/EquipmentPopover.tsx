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
  codigoTaserOptions?: string[];
  codigoBodycamOptions?: string[];
}

const EquipmentPopover: React.FC<Props> = ({ fieldPrefix, personName, settings, onSave, onClose, anchorEl, codigoTaserOptions, codigoBodycamOptions }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelPrefix = fieldPrefix === 'supervisor' ? 'supervisor' : 'permanencia';

  const [supTaser, setSupTaser] = useState(settings[`${labelPrefix}Taser` as keyof AppSettings] as string || '');
  const [supBodycam, setSupBodycam] = useState(settings[`${labelPrefix}Bodycam` as keyof AppSettings] as string || '');
  const [supCodTaser, setSupCodTaser] = useState(settings[`${labelPrefix}CodigoTaser` as keyof AppSettings] as string || '');
  const [supCodBodycam, setSupCodBodycam] = useState(settings[`${labelPrefix}CodigoBodycam` as keyof AppSettings] as string || '');

  const [errors, setErrors] = useState<{ codigoTaser?: string; codigoBodycam?: string }>({});
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setSupTaser(settings[`${labelPrefix}Taser` as keyof AppSettings] as string || '');
    setSupBodycam(settings[`${labelPrefix}Bodycam` as keyof AppSettings] as string || '');
    setSupCodTaser(settings[`${labelPrefix}CodigoTaser` as keyof AppSettings] as string || '');
    setSupCodBodycam(settings[`${labelPrefix}CodigoBodycam` as keyof AppSettings] as string || '');
    setErrors({});
  }, [settings, labelPrefix]);

  useEffect(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, left: Math.max(8, rect.left - 100) });
    }
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const buildUpdated = (): AppSettings => ({
    ...settings,
    [`${labelPrefix}Taser`]: supTaser,
    [`${labelPrefix}Bodycam`]: supBodycam,
    [`${labelPrefix}CodigoTaser`]: supCodTaser,
    [`${labelPrefix}CodigoBodycam`]: supCodBodycam,
  });

  const handleSave = () => {
    const newErrors: { codigoTaser?: string; codigoBodycam?: string } = {};

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

  return (
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[340px]"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold text-[#002d5a] uppercase tracking-tight">EQUIPAMIENTO</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-[18px] leading-none">&times;</button>
      </div>
      <div className="text-[12px] text-slate-500 font-medium mb-3 truncate">{label}: <strong>{personName || 'Sin asignar'}</strong></div>

      <div className="space-y-3">
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
            <AutocompleteInput value={supCodTaser} onChange={(v) => { setSupCodTaser(v); setErrors(prev => ({ ...prev, codigoTaser: undefined })); }} placeholder="Código TASER..." suggestions={codigoTaserOptions || []} className="!h-[32px] !text-[13px]" error={!!errors.codigoTaser} />
          )}
          {errors.codigoTaser && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.codigoTaser}</span>}
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
            <AutocompleteInput value={supCodBodycam} onChange={(v) => { setSupCodBodycam(v); setErrors(prev => ({ ...prev, codigoBodycam: undefined })); }} placeholder="Código BODYCAM..." suggestions={codigoBodycamOptions || []} className="!h-[32px] !text-[13px]" error={!!errors.codigoBodycam} />
          )}
          {errors.codigoBodycam && <span className="text-[10px] text-red-500 font-medium mt-0.5 block">{errors.codigoBodycam}</span>}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-4 w-full bg-[#005ea5] text-white text-[12px] font-bold uppercase tracking-wider py-2 rounded-lg hover:bg-[#003D6B] transition-all"
      >
        GUARDAR
      </button>
    </div>
  );
};

export default EquipmentPopover;
