import React, { useState, useEffect, useRef, useMemo } from 'react';
// Eliminados imports de jspdf y autotable para usar CDN

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import ReportGeneratorView from './components/ReportGeneratorView';
import { generateMotoReport, generateVehicleReport, generatePersonnelAbsenceReport } from './utils/reportGenerator';
import PersonnelView from './components/PersonnelView';
import StatisticsView from './components/StatisticsView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode, MobileReference, PersonnelData } from './types';
import { SECTORS, SECTOR_DATA } from './constants';
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
  const [personnelList, setPersonnelList] = useState<PersonnelData[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [isGeneratingStructuredReport, setIsGeneratingStructuredReport] = useState(false);

  useEffect(() => {
    loadData(selectedDate, settings.turno);
  }, [selectedDate, settings.turno, currentSector]);

  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { mobiles: MobileReference[], indicatives: string[], statuses: string[], personnel?: string[], operators?: string[], quadrants?: string[] }) => {
          setMobileData(data.mobiles);
          setIndicativeOptions(data.indicatives);
          setStatusOptions(data.statuses);
          if (data.personnel) setPersonnelOptions(data.personnel);
          if (data.operators) setOperatorOptions(data.operators);
          if (data.quadrants) setQuadrantOptions(data.quadrants);
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

  const loadData = (dateStr: string, shift: string) => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { settings: AppSettings, allSectorSettings?: Record<string, AppSettings>, units: UnitData[] }) => {
          const incomingUnits: UnitData[] = (data.units || []).map(u => ({
            ...u,
            id: String(u.id || ''),
            sector: (u.sector || '').trim().toUpperCase() === '' ? 'SECTOR 1A' : u.sector,
            type: u.type as any,
            personnel1: String(u.personnel1 || ''),
            personnel2: String(u.personnel2 || ''),
            plate: String(u.plate || ''),
            indicative: String(u.indicative || ''),
            radio: String(u.radio || ''),
            status: (u.status || UnitStatus.PATRULLANDO) as any,
            reason: String(u.reason || ''),
            km: String(u.km || '0 / 0 / 0'),
            hours: String(u.hours || ''),
            fuel: String(u.fuel || '-- / --'),
            expense: String(u.expense || 'S/ 0.00'),
            parts: String(u.parts || '0'),
            quadrant: String(u.quadrant || ''),
            mechanics: String(u.mechanics || 'Operativo'),
            model: String(u.model || '')
          }));

          const currentSectorNormalized = currentSector.trim().toUpperCase();
          const otherSectorsUnits = incomingUnits.filter(u => (u.sector || '').trim().toUpperCase() !== currentSectorNormalized);
          const currentSectorUnitsFound = incomingUnits.filter(u => (u.sector || '').trim().toUpperCase() === currentSectorNormalized);

          const defaults = SECTOR_DATA[currentSector] || [];
          const typesToLoad = ['CHOFER', 'MOTO', 'SERENO'] as const;
          let sectorUnitsToUse = [...currentSectorUnitsFound];

          typesToLoad.forEach(type => {
            const hasType = currentSectorUnitsFound.some(u => u.type === type);
            if (!hasType) {
              const typeDefaults = defaults.filter(d => d.type === type).map(d => ({ ...d, sector: currentSector }));
              sectorUnitsToUse = [...sectorUnitsToUse, ...typeDefaults];
            }
          });

          setUnits([...otherSectorsUnits, ...sectorUnitsToUse]);

          if (data.allSectorSettings) {
            setSectorSettingsMap(data.allSectorSettings);
          }

          setSettings(prev => ({
            ...prev,
            ...data.settings,
            turno: shift
          }));
          setLoading(false);
          lastSavedRef.current = JSON.stringify(data);
        })
        .getShiftData(dateStr, shift, currentSector);
    } else {
      setTimeout(() => {
        setUnits([]);
        setLoading(false);
      }, 500);
    }
  };

  const persistData = (newSettings: AppSettings, newUnits: UnitData[]) => {
    const validUnits = newUnits.filter(u => u.id && !u.id.startsWith('NEW-'));
    const dataObj = { settings: newSettings, units: validUnits };
    const dataStr = JSON.stringify(dataObj);
    if (dataStr === lastSavedRef.current) return;

    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, error?: string }) => {
          setSaving(false);
          if (res.success) {
            lastSavedRef.current = dataStr;
            setSectorSettingsMap(prev => ({
              ...prev,
              [newSettings.nombrePuesto || 'SECTOR 1A']: newSettings
            }));
          } else {
            console.error('GAS Save Error:', res.error);
            alert('Error al guardar: ' + res.error);
          }
        })
        .saveShiftData(selectedDate, newSettings.turno, newSettings, newUnits);
    } else {
      setTimeout(() => {
        setSaving(false);
        lastSavedRef.current = dataStr;
      }, 300);
    }
  };

  const handleSectorChange = (sector: Sector) => {
    setCurrentSector(sector);
    const specificSettings = sectorSettingsMap[sector];
    if (specificSettings) {
      setSettings(prev => ({ ...specificSettings, turno: prev.turno }));
    } else {
      setSettings(prev => ({ ...prev, nombrePuesto: sector, operador: '', supervisor: '' }));
    }
  };

  const handleSave = (updatedUnit: UnitData) => {
    const unitWithSector = { ...updatedUnit, sector: currentSector };
    let newUnits = units.map(u => (u.id === updatedUnit.id || u.id === editingId) ? unitWithSector : u);
    setUnits(newUnits);
    setEditingId(null);
    persistData(settings, newUnits);
  };

  const currentSectorUnits = units.filter(u => {
    const uSector = (u.sector || '').trim().toUpperCase();
    const currSector = currentSector.trim().toUpperCase();
    return uSector === currSector;
  });

  const allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }> = {};
  SECTORS.forEach(s => {
    const sectorSpecificSettings = sectorSettingsMap[s] || {
      ...settings,
      nombrePuesto: s,
      operador: '',
      supervisor: ''
    };
    let sectorUnits = units.filter(u => u.sector === s);
    if (sectorUnits.length === 0) {
      const defaults = SECTOR_DATA[s] || [];
      sectorUnits = defaults.map(d => ({ ...d, sector: s }));
    } else {
      const typesToLoad = ['CHOFER', 'MOTO', 'SERENO'] as const;
      const defaults = SECTOR_DATA[s] || [];
      typesToLoad.forEach(type => {
        const hasType = sectorUnits.some(u => u.type === type);
        if (!hasType) {
          const typeDefaults = defaults.filter(d => d.type === type).map(d => ({ ...d, sector: s }));
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
    persistData(newSettings, units);
  };

  const handleGlobalSave = () => {
    persistData(settings, units);
  };

  const handleAddUnit = (type: 'CHOFER' | 'MOTO' | 'SERENO') => {
    const tempId = `NEW-${Date.now()}`;
    const newUnit: UnitData = {
      id: tempId,
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
      hours: '',
      fuel: '-- / --',
      expense: 'S/ 0.00',
      parts: '0',
      quadrant: '',
      mechanics: 'Operativo',
    };
    setUnits(prev => [newUnit, ...prev.filter(u => !u.id.startsWith('NEW-'))]);
    setEditingId(tempId);
  };

  const handleDeleteUnit = (id: string) => {
    const newUnits = units.filter(u => u.id !== id);
    setUnits(newUnits);
    persistData(settings, newUnits);
  };

  const handleCancel = () => {
    if (editingId && editingId.startsWith('NEW-')) {
      setUnits(prev => prev.filter(u => u.id !== editingId));
    }
    setEditingId(null);
  };

  const sumPartes = (unitsArr: UnitData[]) => {
    return unitsArr.reduce((acc, curr) => {
      const p = parseInt(curr.parts?.toString().match(/\d+/)?.[0] || '0');
      return acc + p;
    }, 0);
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
          generatePersonnelAbsenceReport(data.units, data.personnelList || [], date, shift);
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

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-primary text-white">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[14px] font-medium tracking-[0.2em] animate-pulse uppercase">Cargando Datos...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          settings={settings}
          totalPartes={sumPartes(currentSectorUnits)}
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
        />

        <div className="flex-1 overflow-y-auto scroll-smooth p-4 lg:p-6" id="report-content">
          {currentView === 'DASHBOARD' ? (
            <>
              <UnitSection
                title="CHOFERES" type="CHOFER" icon="minor_crash"
                badge={currentSectorUnits.filter(u => u.type === 'CHOFER').length.toString()}
                partesTotal={sumPartes(currentSectorUnits.filter(u => u.type === 'CHOFER'))}
                units={currentSectorUnits.filter(u => u.type === 'CHOFER')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
                mobileData={mobileData}
                statusOptions={statusOptions}
                indicativeOptions={indicativeOptions}
                personnelOptions={personnelOptions}
                quadrantOptions={quadrantOptions}
              />
              {currentSector !== 'RESCATE' && (
                <>
                  <UnitSection
                    title="MOTORIZADOS" type="MOTO" icon="moped"
                    badge={currentSectorUnits.filter(u => u.type === 'MOTO').length.toString()}
                    partesTotal={sumPartes(currentSectorUnits.filter(u => u.type === 'MOTO'))}
                    units={currentSectorUnits.filter(u => u.type === 'MOTO')}
                    allUnits={units}
                    editingId={editingId}
                    onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
                    mobileData={mobileData}
                    statusOptions={statusOptions}
                    indicativeOptions={indicativeOptions}
                    personnelOptions={personnelOptions}
                    quadrantOptions={quadrantOptions}
                  />
                  <UnitSection
                    title="SERENOS" type="SERENO" icon="hail"
                    badge={currentSectorUnits.filter(u => u.type === 'SERENO').length.toString()}
                    partesTotal={sumPartes(currentSectorUnits.filter(u => u.type === 'SERENO'))}
                    units={currentSectorUnits.filter(u => u.type === 'SERENO')}
                    allUnits={units}
                    editingId={editingId}
                    onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
                    mobileData={mobileData}
                    statusOptions={statusOptions}
                    indicativeOptions={indicativeOptions}
                    personnelOptions={personnelOptions}
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
          ) : (
            <StatisticsView units={units} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
