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
import EquipmentPopover from './EquipmentPopover';

interface HeaderProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onGlobalSave: (currentSettings: AppSettings) => void;
  onHeaderSave: (currentSettings: AppSettings) => void;
  onGeneratePDF: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  headerSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  currentSector: Sector;
  onSectorChange: (sector: Sector) => void;
  currentView: ViewMode;
  selectedDate: string;
  onDateChange: (date: string) => void;
  personnelOptions?: string[];
  operatorOptions?: string[];
  personnelStats?: { total: number; activos: number; inactivos: number };
  readOnly?: boolean;
  hasPendingChanges?: boolean;
  forceHeaderError?: boolean;
  codigoTaserOptions?: string[];
  codigoBodycamOptions?: string[];
  codigoTaserSuggestions?: string[];
  codigoBodycamSuggestions?: string[];
  radioOptions?: string[];
  motivoFaltoOptions?: string[];
}

  const Header: React.FC<HeaderProps> = ({
    settings,
    onSaveSettings,
    onGlobalSave,
    onHeaderSave,
    onGeneratePDF,
    onRefresh,
    isSaving,
    headerSaveStatus,
    currentSector,
    onSectorChange,
    currentView,
    selectedDate,
    onDateChange,
    personnelOptions,
    operatorOptions,
    personnelStats,
    readOnly,
    hasPendingChanges,
    forceHeaderError,
    codigoTaserOptions,
    codigoBodycamOptions,
    codigoTaserSuggestions,
    codigoBodycamSuggestions,
    radioOptions,
    motivoFaltoOptions,
  }) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localDate, setLocalDate] = useState(selectedDate);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [equipPopover, setEquipPopover] = useState<'supervisor' | 'permanencia' | null>(null);
  const supervisorEquipRef = useRef<HTMLSpanElement>(null);
  const permanenciaEquipRef = useRef<HTMLSpanElement>(null);
  const supervisorColRef = useRef<HTMLDivElement>(null);
  const permanenciaColRef = useRef<HTMLDivElement>(null);
  const tempSettingsRef = useRef<AppSettings>(settings);

  const normalizeRequiredField = (value: string) => {
    const trimmed = String(value || '').trim();
    return trimmed === '--' ? '' : trimmed;
  };

  useEffect(() => {
    const normalized = {
      ...settings,
      operador: normalizeRequiredField(settings.operador),
      supervisor: normalizeRequiredField(settings.supervisor),
      permanencia: normalizeRequiredField(settings.permanencia)
    };
    setTempSettings(normalized);
    tempSettingsRef.current = normalized;
  }, [settings]);

  useEffect(() => {
    setLocalDate(selectedDate);
  }, [selectedDate]);

  const validateFields = (): boolean => {
    const s = tempSettingsRef.current;
    const errors: Record<string, boolean> = {};
    if (!normalizeRequiredField(s.operador)) errors.operador = true;
    const supAbsent = s.supervisorEstado === 'Falto' || s.supervisorEstado === 'Sin Supervision';
    if (!supAbsent && !normalizeRequiredField(s.supervisor)) errors.supervisor = true;
    const permAbsent = s.permanenciaEstado === 'Falto' || s.permanenciaEstado === 'Sin Supervision';
    if (!permAbsent && !normalizeRequiredField(s.permanencia)) errors.permanencia = true;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = () => {
    const currentTemp = tempSettingsRef.current;
    if (JSON.stringify(currentTemp) !== JSON.stringify(settings)) {
      onSaveSettings(currentTemp);
    }
    setEditingField(null);
  };

  const updateTempField = (field: keyof AppSettings, value: string) => {
    const updated = { ...tempSettingsRef.current, [field]: normalizeRequiredField(value) };
    setTempSettings(updated);
    tempSettingsRef.current = updated;
    setFieldErrors(prev => ({ ...prev, [field]: false }));
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
  const isVehicleSearch = currentView === 'VEHICLE_SEARCH';
  const isMap = currentView === 'MAP';
  const isWanted = currentView === 'WANTED';

  const labelStyle = "text-[11px] font-medium text-slate-400 uppercase tracking-widest block mb-1 whitespace-nowrap leading-none";
  const inputBaseStyle = "bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-primary transition-all cursor-pointer h-9 shadow-sm appearance-none flex items-center";
  const displayBoxStyle = "bg-slate-50 border border-slate-200 rounded-lg px-3 flex items-center cursor-pointer hover:border-primary hover:shadow-sm transition-all overflow-hidden shadow-sm h-9";
  const valueStyle = "text-[13px] font-medium text-[#002d5a] leading-none truncate uppercase";
  const showRequiredError = !!forceHeaderError;
  const isFieldMissing = (field: keyof AppSettings) => showRequiredError && !normalizeRequiredField(tempSettings[field]);

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
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-slate-400 uppercase tracking-widest shrink-0">SECTOR</span>
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
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-[24px] font-medium text-[#002d5a] tracking-tighter uppercase leading-none truncate">
                      {isPersonnel ? 'VISTA DE PERSONAL' : isStatistics ? 'ESTADÍSTICAS OPERATIVAS' : currentView === 'REPORTS' ? 'CENTRO DE REPORTES' : isReten ? 'GESTIÓN DE RETENES' : isVehicleSearch ? 'BUSCADOR DE VEHÍCULOS SOSPECHOSOS' : isMap ? 'MAPA DE CUADRANTES' : isWanted ? 'BASE DE DATOS ROSTROS BUSCADOS' : 'VISTA DE DESPACHADOR'}
                    </h2>
                    {(isVisualization || isStatistics || isMap) && (
                      <span className="text-[16px] font-bold text-blue-700 bg-blue-50/50 px-3 py-1 rounded-xl border border-blue-100 uppercase tracking-tighter flex items-center gap-3 leading-none">
                        <span className="text-blue-400 font-medium leading-none">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        <div className="w-1 h-1 bg-blue-200 rounded-full shrink-0"></div>
                        <span className="leading-none">TURNO: {settings.turno}</span>
                      </span>
                    )}
                  </div>
                )}
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-widest mt-1 block">Gestión de Seguridad</span>
              </div>
            </div>
          </div>

          {/* Info Section */}
          {!isStatistics && !isVisualization && currentView !== 'REPORTS' && !isVehicleSearch && !isMap && !isWanted && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:flex-1 lg:border-l lg:border-slate-100 lg:pl-8 min-w-0">
              {!isPersonnel && (
                <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border border-blue-100 p-2 rounded-2xl shadow-sm shrink-0">
                  {/* Campo Fecha */}
                  <div className="flex items-center gap-2 px-2">
                    <span className="material-symbols-outlined text-primary text-[20px] shrink-0 select-none">calendar_today</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">FECHA</span>
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
                        className="bg-transparent border-none text-[13px] font-bold text-[#002d5a] focus:outline-none p-0 cursor-pointer h-5 w-[120px] md:w-[125px] focus:ring-0 leading-none"
                      />
                    </div>
                  </div>

                  {/* Divisor Vertical */}
                  <div className="w-px h-8 bg-blue-100/80"></div>

                  {/* Selector de Turnos Segmentado */}
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">TURNO</span>
                    <div className="bg-slate-200/60 p-0.5 rounded-lg flex items-center gap-0.5 h-6 mt-0.5 select-none">
                      {['MAÑANA', 'TARDE', 'NOCHE'].map((t) => {
                        const isActive = settings.turno === t;
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              const updated = { ...tempSettingsRef.current, turno: t };
                              setTempSettings(updated);
                              tempSettingsRef.current = updated;
                              onSaveSettings(updated);
                            }}
                            className={`px-2.5 h-full rounded text-[11px] font-bold tracking-wider transition-all duration-200 uppercase ${
                              isActive
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-300/40'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
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
                      {!readOnly && editingField === 'operador' ? (
                        <AutocompleteInput autoFocus value={tempSettings.operador} onChange={(v) => updateTempField('operador', v)} onBlur={handleBlur} placeholder="Buscar..." suggestions={operatorOptions || personnelOptions || PERSONNEL_NAMES} className="!h-9 !py-1 text-[13px] font-medium" error={!!fieldErrors.operador} strict />
                      ) : (
                        <div className={`${displayBoxStyle} ${fieldErrors.operador || isFieldMissing('operador') ? 'border-red-400 bg-red-50' : ''}`} onClick={() => { setEditingField('operador'); setFieldErrors(prev => ({ ...prev, operador: false })); }}><p className={valueStyle}>{normalizeRequiredField(settings.operador) || <span className="text-slate-300 italic">SELECCIONAR...</span>}</p></div>
                      )}
                      {(fieldErrors.operador || isFieldMissing('operador')) && <span className="text-[10px] text-red-500 font-medium mt-0.5">Requerido</span>}
                    </div>
                    <div className="hidden sm:flex flex-col min-w-[180px] max-w-[320px] flex-1" ref={supervisorColRef}>
                      <span className={labelStyle}>{settings.supervisorRol === 'DESPACHADOR' ? 'DESPACHADOR SECTOR' : 'SUPERVISOR'}</span>
                      {(() => {
                        const supName = normalizeRequiredField(settings.supervisor);
                        const supEstado = settings.supervisorEstado || '';
                        const supEncargado = normalizeRequiredField(settings.supervisorEncargado || '');
                        const isAbsent = supEstado === 'Falto' || supEstado === 'Sin Supervision';
                        const displayName = (isAbsent && supEncargado) ? supEncargado : supName;
                        const roleBadge = (isAbsent && supEncargado) ? 'ENCARGADO' : 'SUPERVISOR';
                        return (
                          <div className={`${displayBoxStyle} ${fieldErrors.supervisor || isFieldMissing('supervisor') ? 'border-red-400 bg-red-50' : ''}`}>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEquipPopover('supervisor'); }}>
                              <p className={valueStyle}>{displayName || <span className="text-slate-300 italic">SELECCIONAR...</span>}</p>
                            </div>
                            {!readOnly && (
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${roleBadge === 'SUPERVISOR' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {roleBadge}
                              </span>
                            )}
                            {settings.supervisorTaser === 'SI' && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-blue-100 text-blue-700">taser</span>
                            )}
                            {supName && (
                              <span ref={supervisorEquipRef} onClick={(e) => { e.stopPropagation(); setEquipPopover('supervisor'); }} className="ml-1 text-slate-300 hover:text-blue-600 cursor-pointer transition-colors shrink-0 material-symbols-outlined text-[16px]">arrow_drop_down</span>
                            )}
                          </div>
                        );
                      })()}
                      {(fieldErrors.supervisor || isFieldMissing('supervisor')) && <span className="text-[10px] text-red-500 font-medium mt-0.5">Requerido</span>}
                    </div>
                    <div className="hidden xl:flex flex-col min-w-[110px] max-w-[200px] flex-1" ref={permanenciaColRef}>
                      <span className={labelStyle}>{settings.turno === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA'}</span>
                      {(() => {
                        const permName = normalizeRequiredField(settings.permanencia);
                        const permEstado = settings.permanenciaEstado || '';
                        const permEncargado = normalizeRequiredField(settings.permanenciaEncargado || '');
                        const isPermAbsent = permEstado === 'Falto' || permEstado === 'Sin Supervision';
                        const displayPermName = (isPermAbsent && permEncargado) ? permEncargado : permName;
                        const roleLabel = settings.turno === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA';
                        const roleBadge = (isPermAbsent && permEncargado) ? 'ENCARGADO' : roleLabel;
                        return (
                          <div className={`${displayBoxStyle} ${fieldErrors.permanencia || isFieldMissing('permanencia') ? 'border-red-400 bg-red-50' : ''}`}>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEquipPopover('permanencia'); }}>
                              <p className={valueStyle}>{displayPermName || <span className="text-slate-300 italic">SELECCIONAR...</span>}</p>
                            </div>
                            {!readOnly && (
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${roleBadge === 'ENCARGADO' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {roleBadge}
                              </span>
                            )}
                            {settings.permanenciaTaser === 'SI' && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-blue-100 text-blue-700">taser</span>
                            )}
                            {(permName || displayPermName) && (
                              <span ref={permanenciaEquipRef} onClick={(e) => { e.stopPropagation(); setEquipPopover('permanencia'); }} className="ml-1 text-slate-300 hover:text-blue-600 cursor-pointer transition-colors shrink-0 material-symbols-outlined text-[16px]">arrow_drop_down</span>
                            )}
                          </div>
                        );
                      })()}
                      {(fieldErrors.permanencia || isFieldMissing('permanencia')) && <span className="text-[10px] text-red-500 font-medium mt-0.5">Requerido</span>}
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => {
                          if (!validateFields()) {
                            // Do not close editing if validation fails
                            return;
                          }
                          onHeaderSave(tempSettingsRef.current);
                        }}
                        disabled={isSaving || isRefreshing}
                        title="Guardar"
                        className={`h-9 px-4 rounded-xl font-medium text-[12px] uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all shrink-0 max-xl:hidden ${
                          headerSaveStatus === 'saved'
                            ? 'bg-green-500 text-white'
                            : headerSaveStatus === 'saving'
                            ? 'bg-primary/60 text-white cursor-wait'
                            : 'bg-primary hover:bg-primary-dark text-white'
                        }`}
                      >
                        {headerSaveStatus === 'saved' ? (
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        ) : headerSaveStatus === 'saving' ? (
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">save</span>
                        )}
                      </button>
                    )}
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
                {hasPendingChanges && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg" title="Hay cambios sin guardar o guardados pendientes">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                    <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Guardando</span>
                  </div>
                )}
                {isDashboard ? (
                  <>
                    {!readOnly && (
                      <button
                        onClick={handleRefreshClick}
                        disabled={isRefreshing || isSaving}
                        title="Sincronizar"
                        className={`${btnIconStyle} hidden bg-slate-50 text-slate-400 hover:text-primary hover:bg-white hover:border-primary border border-transparent max-[1399px]:hidden`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
                        <span className="hidden xl:inline">SINCRONIZAR</span>
                      </button>
                    )}
                  </>
                ) : !isReports && !isReten && !isVehicleSearch ? (
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
      {equipPopover && (
        <EquipmentPopover
          key={equipPopover}
          fieldPrefix={equipPopover}
          personName={normalizeRequiredField(equipPopover === 'supervisor' ? settings.supervisor : settings.permanencia)}
          settings={tempSettingsRef.current}
          onSave={(s) => { onHeaderSave(s); setTempSettings(s); tempSettingsRef.current = s; setEquipPopover(null); }}
          onClose={() => setEquipPopover(null)}
          anchorEl={equipPopover === 'supervisor' ? supervisorEquipRef.current : permanenciaEquipRef.current}
          fieldEl={equipPopover === 'supervisor' ? supervisorColRef.current : permanenciaColRef.current}
          codigoTaserOptions={codigoTaserOptions}
          codigoBodycamOptions={codigoBodycamOptions}
          codigoTaserSuggestions={codigoTaserSuggestions}
          codigoBodycamSuggestions={codigoBodycamSuggestions}
          radioOptions={radioOptions}
          personnelOptions={personnelOptions}
          motivoFaltoOptions={motivoFaltoOptions}
        />
      )}
    </header>
  );
};

export default Header;
