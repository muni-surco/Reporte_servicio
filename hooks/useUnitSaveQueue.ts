import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AppSettings, UnitData } from '../types';

declare const google: any;

type SaveStatus = 'saving' | 'saved' | 'error';

interface UseUnitSaveQueueOptions {
  date: string;
  settings: AppSettings;
  setUnits: Dispatch<SetStateAction<UnitData[]>>;
  setEditingId: Dispatch<SetStateAction<string | null>>;
}

export const useUnitSaveQueue = ({ date, settings, setUnits, setEditingId }: UseUnitSaveQueueOptions) => {
  const saveQueueRef = useRef<Array<{ unit: UnitData }>>([]);
  const isSavingRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const processQueue = () => {
    if (isSavingRef.current || saveQueueRef.current.length === 0) return;
    isSavingRef.current = true;

    const item = saveQueueRef.current.shift()!;
    const unitKey = item.unit.unit_id || item.unit.tempId || item.unit.id || 'unknown';
    setSaveErrors(prev => {
      if (!(unitKey in prev)) return prev;
      const next = { ...prev };
      delete next[unitKey];
      return next;
    });

    const unitPayload = JSON.parse(JSON.stringify({
      ...item.unit,
      fuel2: String(item.unit.fuel2 || ''),
      expense2: String(item.unit.expense2 || '')
    }));

    const finish = () => {
      isSavingRef.current = false;
      processQueue();
    };

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean; unit_id?: string; fuel2?: string; expense2?: string; error?: string }) => {
          if (res.success) {
            const newId = res.unit_id;
            setSaveErrors(prev => {
              const next = { ...prev };
              delete next[unitKey];
              if (newId) delete next[newId];
              return next;
            });

            if (newId && newId !== item.unit.unit_id) {
              setUnits(prev => prev.map(unit => {
                const currentKey = unit.unit_id || unit.tempId || unit.id;
                return currentKey === unitKey ? { ...unit, unit_id: newId } : unit;
              }));
              setSaveStatus(prev => ({ ...prev, [unitKey]: 'saved', [newId]: 'saved' }));
              setTimeout(() => setSaveStatus(prev => {
                const next = { ...prev };
                delete next[unitKey];
                delete next[newId];
                return next;
              }), 2500);
            } else {
              setSaveStatus(prev => ({ ...prev, [unitKey]: 'saved' }));
              setTimeout(() => setSaveStatus(prev => {
                const next = { ...prev };
                delete next[unitKey];
                return next;
              }), 2500);
            }

            const savedFuel2 = res.fuel2 !== undefined ? res.fuel2 : item.unit.fuel2;
            const savedExpense2 = res.expense2 !== undefined ? res.expense2 : item.unit.expense2;
            setUnits(prev => prev.map(unit => {
              const currentKey = unit.unit_id || unit.tempId || unit.id;
              const savedKey = newId || unitKey;
              if (currentKey === unitKey || currentKey === savedKey) {
                return {
                  ...unit,
                  ...item.unit,
                  unit_id: newId || unit.unit_id,
                  kmStart: item.unit.kmStart || '',
                  fuel2: savedFuel2 || '',
                  expense2: savedExpense2 || ''
                };
              }
              return unit;
            }));
          } else {
            setSaveStatus(prev => ({ ...prev, [unitKey]: 'error' }));
            const error = String(res.error || 'No se pudo guardar la unidad.');
            if (error.includes('DUPLICATE_PERSONNEL')) alert(error.replace('DUPLICATE_PERSONNEL: ', ''));
            if (error.includes('DUPLICATE_RADIO')) {
              setSaveErrors(prev => ({ ...prev, [unitKey]: error.replace('DUPLICATE_RADIO: ', '') }));
              setEditingId(unitKey);
            }
          }
          finish();
        })
        .withFailureHandler((err: any) => {
          console.error('[updateUnit] Error al guardar unidad', err);
          setSaveStatus(prev => ({ ...prev, [unitKey]: 'error' }));
          finish();
        })
        .updateUnit(date, settings.turno, settings, unitPayload);
      return;
    }

    finish();
  };

  const enqueueSave = (unit: UnitData) => {
    const unitKey = unit.unit_id || unit.tempId || unit.id || 'unknown';
    saveQueueRef.current = saveQueueRef.current.filter(item => {
      const queuedKey = item.unit.unit_id || item.unit.tempId || item.unit.id;
      return queuedKey !== unitKey;
    });
    saveQueueRef.current.push({ unit });
    setSaveStatus(prev => ({ ...prev, [unitKey]: 'saving' }));
    if (!isSavingRef.current) processQueue();
  };

  const clearSaveError = (unitId: string) => {
    setSaveErrors(prev => {
      if (!(unitId in prev)) return prev;
      const next = { ...prev };
      delete next[unitId];
      return next;
    });
  };

  return { clearSaveError, enqueueSave, saveErrors, saveStatus };
};
