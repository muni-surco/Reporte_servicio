import React, { useState, useEffect, useRef, useMemo } from 'react';
// Eliminados imports de jspdf y autotable para usar CDN

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import UnitSection from './components/UnitSection';
import VisualizationView from './components/VisualizationView';
import PersonnelView from './components/PersonnelView';
import { UnitData, AppSettings, UnitStatus, Sector, ViewMode, MobileReference, PersonnelData } from './types';
import { SECTORS, SECTOR_DATA } from './constants';

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

  // New state for all sector settings
  const [sectorSettingsMap, setSectorSettingsMap] = useState<Record<string, AppSettings>>({});

  // New Reference Data States
  // Keep only mobile array here
  const [indicativeOptions, setIndicativeOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<string[]>([]);
  const [quadrantOptions, setQuadrantOptions] = useState<string[]>([]);
  const [personnelList, setPersonnelList] = useState<PersonnelData[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  // Sync with GAS
  useEffect(() => {
    loadData(selectedDate, settings.turno);
  }, [selectedDate, settings.turno, currentSector]);

  // Load Reference Data (Mobile/Placa/Indicativo/Estado)
  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { mobiles: MobileReference[], indicatives: string[], statuses: string[], personnel?: string[], quadrants?: string[] }) => {
          setMobileData(data.mobiles);
          setIndicativeOptions(data.indicatives);
          setStatusOptions(data.statuses);
          if (data.personnel) setPersonnelOptions(data.personnel);
          if (data.quadrants) setQuadrantOptions(data.quadrants);
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to get mobile data', err);
          setMobileData([]);
        })
        .getMobileData();
    } else {
      // Mock for local dev
      console.log('MOCK: No GAS environment, setting empty mobile data');
      setMobileData([]);
      // Mock some statuses for testing if needed
      setStatusOptions(Object.values(UnitStatus));
    }
  }, []);

  // Load Personnel Data if in that view
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

  const loadData = (dateStr: string, shift: string) => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: { settings: AppSettings, allSectorSettings?: Record<string, AppSettings>, units: UnitData[] }) => {
          // 1. Migrate legacy data: units without a sector are assigned to 'SECTOR 1A'
          const incomingUnits = (data.units || []).map(u => ({
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
            hours: String(u.hours || '--:-- - --:--'),
            fuel: String(u.fuel || '-- / --'),
            expense: String(u.expense || 'S/ 0.00'),
            parts: String(u.parts || '0'),
            quadrant: String(u.quadrant || ''),
            mechanics: String(u.mechanics || 'Operativo')
          }));

          console.log('GAS Data (Migrated):', incomingUnits);
          const currentSectorNormalized = currentSector.trim().toUpperCase();

          // 2. Separate units of the current sector from others
          const otherSectorsUnits = incomingUnits.filter(u => (u.sector || '').trim().toUpperCase() !== currentSectorNormalized);
          const currentSectorUnitsFound = incomingUnits.filter(u => (u.sector || '').trim().toUpperCase() === currentSectorNormalized);

          console.log(`Units found for ${currentSectorNormalized}:`, currentSectorUnitsFound.length);

          // 3. Granular loading: check by type within current sector
          const defaults = SECTOR_DATA[currentSector] || [];
          const typesToLoad = ['CHOFER', 'MOTO', 'SERENO'] as const;
          let sectorUnitsToUse = [...currentSectorUnitsFound];

          typesToLoad.forEach(type => {
            const hasType = currentSectorUnitsFound.some(u => u.type === type);
            if (!hasType) {
              console.log(`Loading granular default for type ${type} in ${currentSectorNormalized}`);
              const typeDefaults = defaults.filter(d => d.type === type).map(d => ({ ...d, sector: currentSector }));
              sectorUnitsToUse = [...sectorUnitsToUse, ...typeDefaults];
            }
          });

          setUnits([...otherSectorsUnits, ...sectorUnitsToUse]);

          if (data.allSectorSettings) {
            setSectorSettingsMap(data.allSectorSettings);
          }

          // Only update settings if we got a valid response (which we should, with at least sector name)
          // The backend ensures 'nombrePuesto' is the requested sector if found, or defaults.
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            // Ensure turno/date are consistent if backend returned defaults
            turno: shift
          }));
          setLoading(false);
          lastSavedRef.current = JSON.stringify(data);
        })
        .getShiftData(dateStr, shift, currentSector);
    } else {
      // Mock for local dev
      console.log('MOCK: Loading data for', dateStr, shift, currentSector);
      setTimeout(() => {
        setUnits([]);
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
            // Update local sector settings map immediately for responsive UI
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
        console.log('MOCK: Data persisted to GAS', dataObj);
      }, 300);
    }
  };

  const handleSectorChange = (sector: Sector) => {
    setCurrentSector(sector);
    // When changing sector, see if we have specific settings for it loaded, otherwise default
    const specificSettings = sectorSettingsMap[sector];
    if (specificSettings) {
      setSettings(prev => ({ ...specificSettings, turno: prev.turno })); // Keep turno just in case
    } else {
      setSettings(prev => ({ ...prev, nombrePuesto: sector, operador: '', supervisor: '' }));
    }
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

  const currentSectorUnits = units.filter(u => {
    const uSector = (u.sector || '').trim().toUpperCase();
    const currSector = currentSector.trim().toUpperCase();
    return uSector === currSector;
  });

  // Grouping for VisualizationView
  // Use 'sectorSettingsMap' to get correct Operator/Supervisor per sector
  const allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }> = {};
  SECTORS.forEach(s => {
    // If we have specific settings (operator/supervisor) for this sector, use them.
    const sectorSpecificSettings = sectorSettingsMap[s] || {
      ...settings,
      nombrePuesto: s,
      operador: '',
      supervisor: ''
    };

    // Filter existing units
    let sectorUnits = units.filter(u => u.sector === s);

    // If no units found for this sector at all, use definitions from SECTOR_DATA
    if (sectorUnits.length === 0) {
      const defaults = SECTOR_DATA[s] || [];
      sectorUnits = defaults.map(d => ({ ...d, sector: s }));
    } else {
      // If some units exist but maybe some types are missing, we could do more granular defaults here too
      // but for 'VisualizationView' (Integrated Report), just showing what DB has OR defaults is usually enough.
      // However, to be consistent with 'loadData', let's check types.
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
    // Generar el reporte PDF programáticamente usando versiones de CDN
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;

    // Encabezado Principal
    doc.setFontSize(18);
    doc.setTextColor(0, 45, 90); // #002d5a
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE INTEGRADO DE SERVICIO MSS', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(`FECHA: ${selectedDate}`, margin, 25);
    doc.text(`TURNO: ${settings.turno}`, 55, 25);
    doc.text(`PERMANENCIA: ${settings.permanencia || '--'}`, 90, 25);
    doc.text(`GENERADO EL: ${new Date().toLocaleString()}`, pageWidth - margin, 25, { align: 'right' });

    let finalY = 32;

    // Usar allSectorsData que ya está calculado para la vista
    Object.entries(allSectorsData).forEach(([sectorName, data]) => {
      if (!data.units || data.units.length === 0) return;

      // Verificar espacio para el siguiente sector (Título + Header de Tabla (aprox 20mm))
      if (finalY > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        finalY = 15;
      }

      // Título de Sector
      doc.setFillColor(0, 75, 147); // #004b93
      doc.rect(margin, finalY, pageWidth - (margin * 2), 8, 'F');

      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(sectorName, margin + 3, finalY + 5.5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`OPERADOR: ${data.settings.operador || 'NO ASIGNADO'}`, margin + 80, finalY + 5.5);
      doc.text(`SUPERVISOR: ${data.settings.supervisor || 'NO ASIGNADO'}`, margin + 180, finalY + 5.5);

      finalY += 8;

      const body = data.units.map(u => {
        const ref = mobileData.find(m => m.id === u.id);
        const displayRadio = u.radio || '--';
        const displayQuadrant = u.quadrant || ref?.quadrant || '--';
        const displayPlate = u.plate || ref?.plate || '--';
        const displayPersonnel = u.personnel2 ? `${u.personnel1} / ${u.personnel2}` : u.personnel1;

        // Formatear KM: Inicio / Fin / Recorrido / Recarga
        const kmParts = (u.km || '0 / 0 / 0 / 0').split('/').map(p => p.trim());
        const displayKM = `${kmParts[0]} / ${kmParts[1]} / ${kmParts[2]}${kmParts[3] && kmParts[3] !== '0' ? ' (R:' + kmParts[3] + ')' : ''}`;

        // Combustible y Gasto
        const fuelType = (u.fuel || '--').split('/')[0]?.trim() || '--';
        const displayFuel = `${fuelType} | ${u.expense || 'S/ 0.00'}`;

        // Estado y Motivo
        const displayStatus = u.reason ? `${u.status}\n(${u.reason})` : u.status;

        return [
          u.id,
          displayPersonnel,
          displayPlate,
          u.indicative || '--',
          displayRadio,
          displayStatus,
          displayKM,
          u.hours || '--:--',
          displayFuel,
          u.parts || '0',
          sectorName === 'RESCATE' ? '--' : displayQuadrant
        ];
      });

      (doc as any).autoTable({
        startY: finalY,
        head: [['UNI', 'PERSONAL / COP.', 'PLACA', 'IND.', 'RADIO', 'ESTADO / MOTIVO', 'KM (I/F/T/R)', 'HORARIO', 'COMB / GASTO', 'P.', 'CUAD.']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [0, 45, 90], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 12 }, // UNI
          1: { cellWidth: 'auto' }, // PERSONAL
          2: { cellWidth: 18 }, // PLACA
          3: { cellWidth: 12 }, // IND
          4: { cellWidth: 15 }, // RADIO
          5: { cellWidth: 35 }, // ESTADO/MOTIVO
          6: { cellWidth: 35 }, // KM
          7: { cellWidth: 20 }, // HORARIO
          8: { cellWidth: 25 }, // COMB/GASTO
          9: { cellWidth: 8 },  // P
          10: { cellWidth: 15 } // CUAD
        },
        margin: { left: margin, right: margin },
      });

      finalY = (doc as any).lastAutoTable.finalY + 10;
    });

    const fileName = `Reporte_MSS_${selectedDate}_${settings.turno}.pdf`;
    doc.save(fileName);
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#002d5a] text-white">
        <div className="w-12 h-12 border-4 border-[#00a19b] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black tracking-[0.2em] animate-pulse uppercase">Cargando Sectores...</p>
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
          onRefresh={currentView === 'PERSONNEL' ? loadPersonnel : () => loadData(selectedDate, settings.turno)}
          isSaving={saving}
          currentSector={currentSector}
          onSectorChange={handleSectorChange}
          currentView={currentView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          personnelOptions={personnelOptions}
          personnelStats={personnelStats}
        />
        <div className="flex-1 overflow-y-auto scroll-smooth p-4 lg:p-6" id="report-content">
          {currentView === 'DASHBOARD' && (
            <>
              <UnitSection
                title="CHOFERES" type="CHOFER" icon="person"
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
          )}

          {currentView === 'VISUALIZATION' && (
            <VisualizationView
              allSectorsData={allSectorsData}
              settings={settings}
              mobileData={mobileData}
            />
          )}

          {currentView === 'PERSONNEL' && (
            <PersonnelView
              data={personnelList}
              onRefresh={loadPersonnel}
              isLoading={loadingPersonnel}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
