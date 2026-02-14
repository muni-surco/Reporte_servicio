
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Sector, ViewMode } from '../types';
import { PERSONNEL_NAMES, SECTORS } from '../constants';
import AutocompleteInput from './AutocompleteInput';

interface HeaderProps {
  settings: AppSettings;
  totalPartes: number;
  onSaveSettings: (newSettings: AppSettings) => void;
  onGlobalSave: () => void;
  onGeneratePDF: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  currentSector: Sector;
  onSectorChange: (sector: Sector) => void;
  currentView: ViewMode;
  selectedDate: string;
  onDateChange: (date: string) => void;
  personnelOptions?: string[];
}

const Header: React.FC<HeaderProps> = ({
  settings,
  totalPartes,
  onSaveSettings,
  onGlobalSave,
  onGeneratePDF,
  onRefresh,
  isSaving,
  currentSector,
  onSectorChange,
  currentView,
  selectedDate,
  onDateChange,
  personnelOptions
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tempSettingsRef = useRef<AppSettings>(settings);

  useEffect(() => {
    setTempSettings(settings);
    tempSettingsRef.current = settings;
  }, [settings]);

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const handleBlur = () => {
    const currentTemp = tempSettingsRef.current;
    if (JSON.stringify(currentTemp) !== JSON.stringify(settings)) {
      onSaveSettings(currentTemp);
    }
    setEditingField(null);
  };

  const updateTempField = (field: keyof AppSettings, value: string) => {
    const updated = { ...tempSettingsRef.current, [field]: value };
    setTempSettings(updated);
    tempSettingsRef.current = updated;
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      onRefresh();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const scrollToSector = (sector: string) => {
    const element = document.getElementById(`sector-${sector.replace(/\s+/g, '-')}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isDashboard = currentView === 'DASHBOARD';

  // Estilos para Dashboard
  const infoLabelStyle = "text-[9px] font-black text-[#004b93] uppercase tracking-wider block mb-0.5";
  const displayBoxStyle = "bg-white border border-slate-200 rounded-md px-2 py-1 min-h-[28px] flex items-center cursor-pointer hover:border-[#004b93] hover:shadow-sm transition-all group/box";
  const infoValueStyle = "text-[10px] font-medium text-slate-800 leading-none truncate group-hover/box:text-[#004b93]";

  // Estilos para Vista de Reporte (Labels grandes)
  const reportLabelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1";
  const reportValueStyle = "text-[18px] font-black text-[#002d5a] leading-none uppercase tracking-tight";

  const getSectorCode = (sectorName: string) => {
    return sectorName.toUpperCase().replace('SECTOR ', '').trim();
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm z-20 sticky top-0 backdrop-blur-md">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6 flex-1 min-w-0">

          <div className="flex flex-col min-w-[200px] shrink-0">
            {isDashboard ? (
              <div className="relative group/sector flex items-center">
                <select
                  value={currentSector}
                  onChange={(e) => onSectorChange(e.target.value as Sector)}
                  className="appearance-none bg-transparent text-2xl font-black text-[#002d5a] tracking-tighter uppercase leading-none pr-10 focus:outline-none cursor-pointer hover:text-[#004b93] transition-colors"
                >
                  {SECTORS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[28px] text-[#004b93] pointer-events-none group-hover/sector:scale-110 transition-transform">expand_more</span>
              </div>
            ) : (
              <h2 className="text-2xl font-black text-[#002d5a] tracking-tighter uppercase leading-none">
                REPORTE INTEGRADO MSS
              </h2>
            )}
          </div>

          <div className="h-10 w-px bg-slate-200 shrink-0"></div>

          <div className="flex gap-8 items-center flex-1 min-w-0">
            {/* FECHA */}
            <div className="flex-shrink-0">
              <span className={isDashboard ? infoLabelStyle : reportLabelStyle}>FECHA</span>
              <div className="relative group/date">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="appearance-none min-h-[28px] bg-slate-50 border border-slate-200 rounded-md px-3 py-1 text-[11px] font-medium text-slate-700 leading-none focus:outline-none focus:border-[#004b93] focus:ring-1 focus:ring-[#004b93] transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* TURNO */}
            <div className="flex-shrink-0 min-w-[85px]">
              <span className={isDashboard ? infoLabelStyle : reportLabelStyle}>TURNO</span>
              <div className="relative group/turno">
                <select
                  value={settings.turno}
                  onChange={(e) => updateTempField('turno', e.target.value)}
                  onBlur={handleBlur}
                  className="appearance-none min-h-[28px] bg-slate-50 border border-slate-200 rounded-md px-3 py-1 pr-8 text-[11px] font-medium text-slate-700 leading-none focus:outline-none focus:border-[#004b93] focus:ring-1 focus:ring-[#004b93] transition-all cursor-pointer w-full"
                >
                  <option value="MAÑANA">MAÑANA</option>
                  <option value="TARDE">TARDE</option>
                  <option value="NOCHE">NOCHE</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* OPERADOR / PERMANENCIA */}
            <div className="flex-shrink-0 min-w-[130px] max-w-[300px]">
              <span className={isDashboard ? infoLabelStyle : reportLabelStyle}>{isDashboard ? 'OPERADOR' : 'PERMANENCIA'}</span>
              {isDashboard ? (
                editingField === 'operador' ? (
                  <AutocompleteInput
                    autoFocus
                    value={tempSettings.operador}
                    onChange={(v) => updateTempField('operador', v)}
                    onBlur={handleBlur}
                    placeholder="Nombre Operador..."
                    suggestions={personnelOptions && personnelOptions.length > 0 ? personnelOptions : PERSONNEL_NAMES}
                  />
                ) : (
                  <div className={displayBoxStyle} onClick={() => setEditingField('operador')}>
                    <p className={infoValueStyle}>{settings.operador || '--'}</p>
                  </div>
                )
              ) : (
                <p className={reportValueStyle}>{settings.permanencia || '--'}</p>
              )}
            </div>

            {isDashboard ? (
              <>
                <div className="flex-1 min-w-[130px] max-w-[180px]">
                  <span className={infoLabelStyle}>SUPERVISOR</span>
                  {editingField === 'supervisor' ? (
                    <AutocompleteInput
                      autoFocus
                      value={tempSettings.supervisor}
                      onChange={(v) => updateTempField('supervisor', v)}
                      onBlur={handleBlur}
                      placeholder="Nombre Supervisor..."
                      suggestions={personnelOptions && personnelOptions.length > 0 ? personnelOptions : PERSONNEL_NAMES}
                    />
                  ) : (
                    <div className={displayBoxStyle} onClick={() => setEditingField('supervisor')}>
                      <p className={infoValueStyle}>{settings.supervisor || '--'}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-[130px] max-w-[180px]">
                  <span className={infoLabelStyle}>PERMANENCIA</span>
                  {editingField === 'permanencia' ? (
                    <AutocompleteInput
                      autoFocus
                      value={tempSettings.permanencia}
                      onChange={(v) => updateTempField('permanencia', v)}
                      onBlur={handleBlur}
                      placeholder="Nombre..."
                      suggestions={personnelOptions && personnelOptions.length > 0 ? personnelOptions : PERSONNEL_NAMES}
                    />
                  ) : (
                    <div className={displayBoxStyle} onClick={() => setEditingField('permanencia')}>
                      <p className={infoValueStyle}>{settings.permanencia || '--'}</p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 flex flex-col items-center justify-center min-w-[80px] shadow-sm ml-2 shrink-0">
                  <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest block leading-none mb-0.5">TOTAL PARTES</span>
                  <p className="text-sm font-black text-amber-700 leading-none">{totalPartes}</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col min-w-0 pl-8 border-l border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`${infoLabelStyle} text-left mb-0`}>IR A SECTOR</span>
                </div>
                <div className="flex items-center justify-start gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full">
                  {SECTORS.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => scrollToSector(sector)}
                      className="shrink-0 bg-white border border-slate-200 hover:border-[#004b93] hover:text-[#004b93] text-slate-800 px-2.5 py-1 rounded text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-tighter active:scale-95 shadow-sm min-w-[40px] text-center"
                    >
                      {getSectorCode(sector)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ml-4 flex items-center gap-2 pr-4 shrink-0" data-html2canvas-ignore>
          {isDashboard ? (
            <>
              <button
                onClick={onGlobalSave}
                disabled={isSaving}
                className={`bg-[#004b93] hover:bg-[#002d5a] text-white px-4 py-2 rounded-lg font-black text-[12px] flex items-center gap-1.5 shadow-lg shadow-[#004b93]/20 transition-all active:scale-95 group ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <span className={`material-symbols-outlined text-[16px] ${isSaving ? 'animate-spin' : ''}`}>
                  {isSaving ? 'sync' : 'save'}
                </span>
                {isSaving ? 'GUARDANDO...' : 'GUARDAR'}
              </button>
              <button
                onClick={onGeneratePDF}
                className="bg-[#00a19b] hover:bg-[#007a75] text-white px-4 py-2 rounded-lg font-black text-[12px] flex items-center gap-1.5 shadow-lg shadow-[#00a19b]/20 transition-all active:scale-95 group"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                REPORTE
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className={`bg-[#004b93] hover:bg-[#002d5a] text-white px-4 py-2 rounded-lg font-black text-[12px] flex items-center gap-1.5 shadow-lg shadow-[#004b93]/20 transition-all active:scale-95 group ${isRefreshing ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                {isRefreshing ? 'ACTUALIZANDO...' : 'ACTUALIZAR'}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
