import React, { useState, useEffect, useRef, useMemo } from 'react';
// Eliminados imports de jspdf y autotable para usar CDN

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import ReportGeneratorView from './components/ReportGeneratorView';
import { generateMotoReport, generateVehicleReport, generatePersonnelAbsenceReport, generateObservationsReport, generateAllRecordsReport } from './utils/reportGenerator';
import PersonnelView from './components/PersonnelView';
import StatisticsView from './components/StatisticsView';
import RetenManagementView from './components/RetenManagementView';
import VehicleSearchView from './components/VehicleSearchView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode, MobileReference, PersonnelData, SECTORS } from './types';
import { Users, LayoutDashboard, FileText } from 'lucide-react';

declare const google: any;

const getAutoTurno = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes >= 390 && totalMinutes < 870) return 'MAÑANA';
  if (totalMinutes >= 870 && totalMinutes < 1350) return 'TARDE';
  return 'NOCHE';
};

const generateUUID = () => {
  return 'UID-' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

const App: React.FC = () => {
  const [units, setUnits] = useState<UnitData[]>([]);
  const [currentSector, setCurrentSector] = useState<Sector>('SECTOR 1A');
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [settings, setSettings] = useState<AppSettings>({
    nombrePuesto: 'SECTOR 1A',
    operador: '',
    supervisor: '',
    permanencia: '',
    turno: getAutoTurno(),
    ipServidor: '10.20.0.1',
    version: 'v2.5.0-PRO'
  });
  const [mobileData, setMobileData] = useState<MobileReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastSavedRef = useRef<string>('');

  const [sectorSettingsMap, setSectorSettingsMap] = useState<Record<string, AppSettings>>({});

  const [indicativeOptions, setIndicativeOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<string[]>([]);
  const [operatorOptions, setOperatorOptions] = useState<string[]>([]);
  const [quadrantOptions, setQuadrantOptions] = useState<string[]>([]);
  const [motivoTallerOptions, setMotivoTallerOptions] = useState<string[]>([]);
  const [radioOptions, setRadioOptions] = useState<string[]>([]);
  const [personnelList, setPersonnelList] = useState<PersonnelData[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [isGeneratingStructuredReport, setIsGeneratingStructuredReport] = useState(false);

  const isReadOnly = (() => {
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const currentShift = getAutoTurno();

    let activeShiftDate = today;
    if (currentShift === 'NOCHE' && totalMinutes < 390) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      activeShiftDate = d.toLocaleDateString('en-CA');
    }

    if (selectedDate !== activeShiftDate) return true;
    return settings.turno !== currentShift;
  })();

  useEffect(() => {
    loadData(selectedDate, settings.turno, currentView);
  }, [selectedDate, settings.turno, currentSector, mobileData.length, currentView]);

  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { mobiles: MobileReference[], indicatives: string[], statuses: string[], personnel?: string[], operators?: string[], quadrants?: string[], radios?: string[], motivoTallerOptions?: string[] }) => {
          setMobileData(data.mobiles);
          setIndicativeOptions(data.indicatives);
          setStatusOptions(data.statuses);
          if (data.personnel) setPersonnelOptions(data.personnel);
          if (data.operators) setOperatorOptions(data.operators);
          if (data.quadrants) setQuadrantOptions(data.quadrants);
          if (data.motivoTallerOptions) setMotivoTallerOptions(data.motivoTallerOptions);
          if (data.radios) setRadioOptions(data.radios);
          // Cargar lista de personal para regimen laboral
          google.script.run
            .withSuccessHandler((personnel: PersonnelData[]) => {
              setPersonnelList(personnel);
            })
            .withFailureHandler(() => {})
            .getPersonnelList();
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to get mobile data', err);
          setMobileData([]);
        })
        .getMobileData();
    } else {
      console.log('MOCK: No GAS environment, setting empty mobile data');
      setMobileData([]);
      setStatusOptions(Object.values(UnitStatus));
    }
  }, []);
  // Cargar personal automáticamente cuando se entra a la vista de PERSONAL
  useEffect(() => {
    if (currentView === 'PERSONNEL' && personnelList.length === 0) {
      loadPersonnel();
    }
  }, [currentView]);

  const loadPersonnel = () => {
    setLoadingPersonnel(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: PersonnelData[]) => {
          setPersonnelList(data);
          setLoadingPersonnel(false);
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to get personnel list', err);
          setLoadingPersonnel(false);
        })
        .getPersonnelList();
    } else {
      console.log('MOCK: No GAS environment, setting empty personnel list');
      setLoadingPersonnel(false);
    }
  };

  const loadData = (dateStr: string, shift: string, view?: string) => {
    setLoading(true);
    const needsFullData = view && view !== 'DASHBOARD';
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      const successHandler = (data: { settings: AppSettings, allSectorSettings?: Record<string, AppSettings>, units: UnitData[] } | null) => {
          // Guard: GAS may return null if the payload is too large or an error occurs server-side
          if (!data) {
            console.warn('getShiftData/getSectorData returned null — no data for this date/shift or a server error occurred.');
            setUnits([]);
            setLoading(false);
            return;
          }
          // 1. Map and clean incoming units
          const rawIncomingUnits: UnitData[] = (data.units || []).map((u, idx) => ({
            ...u,
            id: String(u.id || '').trim(),
            unit_id: u.unit_id || `LEGACY-${idx}`, // Fallback for old records
            sector: (u.sector || '').trim().toUpperCase() === '' ? 'SECTOR 1A' : u.sector,
            type: u.type as any,
            personnel1: String(u.personnel1 || ''),
            personnel2: String(u.personnel2 || ''),
            plate: String(u.plate || ''),
            indicative: String(u.indicative || ''),
            radio: String(u.radio || ''),
            status: (u.status || UnitStatus.PATRULLANDO) as any,
            reason: String(u.reason || ''),
            km: `${String(u.kmStart || '0')} / ${String(u.kmEnd || '0')} / ${String(u.totalKm || '0')} / ${String(u.kmRecarga || '0')}`,
            kmStart: String(u.kmStart || '0'),
            kmEnd: String(u.kmEnd || '0'),
            totalKm: String(u.totalKm || '0'),
            kmRecarga: String(u.kmRecarga || '0'),
            hours: String(u.hours || ''),
            fuel: String(u.fuel || '-- / --'),
            expense: String(u.expense || 'S/ 0.00'),
            quadrant: String(u.quadrant || ''),
            mechanics: String(u.mechanics || ''),
            model: String(u.model || '')
          }));

          // 2. Deduplicate by unit_id (keep last)
          const deduplicatedMap = new Map<string, UnitData>();
          rawIncomingUnits.forEach(u => {
            if (u.unit_id) deduplicatedMap.set(u.unit_id, u);
          });
          const incomingUnits = Array.from(deduplicatedMap.values());

          // 3. Granular Deduplication for ALL units (by display ID to hide past duplicates within same sector)
          const finalUnitsMap = new Map<string, UnitData>();
          incomingUnits.forEach(u => {
            const displayId = (u.id || '').toUpperCase();
            const sectorKey = (u.sector || '').trim().toUpperCase();
            const uniqueKey = `${sectorKey}_${displayId}`; // Ensure separation by sector
            
            if (displayId && !displayId.startsWith('NEW-')) {
               // If multiple rows exist for the same vehicle ID, prefer the one with more data or the last one
               const existing = finalUnitsMap.get(uniqueKey);
               if (!existing || (u.personnel1 && !existing.personnel1)) {
                 finalUnitsMap.set(uniqueKey, u);
               }
            } else {
              // Units without ID or new units are kept by their unit_id
              finalUnitsMap.set(u.unit_id || `TEMP-${Math.random()}`, u);
            }
          });

          // 4. Inject Missing Defaults (Only for current sector to keep dashboard populated)
          const currentSectorNormalized = currentSector.trim().toUpperCase();
          const defaults = mobileData.filter(m => (m.sector || '').trim().toUpperCase() === currentSectorNormalized);
          defaults.forEach(d => {
            const displayId = d.id.toUpperCase();
            const uniqueKey = `${currentSectorNormalized}_${displayId}`;
            if (!finalUnitsMap.has(uniqueKey)) {
              finalUnitsMap.set(uniqueKey, {
                id: d.id,
                unit_id: `DEF-${currentSectorNormalized.replace(/\s+/g, '')}-${d.id}`,
                type: d.type as any,
                sector: currentSector,
                plate: d.plate,
                quadrant: d.quadrant,
                status: UnitStatus.PATRULLANDO,
                kmStart: '0',
                kmEnd: '0',
                totalKm: '0',
                kmRecarga: '0',
                fuel: '-- / --',
                expense: 'S/ 0.00',
                personnel1: '',
                personnel2: '',
                indicative: '',
                radio: d.radio || '',
                reason: '',
                mechanics: '',
                hours: '--:-- - --:--',
                model: d.model || ''
              });
            }
          });

          const allUnitsToUse = Array.from(finalUnitsMap.values());
          setUnits(allUnitsToUse);

          if (data.allSectorSettings) {
            setSectorSettingsMap(data.allSectorSettings);
          }

          const finalSettings = { ...settings, ...data.settings, turno: shift };
          setSettings(finalSettings);
          setLoading(false);

          // Initialize lastSavedRef with the same structure used in persistData to prevent immediate redundant save
          const normalizedUnits = allUnitsToUse.filter(u => {
            if (u.unit_id && u.unit_id.trim() !== '') return true;
            if (u.id && !String(u.id).startsWith('NEW-')) return true;
            if (u.tempId && u.tempId.startsWith('NEW-')) {
              return (u.personnel1 && u.personnel1.trim() !== '') || (u.id && u.id.trim() !== '');
            }
            return true;
          });
          
          lastSavedRef.current = JSON.stringify({ 
            settings: finalSettings, 
            units: normalizedUnits 
          });
        };

        const runner = google.script.run.withSuccessHandler(successHandler).withFailureHandler((err: any) => {
          console.error('Failed to get data', err);
          setUnits([]);
          setLoading(false);
        });

        if (needsFullData) {
          runner.getShiftData(dateStr, shift, currentSector);
        } else {
          runner.getSectorData(dateStr, shift, currentSector);
        }
    } else {
      setTimeout(() => {
        setUnits([]);
        setLoading(false);
      }, 500);
    }
  };

  const persistData = (newSettings: AppSettings, newUnits: UnitData[], retryCount = 0) => {
    // Filtrar solo unidades del sector actual (reduce payload y tiempo de proceso)
    const sectorUnits = newUnits.filter(u => !u.sector || u.sector === currentSector);
    const validUnits = sectorUnits.filter(u => {
      // Si ya tiene un unit_id del servidor, es un registro existente que debemos mantener
      if (u.unit_id && u.unit_id !== 'undefined' && u.unit_id.trim() !== '') return true;
      
      // Si es una unidad cargada (no NEW-), la mantenemos para preservar la fila
      if (u.id && !String(u.id).startsWith('NEW-')) return true;
      
      // Si es un registro nuevo (NEW-), solo lo guardamos si tiene contenido real
      if (u.tempId && u.tempId.startsWith('NEW-')) {
        return (u.personnel1 && u.personnel1.trim() !== '') || (u.id && u.id.trim() !== '');
      }

      return true;
    });
    const dataObj = { settings: newSettings, units: validUnits };
    // Normalize data for comparison (remove transient fields if necessary)
    const dataStr = JSON.stringify(dataObj);
    
    if (dataStr === lastSavedRef.current) {
      console.log('Skipping persistData — no changes detected.');
      return;
    }

    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, error?: string, retry?: boolean }) => {
          if (res.success) {
            setSaving(false);
            lastSavedRef.current = dataStr;
            setSectorSettingsMap(prev => ({
              ...prev,
              [newSettings.nombrePuesto || 'SECTOR 1A']: newSettings
            }));
          } else if (res.retry && retryCount < 5) {
            // Retry with exponential backoff: 1000ms, 2000ms, 4000ms, 8000ms, 16000ms
            const delay = 1000 * Math.pow(2, retryCount);
            console.warn(`Lock timeout, retrying in ${delay}ms (attempt ${retryCount + 1}/5)`);
            setTimeout(() => {
              persistData(newSettings, newUnits, retryCount + 1);
            }, delay);
          } else {
            setSaving(false);
            console.error('GAS Save Error:', res.error);
            alert('Error al guardar: ' + res.error);
          }
        })
        .saveShiftData(selectedDate, newSettings.turno, newSettings, validUnits);
    } else {
      setTimeout(() => {
        setSaving(false);
        lastSavedRef.current = dataStr;
      }, 300);
    }
  };

  const handleSectorChange = (sector: Sector) => {
    if (!isReadOnly) {
      persistData(settings, units);
    }
    
    setCurrentSector(sector);
    const specificSettings = sectorSettingsMap[sector];
    if (specificSettings) {
      setSettings(prev => ({ ...specificSettings, turno: prev.turno }));
    } else {
      setSettings(prev => ({ ...prev, nombrePuesto: sector, operador: '', supervisor: '', permanencia: '' }));
    }
  };

  // Save queue (non-blocking, sequential)
  const saveQueueRef = useRef<Array<{ unit: UnitData }>>([]);
  const isSavingRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  const processQueue = () => {
    if (isSavingRef.current || saveQueueRef.current.length === 0) return;
    isSavingRef.current = true;

    const item = saveQueueRef.current.shift()!;
    const unitKey = item.unit.unit_id || item.unit.tempId || item.unit.id || 'unknown';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, unit_id?: string, error?: string }) => {
          if (res.success) {
            if (res.unit_id && res.unit_id !== item.unit.unit_id) {
              setUnits(prev => prev.map(u => {
                const matchKey = u.unit_id || u.tempId || u.id;
                const itemKey = item.unit.unit_id || item.unit.tempId || item.unit.id;
                if (matchKey === itemKey) return { ...u, unit_id: res.unit_id };
                return u;
              }));
            }
            setSaveStatus(prev => ({ ...prev, [unitKey]: 'saved' }));
            setTimeout(() => setSaveStatus(prev => {
              const next = { ...prev };
              delete next[unitKey];
              return next;
            }), 2000);
          } else {
            setSaveStatus(prev => ({ ...prev, [unitKey]: 'error' }));
          }
          isSavingRef.current = false;
          processQueue();
        })
        .withFailureHandler(() => {
          setSaveStatus(prev => ({ ...prev, [unitKey]: 'error' }));
          isSavingRef.current = false;
          processQueue();
        })
        .updateUnit(selectedDate, settings.turno, settings, item.unit);
    } else {
      isSavingRef.current = false;
      processQueue();
    }
  };

  const enqueueSave = (unit: UnitData) => {
    const unitKey = unit.unit_id || unit.tempId || unit.id || 'unknown';
    // Remove any pending saves for the same unit
    saveQueueRef.current = saveQueueRef.current.filter(q => {
      const qKey = q.unit.unit_id || q.unit.tempId || q.unit.id;
      return qKey !== unitKey;
    });
    saveQueueRef.current.push({ unit });
    setSaveStatus(prev => ({ ...prev, [unitKey]: 'saving' }));
    if (!isSavingRef.current) processQueue();
  };

  const handleSave = (updatedUnit: UnitData) => {
    if (isReadOnly) return;
    const unitWithSector = { ...updatedUnit, sector: updatedUnit.sector || currentSector };
    // Identificar la unidad que se estaba editando
    let newUnits = units.map(u => {
      if ((u.unit_id && u.unit_id === editingId) || (u.tempId && u.tempId === editingId) || (u.id && u.id === editingId)) {
        const savedUnit = { ...unitWithSector };
        if (!savedUnit.id || String(savedUnit.id).trim() === '') {
          savedUnit.tempId = u.tempId || `TEMP-${Date.now()}`;
        }
        return savedUnit;
      }
      return u;
    });
    setUnits(newUnits);
    setEditingId(null);
    // Non-blocking save via queue (does NOT freeze the UI)
    enqueueSave(unitWithSector);
  };

  const currentSectorUnits = units
    .filter(u => {
      const uSector = (u.sector || '').trim().toUpperCase();
      const currSector = currentSector.trim().toUpperCase();
      return uSector === currSector;
    })
    .sort((a, b) => {
      const specialStatuses = [
        'CAMBIO DE TURNO',
        'DESCANSO COMPENSATORIO',
        'DESCANSO MEDICO',
        'DESCANSO MÉDICO',
        'DESCANSO FISICO',
        'FALTO',
        'ONOMASTICO',
        'ONOMÁSTICO',
        'PERMISO',
        UnitStatus.MANTENIMIENTO,
        UnitStatus.CON_DESPERFECTOS,
        UnitStatus.SIN_CONDUCTOR,
        UnitStatus.SIN_VEHICULO,
        UnitStatus.SINIESTRO
      ];

      // 1. Prioritize units being NEWLY created (unsaved and currently editing)
      const isNewA = !!(a.tempId?.startsWith('NEW-') && editingId === a.tempId);
      const isNewB = !!(b.tempId?.startsWith('NEW-') && editingId === b.tempId);
      if (isNewA && !isNewB) return -1;
      if (!isNewA && isNewB) return 1;

      // 2. Special statuses go to the very bottom
      const isASpecial = specialStatuses.includes(a.status?.toUpperCase());
      const isBSpecial = specialStatuses.includes(b.status?.toUpperCase());
      if (isASpecial && !isBSpecial) return 1;
      if (!isASpecial && isBSpecial) return -1;

      // 3. For the rest, sort by ID to keep them organized
      const idA = String(a.id || '').trim();
      const idB = String(b.id || '').trim();
      
      if (!idA && idB) return 1;
      if (idA && !idB) return -1;
      
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

  const allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }> = {};
  SECTORS.forEach(s => {
    const sectorSpecificSettings = sectorSettingsMap[s] || {
      ...settings,
      nombrePuesto: s,
      operador: '',
      supervisor: '',
      permanencia: ''
    };
    let sectorUnits = units.filter(u => u.sector === s);
    const defaults = mobileData.filter(m => m.sector === s);
    
    if (sectorUnits.length === 0) {
      sectorUnits = defaults.map(d => ({
        id: d.id,
        type: d.type as any,
        sector: s,
        plate: d.plate,
        quadrant: d.quadrant,
        status: UnitStatus.PATRULLANDO,
        kmStart: '0',
        kmEnd: '0',
        totalKm: '0',
        kmRecarga: '0',
        fuel: '-- / --',
        expense: 'S/ 0.00',
        personnel1: '',
        personnel2: '',
        indicative: '',
        radio: d.radio || '',
        reason: '',
        mechanics: '',
        hours: '--:-- - --:--'
      }));
    } else {
      const typesToLoad = ['CHOFER', 'MOTO', 'SERENO'] as const;
      typesToLoad.forEach(type => {
        const hasType = sectorUnits.some(u => u.type === type);
        if (!hasType) {
          const typeDefaults = defaults
            .filter(d => d.type === type)
            .map(d => ({
              id: d.id,
              type: d.type as any,
              sector: s,
              plate: d.plate,
              quadrant: d.quadrant,
              status: UnitStatus.PATRULLANDO,
              kmStart: '0',
              kmEnd: '0',
              totalKm: '0',
              kmRecarga: '0',
              fuel: '-- / --',
              expense: 'S/ 0.00',
              personnel1: '',
              personnel2: '',
              indicative: '',
              radio: d.radio || '',
              reason: '',
              mechanics: '',
              hours: '--:-- - --:--',
              unit_id: `DEF-${s.replace(/\s+/g, '')}-${d.id}`
            }));
          sectorUnits = [...sectorUnits, ...typeDefaults];
        }
      });
    }
    allSectorsData[s] = {
      units: sectorUnits,
      settings: sectorSpecificSettings
    };
  });

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Removed immediate persistData(newSettings, units) to avoid multiple server calls on focus loss
    // Persistence now happens on Global Save or Sector Change
  };

  const handleGlobalSave = (currentSettings?: AppSettings) => {
    if (isReadOnly) return;
    const settingsToSave = currentSettings || settings;
    persistData(settingsToSave, units);
  };

  const handleAddUnit = (type: 'CHOFER' | 'MOTO' | 'SERENO') => {
    if (isReadOnly) return;
    // Guard: si ya existe una card en blanco (NEW-) del mismo tipo sin ID ni personal, no crear otra
    const existingBlank = units.find(u =>
      u.type === type &&
      u.tempId?.startsWith('NEW-') &&
      (!u.id || String(u.id).trim() === '') &&
      (!u.personnel1 || String(u.personnel1).trim() === '')
    );
    if (existingBlank) {
      // Solo activar edición sobre la card en blanco ya existente
      setEditingId(existingBlank.tempId || existingBlank.unit_id || existingBlank.id);
      return;
    }

    const tempId = `NEW-${Date.now()}`;
    const newUnit: UnitData = {
      id: '',
      tempId: tempId,
      sector: currentSector,
      type,
      personnel1: '',
      personnel2: '',
      plate: '',
      indicative: '',
      radio: '',
      status: UnitStatus.PATRULLANDO,
      reason: '',
      km: '0 / 0 / 0',
      kmStart: '0',
      kmEnd: '0',
      totalKm: '0',
      kmRecarga: '0',
      hours: '',
      fuel: '-- / --',
      expense: 'S/ 0.00',
      quadrant: '',
      mechanics: '',
      unit_id: generateUUID()
    };
    // Prepend the new unit to the list so it appears at the top of its section
    setUnits(prev => [newUnit, ...prev]);
    setEditingId(tempId);
  };

  const handleEdit = (id: string) => {
    if (isReadOnly) return;
    setEditingId(id);
  };

  const handleCancel = () => {
    if (editingId && String(editingId).startsWith('NEW-')) {
      // Eliminar la unidad temporal si se cancela la creación
      setUnits(prev => prev.filter(u => u.tempId !== editingId));
    }
    setEditingId(null);
  };

  const handleGenerateReport = async (type: string, date: string, shift: string) => {
    setIsGeneratingStructuredReport(true);

    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      // Mock for local dev
      setTimeout(() => {
        setIsGeneratingStructuredReport(false);
        console.log(`MOCK: Generando reporte ${type} para ${date} / ${shift}`);
        if (type === 'motos') {
          generateMotoReport(units, sectorSettingsMap, date, shift, 'XTZ150', 'YAMAHA XTZ150');
        } else if (type === 'motos_honda') {
          generateMotoReport(units, sectorSettingsMap, date, shift, 'SAHARA XRE 300', 'HONDA SAHARA XRE 300');
        } else if (type === 'moviles') {
          generateVehicleReport(units, sectorSettingsMap, date, shift);
        } else if (type === 'asistencia_regimen') {
          generatePersonnelAbsenceReport(units, personnelList, date, shift);
        } else if (type === 'general') {
          generateAllRecordsReport(units, sectorSettingsMap, date, shift);
        }
      }, 1000);
      return;
    }

    google.script.run
      .withSuccessHandler((data: any) => {
        setIsGeneratingStructuredReport(false);
        if (type === 'motos') {
          generateMotoReport(data.units, data.allSectorSettings || {}, date, shift, 'XTZ150', 'YAMAHA XTZ150');
        } else if (type === 'motos_honda') {
          generateMotoReport(data.units, data.allSectorSettings || {}, date, shift, 'SAHARA XRE 300', 'HONDA SAHARA XRE 300');
        } else if (type === 'moviles') {
          generateVehicleReport(data.units, data.allSectorSettings || {}, date, shift);
        } else if (type === 'asistencia_regimen') {
          if (personnelList.length > 0) {
            generatePersonnelAbsenceReport(data.units, personnelList, date, shift);
          } else {
            setIsGeneratingStructuredReport(true);
            google.script.run
              .withSuccessHandler((loadedPersonnel: PersonnelData[]) => {
                setPersonnelList(loadedPersonnel);
                generatePersonnelAbsenceReport(data.units, loadedPersonnel, date, shift);
                setIsGeneratingStructuredReport(false);
              })
              .withFailureHandler((err: any) => {
                setIsGeneratingStructuredReport(false);
                alert('Error al cargar datos del personal: ' + err);
              })
              .getPersonnelList();
          }
        } else if (type === 'observaciones') {
          generateObservationsReport(data.units, date, shift);
        } else if (type === 'general') {
          generateAllRecordsReport(data.units, data.allSectorSettings || {}, date, shift);
        } else {
          alert(`El reporte de "${type}" se encuentra en desarrollo.`);
        }
      })
      .withFailureHandler((err: any) => {
        setIsGeneratingStructuredReport(false);
        alert('Error al obtener datos: ' + err);
      })
      .getShiftData(date, shift, 'SECTOR 1A'); // Passing a dummy sector is fine as it returns all units
  };

  const personnelStats = useMemo(() => {
    return {
      total: personnelList.length,
      activos: personnelList.filter(p => p.estado.toUpperCase() === 'ACTIVO').length,
      inactivos: personnelList.filter(p => ['CESADO', 'INACTIVO'].includes(p.estado.toUpperCase())).length,
    };
  }, [personnelList]);

  const personnelRegimenMap = useMemo(() => {
    const map: Record<string, string> = {};
    personnelList.forEach(p => {
      const key = p.apellidos_nombres.trim().toUpperCase();
      if (key && p.regimen_laboral) map[key] = p.regimen_laboral;
    });
    return map;
  }, [personnelList]);

  return (
    <div className="h-screen bg-[#f8fafc] relative">
      {loading && (
        <div className="absolute inset-0 z-[1050] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[14px] font-medium tracking-[0.2em] animate-pulse uppercase text-slate-600">Cargando Datos...</p>
        </div>
      )}
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="ml-[76px] flex flex-col h-screen">
        <Header
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onGlobalSave={handleGlobalSave}
          onGeneratePDF={() => setCurrentView('REPORTS')}
          onRefresh={currentView === 'PERSONNEL' ? loadPersonnel : () => loadData(selectedDate, settings.turno)}
          isSaving={saving}
          currentSector={currentSector}
          onSectorChange={handleSectorChange}
          currentView={currentView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          personnelOptions={personnelOptions}
          operatorOptions={operatorOptions}
          personnelStats={personnelStats}
          readOnly={isReadOnly}
        />

        <div className="flex-1 overflow-y-auto scroll-smooth p-4" id="report-content">
          {currentView === 'DASHBOARD' ? (
            <>
                <UnitSection
                  title="CHOFERES" type="CHOFER" icon="minor_crash"
                  badge={currentSectorUnits.filter(u => u.type === 'CHOFER').length.toString()}
                  units={currentSectorUnits.filter(u => u.type === 'CHOFER')}
                  allUnits={units}
                  editingId={editingId}
                  onEdit={handleEdit} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit}
                  mobileData={mobileData}
                  statusOptions={statusOptions}
                  indicativeOptions={indicativeOptions}
                  personnelOptions={personnelOptions}
                  quadrantOptions={quadrantOptions}
                  radioOptions={radioOptions}
                  currentDate={selectedDate}
                  currentShift={settings.turno}
                  isSaving={saving}
                  saveStatus={saveStatus}
                  readOnly={isReadOnly}
                  personnelRegimenMap={personnelRegimenMap}
                />
              {currentSector !== 'RESCATE' && (
                <>
                  <UnitSection
                    title="MOTORIZADOS" type="MOTO" icon="moped"
                    badge={currentSectorUnits.filter(u => u.type === 'MOTO').length.toString()}
                    units={currentSectorUnits.filter(u => u.type === 'MOTO')}
                    allUnits={units}
                    editingId={editingId}
                    onEdit={handleEdit} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit}
                    mobileData={mobileData}
                    statusOptions={statusOptions}
                    indicativeOptions={indicativeOptions}
                    personnelOptions={personnelOptions}
                    quadrantOptions={quadrantOptions}
                    radioOptions={radioOptions}
                    currentDate={selectedDate}
                    currentShift={settings.turno}
                    isSaving={saving}
                    readOnly={isReadOnly}
                    personnelRegimenMap={personnelRegimenMap}
                  />
                  <UnitSection
                    title="SERENOS" type="SERENO" icon="hail"
                    badge={currentSectorUnits.filter(u => u.type === 'SERENO').length.toString()}
                    units={currentSectorUnits.filter(u => u.type === 'SERENO')}
                    allUnits={units}
                    editingId={editingId}
                    onEdit={handleEdit} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit}
                    mobileData={mobileData}
                    statusOptions={statusOptions}
                    indicativeOptions={indicativeOptions}
                    personnelOptions={personnelOptions}
                    radioOptions={radioOptions}
                    currentDate={selectedDate}
                    currentShift={settings.turno}
                    isSaving={saving}
                    saveStatus={saveStatus}
                    readOnly={isReadOnly}
                    personnelRegimenMap={personnelRegimenMap}
                  />
                </>
              )}
            </>
          ) : currentView === 'VISUALIZATION' ? (
            <VisualizationView
              allSectorsData={allSectorsData}
              settings={settings}
              mobileData={mobileData}
            />
          ) : currentView === 'REPORTS' ? (
            <ReportGeneratorView
              selectedDate={selectedDate}
              selectedShift={settings.turno}
              onGenerateReport={handleGenerateReport}
              isGenerating={isGeneratingStructuredReport}
            />
          ) : currentView === 'PERSONNEL' ? (
            <PersonnelView
              data={personnelList}
              isLoading={loadingPersonnel}
              onRefresh={loadPersonnel}
            />
          ) : currentView === 'RETEN' ? (
            <RetenManagementView
              settings={settings}
              selectedDate={selectedDate}
              mobileData={mobileData}
              motivoTallerOptions={motivoTallerOptions}
            />
          ) : currentView === 'VEHICLE_SEARCH' ? (
            <VehicleSearchView />
          ) : (
            <StatisticsView units={units} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
