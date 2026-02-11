import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode, MobileReference } from './types';
import { SECTORS, SECTOR_DATA, VEHICLES } from './constants';

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
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
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

  // Sync with GAS
  useEffect(() => {
    loadData(selectedDate, settings.turno);
  }, [selectedDate, settings.turno, currentSector]);

  // Load Reference Data (Mobile/Placa)
  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: MobileReference[]) => {
          if (data && data.length > 0) {
            setMobileData(data);
          } else {
            console.warn('No mobile data found in GAS, setting empty list');
            setMobileData([]);
          }
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to get mobile data', err);
          setMobileData([]);
        })
        .getMobileData();
    } else {
      // Mock for local dev - empty to force testing "real" data behavior or lack thereof
      console.log('MOCK: No GAS environment, setting empty mobile data');
      setMobileData([]);
    }
  }, []);

  const loadData = (dateStr: string, shift: string) => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { settings: AppSettings, units: UnitData[] }) => {
          setUnits(data.units);
          setSettings(prev => ({ ...prev, ...data.settings }));
          setLoading(false);
          lastSavedRef.current = JSON.stringify(data);
        })
        .getShiftData(dateStr, shift);
    } else {
      // Mock for local dev
      console.log('MOCK: Loading data for', dateStr, shift);
      setTimeout(() => {
        setUnits(SECTOR_DATA[currentSector as keyof typeof SECTOR_DATA] || []);
        setLoading(false);
      }, 500);
    }
  };

  const persistData = (newSettings: AppSettings, newUnits: UnitData[]) => {
    const dataObj = { settings: newSettings, units: newUnits };
    const dataStr = JSON.stringify(dataObj);
    if (dataStr === lastSavedRef.current) return;

    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res: { success: boolean, error?: string }) => {
          setSaving(false);
          if (res.success) {
            lastSavedRef.current = dataStr;
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
        console.log('MOCK: Data persisted to GAS', dataObj);
      }, 300);
    }
  };

  const handleSectorChange = (sector: Sector) => {
    setCurrentSector(sector);
    setSettings(prev => ({ ...prev, nombrePuesto: sector }));
  };

  const handleSave = (updatedUnit: UnitData) => {
    const unitWithSector = { ...updatedUnit, sector: currentSector };
    let newUnits: UnitData[];

    // Find the unit we are saving (it might have an old ID if it was NEW-...)
    newUnits = units.map(u => (u.id === updatedUnit.id || u.id === editingId) ? unitWithSector : u);

    setUnits(newUnits);
    setEditingId(null);
    persistData(settings, newUnits);
  };

  const currentSectorUnits = units.filter(u => u.sector === currentSector || !u.sector);

  // Grouping for VisualizationView
  const allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }> = {};
  SECTORS.forEach(s => {
    allSectorsData[s] = {
      units: units.filter(u => u.sector === s),
      settings: { ...settings, nombrePuesto: s }
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
      hours: '--:-- - --:--',
      fuel: '-- / --',
      expense: 'S/ 0.00',
      parts: '0',
      quadrant: '',
      mechanics: 'Operativo',
    };

    setUnits(prev => [newUnit, ...prev]);
    setEditingId(tempId);
  };

  const handleDeleteUnit = (id: string) => {
    const newUnits = units.filter(u => u.id !== id);
    setUnits(newUnits);
    persistData(settings, newUnits);
  };

  const handleCancel = () => {
    // If canceling a new unit, remove it from state
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

  const handleGeneratePDF = () => {
    // Switch to visualization view first
    setCurrentView('VISUALIZATION');

    // Small delay to allow view switch to render before printing
    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#002d5a] text-white">
        <div className="w-12 h-12 border-4 border-[#00a19b] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black tracking-[0.2em] animate-pulse uppercase">Cargando Sector...</p>
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
          onGeneratePDF={handleGeneratePDF}
          onRefresh={() => loadData(selectedDate, settings.turno)}
          isSaving={saving}
          currentSector={currentSector}
          onSectorChange={handleSectorChange}
          currentView={currentView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
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
              />
              <UnitSection
                title="MOTORIZADOS" type="MOTO" icon="moped"
                badge={currentSectorUnits.filter(u => u.type === 'MOTO').length.toString()}
                partesTotal={sumPartes(currentSectorUnits.filter(u => u.type === 'MOTO'))}
                units={currentSectorUnits.filter(u => u.type === 'MOTO')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
                mobileData={mobileData}
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
              />
            </>
          ) : (
            <VisualizationView
              allSectorsData={Object.fromEntries(
                SECTORS.map(sector => [
                  sector,
                  {
                    units: SECTOR_DATA[sector],
                    settings: { ...settings, nombrePuesto: sector }
                  }
                ])
              )}
              settings={settings}
            />
          )}
        </div>
        <Footer settings={settings} activeCount={units.filter(u => u.status === UnitStatus.PATRULLANDO).length} personnelCount={units.length} />
      </main>
    </div>
  );
};

export default App;
