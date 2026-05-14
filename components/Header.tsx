declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': any;
    }
  }
}

import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Sector, ViewMode, PERSONNEL_NAMES, SECTORS } from '../types';
import AutocompleteInput from './AutocompleteInput';

interface HeaderProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onGlobalSave: (currentSettings: AppSettings) => void;
  onGeneratePDF: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  currentSector: Sector;
  onSectorChange: (sector: Sector) => void;
  currentView: ViewMode;
  selectedDate: string;
  onDateChange: (date: string) => void;
  personnelOptions?: string[];
  operatorOptions?: string[];
  personnelStats?: { total: number; activos: number; inactivos: number };
}

const Header: React.FC<HeaderProps> = ({
  settings,
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
  personnelOptions,
  operatorOptions,
  personnelStats
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localDate, setLocalDate] = useState(selectedDate);
  const [liveTime, setLiveTime] = useState(new Date());
  const tempSettingsRef = useRef<AppSettings>(settings);

  useEffect(() => {
    setTempSettings(settings);
    tempSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setLocalDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 10000); // Update every 10 seconds to save some cycles
    return () => clearInterval(timer);
  }, []);

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
      setTimeout(() => setIsRefreshing(false), 1200);
    }
  };

  const scrollToSector = (sector: string) => {
    const element = document.getElementById(`sector-${sector.replace(/\s+/g, '-')}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isDashboard = currentView === 'DASHBOARD';
  const isPersonnel = currentView === 'PERSONNEL';
  const isStatistics = currentView === 'STATISTICS';
  const isReports = currentView === 'REPORTS';
  const isVisualization = currentView === 'VISUALIZATION';
  const isReten = currentView === 'RETEN';

  const labelStyle = "text-[11px] font-medium text-slate-400 uppercase tracking-widest block mb-1 whitespace-nowrap leading-none";
  const inputBaseStyle = "bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-primary transition-all cursor-pointer h-9 shadow-sm appearance-none flex items-center";
  const displayBoxStyle = "bg-white border border-slate-200 rounded-lg px-3 flex items-center cursor-pointer hover:border-primary hover:shadow-sm transition-all overflow-hidden shadow-sm h-9";
  const valueStyle = "text-[13px] font-medium text-[#002d5a] leading-none truncate uppercase";

  const getSectorCode = (sectorName: string) => {
    return sectorName.toUpperCase().replace('SECTOR ', '').trim();
  };

  // Even smaller buttons for Mobile/Tablet
  const btnIconStyle = "h-9 px-4 rounded-xl font-medium text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0";

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 backdrop-blur-lg bg-white/95 h-[72px]">
      <div className="max-w-[1920px] mx-auto h-full">
        <div className="px-4 h-full flex flex-row items-center justify-between gap-3 lg:gap-6">

          {/* Logo Section */}
          <div className="flex items-center justify-between lg:justify-start lg:gap-6 shrink-0">
            <div className="flex items-center">
              <div className="flex flex-col min-w-0">
                {isDashboard ? (
                  <div className="relative group/sector flex items-center max-w-[200px] md:max-w-none">
                    <select
                      value={currentSector}
                      onChange={(e) => onSectorChange(e.target.value as Sector)}
                      className="appearance-none bg-transparent text-[24px] font-medium text-[#002d5a] tracking-tighter uppercase leading-none pr-8 focus:outline-none cursor-pointer hover:text-primary transition-colors truncate"
                    >
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-2xl md:text-3xl text-[#002d5a] pointer-events-none group-hover/sector:scale-110 transition-transform">expand_more</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-[24px] font-medium text-[#002d5a] tracking-tighter uppercase leading-none truncate">
                      {isPersonnel ? 'VISTA DE PERSONAL' : isStatistics ? 'ESTADÍSTICAS OPERATIVAS' : currentView === 'REPORTS' ? 'CENTRO DE REPORTES' : isReten ? 'GESTIÓN DE RETENES' : 'VISTA DE DESPACHADOR'}
                    </h2>
                    {isVisualization && (
                      <span className="text-[14px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tight">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} | {liveTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                )}
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-widest mt-1 block">Gestión de Seguridad</span>
              </div>
            </div>
          </div>

          {/* Info Section */}
          {!isStatistics && !isVisualization && currentView !== 'REPORTS' && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:flex-1 lg:border-l lg:border-slate-100 lg:pl-8 min-w-0">
              {!isPersonnel && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col w-[110px] md:w-[150px]">
                    <span className={labelStyle}>FECHA</span>
                    <input
                      type="date"
                      value={localDate}
                      onChange={(e) => setLocalDate(e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== selectedDate) {
                          onDateChange(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className={inputBaseStyle.replace('shadow-sm appearance-none', 'shadow-sm')}
                    />
                  </div>
                  <div className="flex flex-col w-[85px] md:w-[110px]">
                    <span className={labelStyle}>TURNO</span>
                    <div className="relative">
                      <select value={settings.turno} onChange={(e) => updateTempField('turno', e.target.value)} onBlur={handleBlur} className={`${inputBaseStyle} w-full pr-8`}>
                        <option value="MAÑANA">MAÑANA</option>
                        <option value="TARDE">TARDE</option>
                        <option value="NOCHE">NOCHE</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex flex-wrap items-center gap-3 ${!isPersonnel ? 'lg:border-l lg:border-slate-100 lg:pl-6' : ''} flex-1 min-w-0`}>
                {isPersonnel && personnelStats ? (
                  <div className="flex items-center gap-6 bg-slate-50/80 px-4 rounded-xl border border-slate-200 h-12">
                    <div className="text-center">
                      <span className="text-[10px] font-medium text-slate-400 uppercase block leading-none m-1">Total</span>
                      <span className="text-[13px] font-medium text-slate-800 leading-none">{personnelStats.total}</span>
                    </div>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="text-center">
                      <span className="text-[10px] font-medium text-green-500 uppercase block leading-none m-1">Activos</span>
                      <span className="text-[13px] font-medium text-green-600 leading-none">{personnelStats.activos}</span>
                    </div>
                  </div>
                ) : !isReten ? (
                  <>
                    <div className="flex flex-col min-w-[110px] max-w-[200px] flex-1">
                      <span className={labelStyle}>OPERADOR</span>
                      {editingField === 'operador' ? (
                        <AutocompleteInput autoFocus value={tempSettings.operador} onChange={(v) => updateTempField('operador', v)} onBlur={handleBlur} placeholder="Buscar..." suggestions={operatorOptions || personnelOptions || PERSONNEL_NAMES} className="!h-9 !py-1 text-[13px] font-medium" />
                      ) : (
                        <div className={displayBoxStyle} onClick={() => setEditingField('operador')}><p className={valueStyle}>{settings.operador || '--'}</p></div>
                      )}
                    </div>
                    <div className="hidden sm:flex flex-col min-w-[110px] max-w-[200px] flex-1">
                      <span className={labelStyle}>SUPERVISOR</span>
                      {editingField === 'supervisor' ? (
                        <AutocompleteInput autoFocus value={tempSettings.supervisor} onChange={(v) => updateTempField('supervisor', v)} onBlur={handleBlur} placeholder="Buscar..." suggestions={operatorOptions || personnelOptions || PERSONNEL_NAMES} className="!h-9 !py-1 text-[13px] font-medium" />
                      ) : (
                        <div className={displayBoxStyle} onClick={() => setEditingField('supervisor')}><p className={valueStyle}>{settings.supervisor || '--'}</p></div>
                      )}
                    </div>
                    <div className="hidden xl:flex flex-col min-w-[110px] max-w-[200px] flex-1">
                      <span className={labelStyle}>PERMANENCIA</span>
                      {editingField === 'permanencia' ? (
                        <AutocompleteInput autoFocus value={tempSettings.permanencia} onChange={(v) => updateTempField('permanencia', v)} onBlur={handleBlur} placeholder="Buscar..." suggestions={operatorOptions || personnelOptions || PERSONNEL_NAMES} className="!h-9 !py-1 text-[13px] font-medium" />
                      ) : (
                        <div className={displayBoxStyle} onClick={() => setEditingField('permanencia')}><p className={valueStyle}>{settings.permanencia || '--'}</p></div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* Action Buttons Area */}
          {isVisualization ? (
            <div className="flex items-center gap-2 justify-end shrink-0" data-html2canvas-ignore>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">SECTORES:</span>
                {SECTORS.map((sector) => (
                  <a
                    key={sector}
                    href={`#sector-${sector.replace(/\s+/g, '-')}`}
                    className="px-2 py-1 text-[12px] font-medium uppercase tracking-tighter rounded transition-all hover:bg-blue-600 hover:text-white bg-slate-100 text-slate-600"
                  >
                    {getSectorCode(sector)}
                  </a>
                ))}
              </div>
              <button
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                title="Actualizar"
                className="h-9 px-4 bg-primary text-white rounded-lg font-medium text-[12px] uppercase tracking-wider flex items-center gap-2 shadow-sm hover:bg-primary-dark transition-all"
              >
                <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                ACTUALIZAR
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-end shrink-0 lg:ml-auto" data-html2canvas-ignore>
              <div className="flex items-center gap-2 justify-end w-full md:w-auto">
                {isDashboard ? (
                  <>
                    <button
                      onClick={handleRefreshClick}
                      disabled={isRefreshing || isSaving}
                      title="Sincronizar"
                      className={`${btnIconStyle} bg-slate-50 text-slate-400 hover:text-primary hover:bg-white hover:border-primary border border-transparent`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
                      <span className="hidden xl:inline">SINCRONIZAR</span>
                    </button>
                    <button
                      onClick={() => onGlobalSave(tempSettingsRef.current)}
                      disabled={isSaving || isRefreshing}
                      title="Guardar"
                      className={`${btnIconStyle} bg-primary hover:bg-primary-dark text-white xl:px-6 shadow-blue-100`}
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span className="hidden xl:inline">{isSaving ? 'GUARDANDO...' : 'GUARDAR'}</span>
                    </button>
                  </>
                ) : !isReports && !isReten ? (
                  <button
                    onClick={handleRefreshClick}
                    disabled={isRefreshing}
                    title="Actualizar"
                    className="h-9 px-6 bg-primary text-white rounded-xl font-medium text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-200 active:scale-95 transition-all"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                    <span className="hidden xl:inline">ACTUALIZAR DATOS</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
