
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode } from './types';
import { SECTORS, INITIAL_UNITS } from './constants';

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
  const [units, setUnits] = useState<UnitData[]>(INITIAL_UNITS);
  const [currentSector, setCurrentSector] = useState<Sector>('SECTOR 1A');
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [settings, setSettings] = useState<AppSettings>({
    nombrePuesto: 'SECTOR 1A',
    operador: 'Villanueva Villafani, Joe',
    supervisor: 'Insp. Mendoza, Ricardo',
    permanencia: 'SOT. Garcia, Juan',
    turno: getAutoTurno(),
    ipServidor: '10.20.0.1',
    version: 'v2.5.0-PRO'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSectorChange = (sector: Sector) => {
    setLoading(true);
    setCurrentSector(sector);
    setSettings(prev => ({ ...prev, nombrePuesto: sector }));
    // Simular carga local
    setTimeout(() => setLoading(false), 500);
  };

  const handleSave = (updatedUnit: UnitData) => {
    setSaving(true);
    // Simular persistencia local
    setTimeout(() => {
      setUnits(prev => prev.map(u => u.id === editingId || u.id === updatedUnit.id ? updatedUnit : u));
      setEditingId(null);
      setSaving(false);
    }, 300);
  };

  const handleGlobalSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("¡Datos guardados localmente!");
    }, 800);
  };

  const handleAddUnit = (type: 'CHOFER' | 'MOTO' | 'SERENO') => {
    const newId = `NUEVO-${Date.now()}`;
    const newUnit: UnitData = {
      id: '', 
      type,
      personnel1: '',
      personnel2: type === 'CHOFER' ? '' : undefined,
      plate: '',
      indicative: '',
      radio: '',
      status: UnitStatus.CHECKIN,
      reason: '',
      km: '0 / 0 / 0 / 0',
      hours: '--:-- - --:--',
      fuel: '-- / --',
      expense: 'S/ 0.00',
      parts: '0',
      quadrant: '0',
      mechanics: 'Operativo',
    };
    
    setUnits(prev => [newUnit, ...prev]);
    setEditingId(newId);
  };

  const handleDeleteUnit = (id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id));
  };

  const sumPartes = (unitsArr: UnitData[]) => {
    return unitsArr.reduce((acc, curr) => {
      const p = parseInt(curr.parts.toString().match(/\d+/)?.[0] || '0');
      return acc + p;
    }, 0);
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
          totalPartes={sumPartes(units)} 
          onSaveSettings={(s) => setSettings(s)}
          onGlobalSave={handleGlobalSave}
          onGeneratePDF={() => {}}
          onRefresh={() => handleSectorChange(currentSector)}
          isSaving={saving}
          currentSector={currentSector}
          onSectorChange={handleSectorChange}
          currentView={currentView}
        />
        <div className="flex-1 overflow-y-auto scroll-smooth p-4 lg:p-6">
          {currentView === 'DASHBOARD' ? (
            <>
              <UnitSection 
                title="CHOFERES" type="CHOFER" icon="minor_crash"
                badge={units.filter(u => u.type === 'CHOFER').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'CHOFER'))}
                units={units.filter(u => u.type === 'CHOFER')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={() => setEditingId(null)} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
              />
              <UnitSection 
                title="MOTORIZADOS" type="MOTO" icon="moped"
                badge={units.filter(u => u.type === 'MOTO').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'MOTO'))}
                units={units.filter(u => u.type === 'MOTO')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={() => setEditingId(null)} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
              />
              <UnitSection 
                title="SERENOS" type="SERENO" icon="hail"
                badge={units.filter(u => u.type === 'SERENO').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'SERENO'))}
                units={units.filter(u => u.type === 'SERENO')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={() => setEditingId(null)} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
              />
            </>
          ) : (
            <VisualizationView allSectorsData={{[currentSector]: {units, settings}}} settings={settings} />
          )}
        </div>
        <Footer settings={settings} activeCount={units.filter(u => u.status === 'ACTIVO').length} personnelCount={units.length} />
      </main>
    </div>
  );
};

export default App;
