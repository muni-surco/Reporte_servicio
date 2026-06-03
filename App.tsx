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
import ConfirmModal from './components/ConfirmModal';

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

const generateUnitId = (type: string, id: string, sector: string, date: string, shift: string) => {
  const cleanId = String(id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanSector = String(sector || '').replace(/^SECTOR\s+/, '').replace(/\s+/g, '').trim().toUpperCase();
  const cleanDate = date.replace(/-/g, '');
  const cleanShift = shift.toUpperCase();
  const cleanType = String(type || 'UNIT').trim().toUpperCase();

  if (!cleanId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `NEW_${cleanType}_${cleanSector}_${cleanDate}_${cleanShift}_${ts}${rand}`;
  }

  return `${cleanType}_${cleanId}_${cleanSector}_${cleanDate}_${cleanShift}`;
};


const App: React.FC = () => {
  const [units, setUnits] = useState<UnitData[]>([]);
  const [currentSector, setCurrentSector] = useState<Sector>('1A');
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [settings, setSettings] = useState<AppSettings>({
    nombrePuesto: '1A',
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
  const [pendingViewChange, setPendingViewChange] = useState<ViewMode | null>(null);
  const [visualizationSectorsData, setVisualizationSectorsData] = useState<Record<string, { units: UnitData[], settings: AppSettings }>>({});
  const lastSavedRef = useRef<string>('');
  const loadingIdRef = useRef(0);

  const [sectorSettingsMap, setSectorSettingsMap] = useState<Record<string, AppSettings>>({});

  const [indicativeOptions, setIndicativeOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<string[]>([]);
  const [operatorOptions, setOperatorOptions] = useState<string[]>([]);
const [reportOperatorOptions, setReportOperatorOptions] = useState<string[]>([]);
  const [quadrantOptions, setQuadrantOptions] = useState<string[]>([]);
  const [motivoTallerOptions, setMotivoTallerOptions] = useState<string[]>([]);
  const [radioOptions, setRadioOptions] = useState<string[]>([]);
  const [lugarOptions, setLugarOptions] = useState<string[]>([]);
  const [motivoFaltoOptions, setMotivoFaltoOptions] = useState<string[]>([]);
  const [motivoDesperfectosOptions, setMotivoDesperfectosOptions] = useState<string[]>([]);
  const [motivoMantenimientoOptions, setMotivoMantenimientoOptions] = useState<string[]>([]);
  const [motivoSiniestroOptions, setMotivoSiniestroOptions] = useState<string[]>([]);
  const [motivoSinDocumentosOptions, setMotivoSinDocumentosOptions] = useState<string[]>([]);
  const [motivoSinVehiculoOptions, setMotivoSinVehiculoOptions] = useState<string[]>([]);
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
    const timer = setTimeout(() => {
      loadData(selectedDate, settings.turno, currentView);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedDate, settings.turno, currentSector, mobileData.length, currentView]);

  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { mobiles: MobileReference[], indicatives: string[], statuses: string[], personnel?: string[], operators?: string[], quadrants?: string[], radios?: string[], motivoTallerOptions?: string[], lugarOptions?: string[], motivoFaltoOptions?: string[], motivoDesperfectosOptions?: string[], motivoMantenimientoOptions?: string[], motivoSiniestroOptions?: string[], motivoSinDocumentosOptions?: string[], motivoSinVehiculoOptions?: string[] }) => {
          setMobileData(data.mobiles);
          setIndicativeOptions(data.indicatives);
          setStatusOptions(data.statuses);
           if (data.personnel) setPersonnelOptions(data.personnel);
           if (data.operators) setOperatorOptions(data.operators);
           if (data.reportOperators) setReportOperatorOptions(data.reportOperators);
           if (data.quadrants) setQuadrantOptions(data.quadrants);
          if (data.motivoTallerOptions) setMotivoTallerOptions(data.motivoTallerOptions);
          if (data.radios) setRadioOptions(data.radios);
          if (data.lugarOptions) setLugarOptions(data.lugarOptions);
          if (data.motivoFaltoOptions) setMotivoFaltoOptions(data.motivoFaltoOptions);
          if (data.motivoDesperfectosOptions) setMotivoDesperfectosOptions(data.motivoDesperfectosOptions);
          if (data.motivoMantenimientoOptions) setMotivoMantenimientoOptions(data.motivoMantenimientoOptions);
          if (data.motivoSiniestroOptions) setMotivoSiniestroOptions(data.motivoSiniestroOptions);
          if (data.motivoSinDocumentosOptions) setMotivoSinDocumentosOptions(data.motivoSinDocumentosOptions);
          if (data.motivoSinVehiculoOptions) setMotivoSinVehiculoOptions(data.motivoSinVehiculoOptions);
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
    const loadId = ++loadingIdRef.current;
    setLoading(true);
    const needsFullData = view && view !== 'DASHBOARD';
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      const successHandler = (data: { settings: AppSettings, allSectorSettings?: Record<string, AppSettings>, units: UnitData[] } | null) => {
          if (loadId !== loadingIdRef.current) return;
          // Guard: GAS may return null if the payload is too large or an error occurs server-side
          if (!data) {
            console.warn('getShiftData/getSectorData returned null — no data for this date/shift or a server error occurred.');
            if (view !== 'VISUALIZATION') setUnits([]);
            setLoading(false);
            return;
          }
          // 1. Map and clean incoming units
          const rawIncomingUnits: UnitData[] = (data.units || []).map((u, idx) => ({
            ...u,
            id: String(u.id || '').trim(),
            unit_id: u.unit_id || `LEGACY-${idx}`, // Fallback for old records
            sector: (u.sector || '').trim().toUpperCase() === '' ? '1A' : u.sector,
            type: u.type as any,
            personnel1: String(u.personnel1 || ''),
            personnel2: String(u.personnel2 || ''),
            plate: String(u.plate || ''),
            indicative: String(u.indicative || ''),
            radio: String(u.radio || ''),
            status: (u.status || '') as any,
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
            model: String(u.model || ''),
            lugarEstado: String(u.lugarEstado || ''),
            motivoEstado: String(u.motivoEstado || '')
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
                unit_id: `DEF-${currentSectorNormalized.replace(/\s+/g, '')}-${d.id}-${dateStr.replace(/-/g, '')}-${shift}`,
                type: d.type as any,
                sector: currentSector,
                plate: d.plate,
                quadrant: d.quadrant,
                status: '',
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
                model: d.model || '',
                lugarEstado: '',
                motivoEstado: ''
              });
            }
          });

          const allUnitsToUse = Array.from(finalUnitsMap.values());

          if (view === 'VISUALIZATION') {
            // Build visualization data without touching units state (preserves pending queue saves)
            const updatedSettings = data.allSectorSettings || sectorSettingsMap;
            const visData: Record<string, { units: UnitData[], settings: AppSettings }> = {};

            SECTORS.forEach(s => {
              const sectorSpecificSettings = updatedSettings[s] || {
                ...settings,
                nombrePuesto: s,
                operador: '',
                supervisor: '',
                permanencia: ''
              };
              let sectorUnits = allUnitsToUse.filter(u => u.sector === s);
              const defaults = mobileData.filter(m => m.sector === s);

              if (sectorUnits.length === 0) {
                sectorUnits = defaults.map(d => ({
                  id: d.id,
                  unit_id: `DEF-${s.replace(/\s+/g, '')}-${d.id}-${dateStr.replace(/-/g, '')}-${shift}`,
                  type: d.type as any,
                  sector: s,
                  plate: d.plate,
                  quadrant: d.quadrant,
                  status: '',
                  kmStart: '0', kmEnd: '0', totalKm: '0', kmRecarga: '0',
                  fuel: '-- / --', expense: 'S/ 0.00',
                  personnel1: '', personnel2: '', indicative: '',
                  radio: d.radio || '', reason: '', mechanics: '',
                  hours: '--:-- - --:--'
                }));
              } else {
                const typesToLoad = ['CHOFER', 'MOTO', 'SERENO'] as const;
                typesToLoad.forEach(type => {
                  if (!sectorUnits.some(u => u.type === type)) {
                    const typeDefaults = defaults
                      .filter(d => d.type === type)
                      .map(d => ({
                        id: d.id,
                        unit_id: `DEF-${s.replace(/\s+/g, '')}-${d.id}-${dateStr.replace(/-/g, '')}-${shift}`,
                        type: d.type as any,
                        sector: s,
                        plate: d.plate,
                        quadrant: d.quadrant,
                        status: '',
                        kmStart: '0', kmEnd: '0', totalKm: '0', kmRecarga: '0',
                        fuel: '-- / --', expense: 'S/ 0.00',
                        personnel1: '', personnel2: '', indicative: '',
                        radio: d.radio || '', reason: '', mechanics: '',
                        hours: '--:-- - --:--'
                      }));
                    sectorUnits = [...sectorUnits, ...typeDefaults];
                  }
                });
              }
              visData[s] = { units: sectorUnits, settings: sectorSpecificSettings };
            });

            setVisualizationSectorsData(visData);
            if (data.allSectorSettings) setSectorSettingsMap(data.allSectorSettings);
            setSettings({ ...settings, ...data.settings, turno: shift });
            setLoading(false);
            return;
          }

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
          if (loadId !== loadingIdRef.current) return;
          console.error('Failed to get data', err);
          if (view !== 'VISUALIZATION') setUnits([]);
          setLoading(false);
        });

        if (needsFullData) {
          runner.getShiftData(dateStr, shift, currentSector);
        } else {
          runner.getSectorData(dateStr, shift, currentSector);
        }
    } else {
      setTimeout(() => {
        if (loadId !== loadingIdRef.current) return;
        if (view !== 'VISUALIZATION') setUnits([]);
        setLoading(false);
      }, 500);
    }
  };

  const handleSectorChange = (sector: Sector) => {
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
            const newId = res.unit_id;
            if (newId && newId !== item.unit.unit_id) {
              setUnits(prev => prev.map(u => {
                const matchKey = u.unit_id || u.tempId || u.id;
                const itemKey = item.unit.unit_id || item.unit.tempId || item.unit.id;
                if (matchKey === itemKey) return { ...u, unit_id: newId };
                return u;
              }));
              
              // Also update status for the new ID so it shows the checkmark
              setSaveStatus(prev => ({ 
                ...prev, 
                [unitKey]: 'saved',
                [newId]: 'saved' 
              }));

              // Clean up both keys after timeout
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

  const hasPendingChanges = editingId !== null || Object.keys(saveStatus).length > 0;

  const handleViewChange = (newView: ViewMode) => {
    if (newView === currentView) return;
    if (hasPendingChanges) {
      setPendingViewChange(newView);
    } else {
      setCurrentView(newView);
    }
  };

  const pendingViewMessage = pendingViewChange
    ? (editingId
        ? 'Tiene cambios sin guardar en una unidad. Si sale sin guardar, los cambios se perderán.'
        : 'Hay una operación de guardado en proceso. ¿Está seguro de cambiar de vista?')
    : '';

  const confirmViewChange = () => {
    if (pendingViewChange) {
      setCurrentView(pendingViewChange);
      setPendingViewChange(null);
    }
  };

  const cancelViewChange = () => {
    setPendingViewChange(null);
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    if (hasPendingChanges) {
      window.addEventListener('beforeunload', handler);
    }
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasPendingChanges]);

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
        UnitStatus.MANTENIMIENTO,
        UnitStatus.DESPERFECTOS,
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
        status: '',
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
        unit_id: `DEF-${s.replace(/\s+/g, '')}-${d.id}-${selectedDate.replace(/-/g, '')}-${settings.turno}`
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
      status: '',
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
              unit_id: `DEF-${s.replace(/\s+/g, '')}-${d.id}-${selectedDate.replace(/-/g, '')}-${settings.turno}`
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

  const allOperatorNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(allSectorsData).forEach(sd => {
      sd.units.forEach(u => {
        if (u.personnel1 && u.personnel1.trim() !== '') names.add(u.personnel1.trim());
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allSectorsData]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Removed immediate persistData(newSettings, units) to avoid multiple server calls on focus loss
    // Persistence now happens on Global Save or Sector Change
  };

  const handleGlobalSave = (currentSettings?: AppSettings) => {
    if (isReadOnly) return;
    const settingsToSave = currentSettings || settings;
    if (!settingsToSave.operador.trim() || !settingsToSave.supervisor.trim() || !settingsToSave.permanencia.trim()) {
      return;
    }
    persistSettingsOnly(settingsToSave);
  };

  const persistSettingsOnly = (newSettings: AppSettings) => {
    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, error?: string }) => {
          setSaving(false);
          if (res.success) {
            setSectorSettingsMap(prev => ({
              ...prev,
              [newSettings.nombrePuesto || '1A']: newSettings
            }));
          } else {
            console.error('GAS Save Settings Error:', res.error);
            alert('Error al guardar configuración: ' + res.error);
          }
        })
        .saveShiftSettings(selectedDate, newSettings.turno, newSettings);
    } else {
      setTimeout(() => setSaving(false), 300);
    }
  };

  const handleHeaderSave = (currentSettings?: AppSettings) => {
    if (isReadOnly) return;
    const settingsToSave = currentSettings || settings;
    if (!settingsToSave.operador.trim() || !settingsToSave.supervisor.trim() || !settingsToSave.permanencia.trim()) {
      return;
    }
    persistSettingsOnly(settingsToSave);
  };

  const motivoStatusOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (motivoFaltoOptions.length) map['FALTO'] = motivoFaltoOptions;
    if (motivoDesperfectosOptions.length) map['DESPERFECTOS'] = motivoDesperfectosOptions;
    if (motivoMantenimientoOptions.length) map['MANTENIMIENTO'] = motivoMantenimientoOptions;
    if (motivoSiniestroOptions.length) map['SINIESTRO'] = motivoSiniestroOptions;
    if (motivoSinDocumentosOptions.length) map['SIN DOCUMENTOS'] = motivoSinDocumentosOptions;
    if (motivoSinVehiculoOptions.length) map['SIN VEHICULO'] = motivoSinVehiculoOptions;
    return map;
  }, [motivoFaltoOptions, motivoDesperfectosOptions, motivoMantenimientoOptions, motivoSiniestroOptions, motivoSinDocumentosOptions, motivoSinVehiculoOptions]);

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
      status: '' as any,
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
      lugarEstado: '',
      motivoEstado: '',
      unit_id: generateUnitId(type, '', currentSector, selectedDate, settings.turno)
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

  const handleGenerateReport = async (type: string, date: string, shift: string, operatorName?: string) => {
    setIsGeneratingStructuredReport(true);

    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      // Mock for local dev
      setTimeout(() => {
        setIsGeneratingStructuredReport(false);
        console.log(`MOCK: Generando reporte ${type} para ${date} / ${shift}`);
        if (type === 'motos') {
          generateMotoReport(units, sectorSettingsMap, date, shift, 'XTZ150', 'YAMAHA XTZ150', operatorName);
        } else if (type === 'motos_honda') {
          generateMotoReport(units, sectorSettingsMap, date, shift, 'SAHARA XRE 300', 'HONDA SAHARA XRE 300', operatorName);
        } else if (type === 'moviles') {
          generateVehicleReport(units, sectorSettingsMap, date, shift, operatorName);
        } else if (type === 'asistencia_regimen') {
          generatePersonnelAbsenceReport(units, personnelList, date, shift, operatorName);
        } else if (type === 'observaciones') {
          generateObservationsReport(units, date, shift, operatorName);
        } else if (type === 'general') {
          generateAllRecordsReport(units, sectorSettingsMap, date, shift, operatorName);
        }
      }, 1000);
      return;
    }

    google.script.run
      .withSuccessHandler((data: any) => {
        setIsGeneratingStructuredReport(false);
        if (type === 'motos') {
          generateMotoReport(data.units, data.allSectorSettings || {}, date, shift, 'YAMAHA XTZ150', 'YAMAHA XTZ150', operatorName);
        } else if (type === 'motos_honda') {
          generateMotoReport(data.units, data.allSectorSettings || {}, date, shift, 'HONDA SAHARA XRE 300', 'HONDA SAHARA XRE 300', operatorName);
        } else if (type === 'moviles') {
          generateVehicleReport(data.units, data.allSectorSettings || {}, date, shift, operatorName);
        } else if (type === 'asistencia_regimen') {
          if (personnelList.length > 0) {
            generatePersonnelAbsenceReport(data.units, personnelList, date, shift, operatorName);
          } else {
            setIsGeneratingStructuredReport(true);
            google.script.run
              .withSuccessHandler((loadedPersonnel: PersonnelData[]) => {
                setPersonnelList(loadedPersonnel);
                generatePersonnelAbsenceReport(data.units, loadedPersonnel, date, shift, operatorName);
                setIsGeneratingStructuredReport(false);
              })
              .withFailureHandler((err: any) => {
                setIsGeneratingStructuredReport(false);
                alert('Error al cargar datos del personal: ' + err);
              })
              .getPersonnelList();
          }
         } else if (type === 'observaciones') {
          generateObservationsReport(data.units, date, shift, operatorName);
        } else if (type === 'general') {
          generateAllRecordsReport(data.units, data.allSectorSettings || {}, date, shift, operatorName);
        } else {
          alert(`El reporte de "${type}" se encuentra en desarrollo.`);
        }
      })
      .withFailureHandler((err: any) => {
        setIsGeneratingStructuredReport(false);
        alert('Error al obtener datos: ' + err);
      })
      .getShiftData(date, shift, '1A'); // Passing a dummy sector is fine as it returns all units
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
      {pendingViewChange && (
        <ConfirmModal
          message={pendingViewMessage}
          onConfirm={confirmViewChange}
          onCancel={cancelViewChange}
        />
      )}
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      <main className="ml-[76px] flex flex-col h-screen">
        <Header
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onGlobalSave={handleGlobalSave}
          onHeaderSave={handleHeaderSave}
          onGeneratePDF={() => handleViewChange('REPORTS')}
          onRefresh={currentView === 'PERSONNEL' ? loadPersonnel : () => loadData(selectedDate, settings.turno, currentView)}
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
          hasPendingChanges={hasPendingChanges}
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
                  lugarOptions={lugarOptions}
                  motivoStatusOptions={motivoStatusOptions}
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
                    lugarOptions={lugarOptions}
                    motivoStatusOptions={motivoStatusOptions}
                    currentDate={selectedDate}
                    currentShift={settings.turno}
                    isSaving={saving}
                    saveStatus={saveStatus}
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
                    lugarOptions={lugarOptions}
                    motivoStatusOptions={motivoStatusOptions}
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
              allSectorsData={Object.keys(visualizationSectorsData).length > 0 ? visualizationSectorsData : allSectorsData}
              settings={settings}
              mobileData={mobileData}
            />
           ) : currentView === 'REPORTS' ? (
             <ReportGeneratorView
               selectedDate={selectedDate}
               selectedShift={settings.turno}
               onGenerateReport={handleGenerateReport}
               isGenerating={isGeneratingStructuredReport}
               operatorOptions={reportOperatorOptions}
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
