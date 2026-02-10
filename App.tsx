import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode } from './types';
import { SECTORS, SECTOR_DATA } from './constants';

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
  const [units, setUnits] = useState<UnitData[]>(SECTOR_DATA['SECTOR 1A']);
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
    // Load sector-specific data
    setUnits(SECTOR_DATA[sector]);
    setTimeout(() => setLoading(false), 500);
  };

  const handleSave = (updatedUnit: UnitData) => {
    setSaving(true);
    // Simular persistencia local
    setTimeout(() => {
      setUnits(prev => {
        // If the unit has an empty original ID, it's a new unit - find and replace it
        const index = prev.findIndex(u => u.id === '');
        if (index !== -1) {
          const newUnits = [...prev];
          newUnits[index] = updatedUnit;
          return newUnits;
        }
        // Otherwise, update existing unit by ID
        return prev.map(u => u.id === updatedUnit.id ? updatedUnit : u);
      });
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
    const tempId = `N-${Date.now()}`;
    const newUnit: UnitData = {
      id: '',
      type,
      personnel1: '',
      personnel2: '',
      plate: '',
      indicative: '',
      radio: '',
      status: UnitStatus.CHECKIN,
      reason: '',
      km: '0 / 0 / 0',
      hours: '--:-- - --:--',
      fuel: '-- / --',
      expense: 'S/ 0.00',
      parts: '0',
      quadrant: '0',
      mechanics: 'Operativo',
    };

    setUnits(prev => [newUnit, ...prev]);
    setEditingId(tempId);
  };

  const handleDeleteUnit = (id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id));
  };

  const handleCancel = () => {
    // If editing a new unit (empty ID), remove it from the list
    if (editingId && editingId.startsWith('N-')) {
      setUnits(prev => prev.filter(u => u.id !== ''));
    }
    setEditingId(null);
  };

  const sumPartes = (unitsArr: UnitData[]) => {
    return unitsArr.reduce((acc, curr) => {
      const p = parseInt(curr.parts.toString().match(/\d+/)?.[0] || '0');
      return acc + p;
    }, 0);
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // HEADER
    doc.setFillColor(0, 75, 147); // surco-blue
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE INTEGRADO MSS', 14, 16);

    doc.setFontSize(10);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}`, 230, 10);
    doc.text(`TURNO: ${settings.turno}`, 230, 15);

    // SUB-HEADER INFO
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`OPERADOR: ${settings.operador}`, 14, 32);
    doc.text(`SUPERVISOR: ${settings.supervisor}`, 14, 37);
    doc.text(`PERMANENCIA: ${settings.permanencia}`, 14, 42);

    // TABLE GENERATOR HELPER
    let finalY = 55;

    const generateTable = (title: string, data: UnitData[], startY: number, type: 'CHOFER' | 'MOTO' | 'SERENO') => {
      if (data.length === 0) return startY;

      doc.setFontSize(12);
      doc.setTextColor(0, 75, 147);
      doc.text(title, 14, startY);

      // Different columns for SERENOS vs CHOFER/MOTO
      const isSereno = type === 'SERENO';

      const headers = isSereno
        ? [['PUESTO', 'PERSONAL', 'RADIO', 'ESTADO', 'PARTES', 'CUADRANTE', 'MOTIVO', 'OBS.']]
        : [['MÓVIL/PLACA', 'PERSONAL', 'INDICATIVO COP.', 'RADIO', 'ESTADO', 'HORARIO', 'KM (I/F/R)', 'COMBUSTIBLE', 'GASTO', 'PARTES', 'CUADRANTE', 'MOTIVO', 'OBS.']];

      const bodyData = data.map(u => {
        const baseData = [
          `${u.id} / ${u.plate}`,
          `${u.personnel1}${u.personnel2 ? ` / ${u.personnel2}` : ''}`,
        ];

        if (isSereno) {
          return [
            ...baseData,
            u.radio,
            u.status,
            u.parts,
            u.quadrant,
            u.mechanics,
            u.reason || '-'
          ];
        } else {
          return [
            ...baseData,
            u.indicative,
            u.radio,
            u.status,
            u.hours,
            u.km,
            u.fuel,
            u.expense,
            u.parts,
            u.quadrant,
            u.mechanics,
            u.reason || '-'
          ];
        }
      });

      autoTable(doc, {
        startY: startY + 2,
        head: headers,
        body: bodyData,
        styles: { fontSize: 6, cellPadding: 1.5, overflow: 'linebreak', halign: 'center' },
        headStyles: { fillColor: [0, 75, 147], textColor: 255, fontStyle: 'bold', fontSize: 6, halign: 'center' },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto'
      });

      return (doc as any).lastAutoTable.finalY + 10;
    };

    // GENERATE ALL SECTORS
    SECTORS.forEach((sector, index) => {
      if (index > 0) {
        doc.addPage();
        finalY = 30;
      } else {
        finalY = 55;
      }

      // Sector header on each page
      doc.setFontSize(16);
      doc.setTextColor(0, 75, 147);
      doc.text(sector, 14, finalY);
      finalY += 10;

      const sectorUnits = SECTOR_DATA[sector];
      finalY = generateTable('CHOFERES', sectorUnits.filter(u => u.type === 'CHOFER'), finalY, 'CHOFER');
      finalY = generateTable('MOTORIZADOS', sectorUnits.filter(u => u.type === 'MOTO'), finalY, 'MOTO');
      finalY = generateTable('SERENOS', sectorUnits.filter(u => u.type === 'SERENO'), finalY, 'SERENO');
    });

    doc.save(`reporte_integrado_MSS_${settings.turno}_${new Date().toISOString().split('T')[0]}.pdf`);
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
          onGeneratePDF={handleGeneratePDF}
          onRefresh={() => handleSectorChange(currentSector)}
          isSaving={saving}
          currentSector={currentSector}
          onSectorChange={handleSectorChange}
          currentView={currentView}
        />
        <div className="flex-1 overflow-y-auto scroll-smooth p-4 lg:p-6" id="report-content">
          {currentView === 'DASHBOARD' ? (
            <>
              <UnitSection
                title="CHOFERES" type="CHOFER" icon="minor_crash"
                badge={units.filter(u => u.type === 'CHOFER').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'CHOFER'))}
                units={units.filter(u => u.type === 'CHOFER')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
              />
              <UnitSection
                title="MOTORIZADOS" type="MOTO" icon="moped"
                badge={units.filter(u => u.type === 'MOTO').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'MOTO'))}
                units={units.filter(u => u.type === 'MOTO')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
              />
              <UnitSection
                title="SERENOS" type="SERENO" icon="hail"
                badge={units.filter(u => u.type === 'SERENO').length.toString()}
                partesTotal={sumPartes(units.filter(u => u.type === 'SERENO'))}
                units={units.filter(u => u.type === 'SERENO')}
                allUnits={units}
                editingId={editingId}
                onEdit={setEditingId} onSave={handleSave} onCancel={handleCancel} onAdd={handleAddUnit} onDelete={handleDeleteUnit}
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
        <Footer settings={settings} activeCount={units.filter(u => u.status === 'ACTIVO').length} personnelCount={units.length} />
      </main>
    </div>
  );
};

export default App;
