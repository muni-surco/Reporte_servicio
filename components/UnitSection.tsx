import React from 'react';
import UnitCard from './UnitCard';
import { UnitData } from '../types';

interface UnitSectionProps {
  title: string;
  type: 'CHOFER' | 'MOTO' | 'SERENO';
  icon: string;
  badge: string;
  partesTotal: number;
  units: UnitData[];
  allUnits: UnitData[];
  onEdit: (id: string) => void;
  onSave: (unit: UnitData) => void;
  onCancel: () => void;
  onAdd: (type: 'CHOFER' | 'MOTO' | 'SERENO') => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  mobileData?: { id: string; plate: string; }[]; // Original type
  statusOptions?: string[];
  indicativeOptions?: string[];
  personnelOptions?: string[];
  quadrantOptions?: string[];
}

const UnitSection: React.FC<UnitSectionProps> = ({
  title,
  type,
  icon,
  badge,
  partesTotal,
  units,
  allUnits,
  onEdit,
  onSave,
  onCancel,
  onAdd,
  onDelete,
  editingId,
  mobileData,
  statusOptions,
  indicativeOptions,
  personnelOptions,
  quadrantOptions
}) => {
  // Configuración de colores claros según el tipo (Actualizado MOTO a Violeta)
  const colorConfig = {
    CHOFER: {
      bgHeader: 'bg-blue-50/80',
      borderHeader: 'border-blue-100',
      textAccent: 'text-blue-700',
      badgeBg: 'bg-blue-600'
    },
    MOTO: {
      bgHeader: 'bg-violet-50/80',
      borderHeader: 'border-violet-100',
      textAccent: 'text-violet-700',
      badgeBg: 'bg-violet-600'
    },
    SERENO: {
      bgHeader: 'bg-teal-50/80',
      borderHeader: 'border-teal-100',
      textAccent: 'text-teal-700',
      badgeBg: 'bg-teal-600'
    }
  }[type];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-5">
      <div className={`${colorConfig.bgHeader} px-4 py-2.5 border-b ${colorConfig.borderHeader} flex items-center justify-between rounded-t-xl`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`material-symbols-outlined ${colorConfig.textAccent} text-[20px]`}>{icon}</span>
            <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-tighter">
              {title} <span className={`${colorConfig.badgeBg} text-white px-1.5 rounded text-[10px] ml-1 shadow-sm`}>{badge}</span>
            </h2>
          </div>
          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm">
            Acumulado Partes: {partesTotal}
          </span>
        </div>
        <button
          onClick={() => onAdd(type)}
          className={`${colorConfig.textAccent} flex items-center gap-1 text-[12px] font-black hover:opacity-70 group transition-all`}
        >
          <lord-icon
            src="https://cdn.lordicon.com/zrkkrrpl.json"
            trigger="hover"
            colors={`primary:${colorConfig.textAccent === 'text-blue-700' ? '#1d4ed8' : colorConfig.textAccent === 'text-violet-700' ? '#7c3aed' : '#0f766e'}`}
            style={{ width: '20px', height: '20px' }}>
          </lord-icon>
          REGISTRAR
        </button>
      </div>

      <div className="p-3 bg-slate-50/30">
        {units.length === 0 ? (
          <div className="text-center py-8 text-slate-300 text-[10px] italic font-black uppercase tracking-widest">No hay registros en esta sección</div>
        ) : (
          units.map((unit, index) => (
            <UnitCard
              key={unit.id || `new-${index}`}
              unit={unit}
              allUnits={allUnits}
              isEditing={editingId !== null && (editingId === unit.id || (unit.id === '' && editingId.startsWith('NEW-')))}
              onEdit={() => onEdit(unit.id)}
              onSave={onSave}
              onCancel={() => onCancel()}
              onDelete={() => onDelete(unit.id)}
              mobileData={mobileData}
              statusOptions={statusOptions}
              indicativeOptions={indicativeOptions}
              personnelOptions={personnelOptions}
              quadrantOptions={quadrantOptions}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default UnitSection;