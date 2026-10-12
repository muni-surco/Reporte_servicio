
import React, { useMemo, useState } from 'react';
import { UnitData, AppSettings, UnitStatus, SECTORS, isTacticoPPFFStatus, isOtrasAreasSector } from '../types';

// Quitar tildes sin cambiar la longitud del string, para que los índices del
// texto normalizado sigan alineados con el texto original al resaltar.
const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c'
};
const stripAccents = (v: unknown) =>
  String(v ?? '').toLowerCase().replace(/[^\u0000-\u007f]/g, c => ACCENT_MAP[c] || c);

// Coincidencia del buscador global: id de móvil, nombres del personal y radio.
const unitMatchesQuery = (u: UnitData, qNorm: string) => {
  if (!qNorm) return true;
  return [u.id, u.personnel1, u.personnel2, u.radio]
    .some(field => stripAccents(field).includes(qNorm));
};

// Resalta la primera coincidencia del término buscado dentro del texto.
const Highlight: React.FC<{ text: unknown; query: string }> = ({ text, query }) => {
  const value = String(text ?? '');
  const qNorm = stripAccents(query.trim());
  if (!qNorm) return <>{value}</>;
  const idx = stripAccents(value).indexOf(qNorm);
  if (idx === -1) return <>{value}</>;
  return (
    <>
      {value.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded-[2px] px-[1px]">{value.slice(idx, idx + qNorm.length)}</mark>
      {value.slice(idx + qNorm.length)}
    </>
  );
};

interface VisualizationViewProps {
  allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }>;
  settings: AppSettings;
  mobileData: { id: string; plate: string; radio?: string; quadrant?: string; sector?: string; }[];
  highlightMissingHeader?: boolean;
}

const VisualizationView: React.FC<VisualizationViewProps> = ({ allSectorsData, settings, mobileData, highlightMissingHeader }) => {
  // Buscador global del despachador: filtra las tarjetas por id, nombre o radio.
  const [searchQuery, setSearchQuery] = useState('');
  const searchNorm = stripAccents(searchQuery.trim());

  // Mismas reglas que el filtro de la vista: solo unidades visibles.
  const ALLOWED_STATUSES = [
    UnitStatus.PATRULLANDO,
    UnitStatus.SIN_VEHICULO,
  ];
  const isRenderedUnit = (u: UnitData) =>
    ALLOWED_STATUSES.includes(u.status) ||
    (u.status === UnitStatus.SIN_DOCUMENTOS && u.type === 'CHOFER') ||
    isTacticoPPFFStatus(u.status);

  // Totales para el contador del buscador: sin filtro muestra el total del
  // turno (X de X); con filtro, las coincidencias sobre ese total.
  const { totalMatches, totalVisible } = useMemo(() => {
    let matches = 0;
    let visible = 0;
    SECTORS.forEach(sectorName => {
      const data = allSectorsData[sectorName];
      if (!data) return;
      data.units.forEach(u => {
        if (!isRenderedUnit(u)) return;
        visible += 1;
        if (!searchNorm || unitMatchesQuery(u, searchNorm)) matches += 1;
      });
    });
    return { totalMatches: matches, totalVisible: visible };
  }, [searchNorm, allSectorsData]);

  const redStatusPatterns = [
    UnitStatus.MANTENIMIENTO,
    UnitStatus.DESPERFECTOS,
    UnitStatus.SINIESTRO,
    UnitStatus.FALTO,
  ];

  const amberStatusPatterns = [
    UnitStatus.SIN_DOCUMENTOS,
    UnitStatus.SIN_CONDUCTOR,
    UnitStatus.SIN_VEHICULO,
    UnitStatus.SIN_OPERADOR,
  ];

  const getStatusColor = (status: string) => {
    if (status === UnitStatus.PATRULLANDO) return "bg-green-500 ring-2 ring-green-200";
    if (status === UnitStatus.APOYO_OTRA_AREA) return "bg-blue-500 ring-2 ring-blue-200";
    if (isTacticoPPFFStatus(status)) return "bg-blue-500 ring-2 ring-blue-200";
    if (redStatusPatterns.includes(status)) return "bg-red-500 ring-2 ring-red-200";
    if (amberStatusPatterns.includes(status)) return "bg-amber-500 ring-2 ring-amber-200";
    return "bg-slate-300 ring-2 ring-slate-100";
  };


  const renderCompactUnit = (u: UnitData, type: string) => {
    const idTextColor = {
      CHOFER: 'text-[#004b93]',
      MOTO: 'text-violet-700',
      SERENO: 'text-teal-700'
    }[type];

    const refInfo = mobileData?.find(m => m.id === u.id);
    const displayRadio = u.radio || '--';
    const displayQuadrant = u.quadrant || refInfo?.quadrant || '--';

    return (
      <div key={u.id} className="flex items-center gap-4 py-3 px-4 hover:bg-blue-50/50 border-b border-slate-100 last:border-0 transition-colors group odd:bg-white even:bg-slate-50/50">
        {/* Indicador de Estado */}
        <div className={`w-4 h-4 rounded-full shrink-0 ${getStatusColor(u.status)} shadow-sm border border-white transition-transform group-hover:scale-125`} title={u.status}></div>

        {/* ID de Unidad */}
        <span className={`text-[13px] font-medium min-w-[45px] text-center ${idTextColor} uppercase tracking-tighter`}>
          <Highlight text={u.id} query={searchQuery} />
        </span>

        {/* Contenedor de información */}
        <div className="flex-1 flex items-center justify-between min-w-0 gap-6">
          <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-800 truncate uppercase tracking-tight flex items-center gap-2">
                <Highlight text={u.personnel1 || (isTacticoPPFFStatus(u.status) && u.personnel2)} query={searchQuery} />
                {u.taser === 'SI' && (
                  <span className="inline-flex items-center px-1.5 py-[1px] rounded text-[8px] font-bold uppercase tracking-wider bg-blue-100 text-[#005ea5] border border-blue-200 leading-none shrink-0">
                    TASER
                  </span>
                )}
              </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {u.lugarEstado && (
                  <span className="text-[9px] font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded uppercase leading-none border border-yellow-200">
                    {u.lugarEstado}
                  </span>
                )}
                {u.motivoEstado && (
                  <span className="text-[9px] font-medium bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded uppercase leading-none border border-orange-200">
                    {u.motivoEstado}
                  </span>
                )}
                {u.mechanics && (
                  <span className="text-[9px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase leading-none border border-slate-200">
                    {u.mechanics}
                  </span>
                )}
              </div>
            {u.type === 'CHOFER' && (u.indicative || u.personnel2) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {u.indicative && (
                  <span className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 leading-none shrink-0">
                    {u.indicative}
                  </span>
                )}
                {u.personnel2 && (
                  <span className="text-[10px] text-slate-500 truncate uppercase leading-none">
                    <Highlight text={u.personnel2} query={searchQuery} />
                  </span>
                )}
              </div>
            )}
            </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="flex flex-col items-end min-w-[60px]">
              <span className="text-[11px] font-medium text-slate-400 tracking-tighter uppercase leading-none mb-1">RADIO</span>
              <span className="text-[13px] font-medium text-slate-700 font-mono leading-none"><Highlight text={displayRadio} query={searchQuery} /></span>
            </div>
            {u.sector !== 'RESCATE' && (
              <div className="flex flex-col items-end min-w-[70px] border-l border-slate-200 pl-6">
                <span className="text-[11px] font-medium text-slate-400 tracking-tighter uppercase leading-none mb-1">CUADRANTE</span>
                <span className="text-[13px] font-medium text-slate-900 leading-none">{displayQuadrant}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const infoLabelStyle = "text-[11px] font-medium text-[#004b93] uppercase tracking-wider mb-0.5 block";
  const infoValueStyle = "text-[13px] font-medium text-slate-800 uppercase truncate leading-none bg-transparent border-none p-0 cursor-default";

  return (
    <div className="flex flex-col gap-6 mx-auto">
      {/* Buscador global (id, nombres y radios). top negativo: el sticky se
          ancla al borde del padding box del scroller (que tiene pt-4), así la
          barra queda pegada al header en lugar de 16px más abajo. */}
      <div className="sticky top-[-16px] z-20 -mx-4 -mt-4 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_2px_14px_rgba(2,45,90,0.07)]">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de búsqueda */}
          <div className="relative flex-1 min-w-[220px] max-w-2xl group">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg bg-[#E6EEF5] text-[#005ea5] transition-colors group-focus-within:bg-[#005ea5] group-focus-within:text-white">
              <span className="material-symbols-outlined text-[19px] leading-none">search</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por móvil, nombre o radio..."
              aria-label="Buscar por móvil, nombre o radio"
              className="w-full h-11 pl-12 pr-11 text-[13px] uppercase tracking-tight text-slate-800 bg-slate-50 border border-slate-200 rounded-xl transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005ea5]/25 focus:border-[#005ea5] placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Borrar texto buscado"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-slate-200/80 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px] leading-none">close</span>
              </button>
            )}
          </div>

          {/* Contador de resultados (siempre visible) */}
          <span className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-[#005ea5] text-white text-[12px] font-semibold uppercase tracking-wider shadow-sm shadow-blue-200/60 shrink-0">
            <span className="material-symbols-outlined text-[16px] leading-none">manage_search</span>
            {totalMatches} de {totalVisible} unidades
          </span>

          {/* Limpiar filtro (siempre visible; deshabilitado sin filtro activo) */}
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            disabled={!searchNorm}
            aria-disabled={!searchNorm}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-slate-300 bg-white text-[12px] font-semibold uppercase tracking-wider text-slate-600 transition-colors shrink-0 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-white disabled:hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">filter_alt_off</span>
            Limpiar filtro
          </button>
        </div>
      </div>

      {searchNorm && totalMatches === 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-6 py-14 text-center">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-300 mb-3">
            <span className="material-symbols-outlined text-[36px] leading-none">search_off</span>
          </span>
          <p className="text-[13px] text-slate-500 uppercase tracking-widest font-medium">Sin coincidencias para «{searchQuery.trim()}»</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center gap-1.5 mt-5 h-10 px-4 rounded-full bg-[#005ea5] text-white text-[12px] font-semibold uppercase tracking-wider shadow-sm shadow-blue-200/60 hover:bg-[#003D6B] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">restart_alt</span>
            Limpiar filtro
          </button>
        </div>
      )}

      {SECTORS.map((sectorName) => {
        const data = allSectorsData[sectorName];
        if (!data) return null;
        // Con búsqueda activa: solo se muestran sectores con coincidencias.
        const sectorUnits = searchNorm
          ? data.units.filter(u => unitMatchesQuery(u, searchNorm))
          : data.units;
        if (searchNorm && sectorUnits.length === 0) return null;
        const safeSettings = data.settings || {
          nombrePuesto: sectorName,
          operador: '',
          supervisor: '',
          supervisorRol: 'SUPERVISOR',
          supervisorEstado: '',
          supervisorEncargado: '',
          supervisorTaser: '',
          permanencia: '',
          permanenciaTaser: '',
          permanenciaEstado: '',
          permanenciaEncargado: '',
          turno: settings.turno,
          ipServidor: '',
          version: ''
        };

        const activeUnits = sectorUnits.filter(u => isRenderedUnit(u));
        const choferes = activeUnits.filter(u => u.type === 'CHOFER');
        const motos = activeUnits.filter(u => u.type === 'MOTO');
        const serenos = activeUnits.filter(u => u.type === 'SERENO');
        const isRescate = sectorName === 'RESCATE';
        const isTechnical = sectorName === 'C4' || sectorName === 'COVV';
        const isOtrasAreas = isOtrasAreasSector(sectorName);
        const missingHeaderClass = highlightMissingHeader
          ? 'border-red-200 bg-red-50/60 text-red-700'
          : 'border-slate-100 bg-white text-slate-700';

        return (
          <div
            key={sectorName}
            id={`sector-${sectorName.replace(/\s+/g, '-')}`}
            className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col transition-all scroll-mt-24 hover:shadow-xl hover:border-blue-200"
          >
            {/* Cabecera de Sector Unificada */}
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4 shrink-0">
              <div className="flex items-center gap-8">
                {/* SECTOR */}
                <div className="flex items-center gap-3 shrink-0 min-w-[140px]">
                  <div className="w-2 h-8 bg-[#004b93] rounded-full shadow-sm shadow-blue-200"></div>
                  <h2 className="text-[24px] font-medium tracking-tighter uppercase text-[#002d5a] leading-none">
                    {sectorName === 'GIR' || sectorName === 'RESCATE' || sectorName === 'C4' || sectorName === 'COVV' || isOtrasAreasSector(sectorName) ? sectorName : `SECTOR ${sectorName}`}
                  </h2>
                </div>

                <div className="h-8 w-px bg-slate-200 shrink-0"></div>

                {/* INFO PERSONAL */}
                <div className="flex gap-12 flex-1 min-w-0">
                  <div className={`flex flex-col min-w-[180px] rounded-xl border px-3 py-2 transition-colors ${missingHeaderClass}`}>
                    <span className={infoLabelStyle}>OPERADOR EN TURNO</span>
                    <span className={`${infoValueStyle} ${highlightMissingHeader && !safeSettings.operador ? 'text-red-600' : ''}`}>{safeSettings.operador || 'NO ASIGNADO'}</span>
                  </div>

                  <div className={`flex flex-col min-w-[180px] rounded-xl border px-3 py-2 transition-colors ${missingHeaderClass}`}>
                    <span className={infoLabelStyle}>
                      {(safeSettings.supervisorEstado === 'Falto' || safeSettings.supervisorEstado === 'Sin Supervision') && safeSettings.supervisorEncargado
                        ? 'ENCARGADO SECTOR'
                        : safeSettings.supervisorRol === 'DESPACHADOR'
                          ? 'DESPACHADOR SECTOR'
                          : 'SUPERVISOR SECTOR'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`${infoValueStyle} ${highlightMissingHeader && !safeSettings.supervisor && safeSettings.supervisorEstado !== 'Sin Supervision' ? 'text-red-600' : ''}`}>
                        {(safeSettings.supervisorEstado === 'Falto' || safeSettings.supervisorEstado === 'Sin Supervision') && safeSettings.supervisorEncargado ? safeSettings.supervisorEncargado : (safeSettings.supervisor || 'NO ASIGNADO')}
                      </span>
                      {safeSettings.supervisorTaser === 'SI' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">taser</span>}
                    </div>
                  </div>

                  <div className={`flex flex-col min-w-[180px] rounded-xl border px-3 py-2 transition-colors ${missingHeaderClass}`}>
                    <span className={infoLabelStyle}>
                      {(safeSettings.permanenciaEstado === 'Falto' || safeSettings.permanenciaEstado === 'Sin Supervision') && safeSettings.permanenciaEncargado
                        ? 'ENCARGADO'
                        : settings.turno === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`${infoValueStyle} ${highlightMissingHeader && !safeSettings.permanencia && safeSettings.permanenciaEstado !== 'Sin Supervision' ? 'text-red-600' : ''}`}>
                        {(safeSettings.permanenciaEstado === 'Falto' || safeSettings.permanenciaEstado === 'Sin Supervision') && safeSettings.permanenciaEncargado ? safeSettings.permanenciaEncargado : (safeSettings.permanencia || '--')}
                      </span>
                      {safeSettings.permanenciaTaser === 'SI' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">taser</span>}
                    </div>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 shrink-0"></div>

                {/* ESTADÍSTICAS RÁPIDAS */}
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className={infoLabelStyle}>UNIDADES TOTALES</span>
                    <span className="text-[20px] font-medium text-[#004b93] leading-none">{data.units.length}</span>
                  </div>
                  <div className="flex flex-col items-center border-l border-slate-100 pl-6">
                    <span className={infoLabelStyle}>OPERATIVIDAD</span>
                    <span className="text-[20px] font-medium text-green-600 leading-none">
                      {Math.round((data.units.filter(u => u.status === UnitStatus.PATRULLANDO).length / (data.units.length || 1)) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Secciones */}
            <div className={`p-4 grid gap-4 ${(isRescate || isTechnical) ? 'grid-cols-1' : (isOtrasAreas ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3')}`}>
              {/* Columna Choferes - Solo se muestra si NO es técnico (C4/COVV) */}
              {!isTechnical && (
                <div className={`flex flex-col rounded-xl border border-blue-50 overflow-hidden ${isRescate ? 'w-full' : ''}`}>
                  <div className="text-[16px] text-blue-700 bg-blue-50/70 px-4 py-2.5 flex items-center justify-between uppercase tracking-tighter border-b border-blue-100 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">minor_crash</span>
                      CHOFERES
                    </div>
                    <span className="bg-blue-600 text-white px-2 rounded-full text-[12px] shadow-sm">{choferes.length}</span>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-100 bg-white">
                    {choferes.map(u => renderCompactUnit(u, 'CHOFER'))}
                    {choferes.length === 0 && <p className="text-[12px] italic text-slate-300 py-10 text-center bg-white font-medium uppercase tracking-widest">Sin registros</p>}
                  </div>
                </div>
              )}

              {/* Secciones adicionales para sectores NO especializados */}
              {!isRescate && !isTechnical && (
                <>
                  {/* Columna Motorizados */}
                  <div className="flex flex-col rounded-xl border border-violet-50 overflow-hidden">
                    <div className="text-[16px] text-violet-700 bg-violet-50/70 px-4 py-2.5 flex items-center justify-between uppercase tracking-tighter border-b border-violet-100 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">moped</span>
                        MOTORIZADOS
                      </div>
                      <span className="bg-violet-600 text-white px-2 rounded-full text-[12px] shadow-sm">{motos.length}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100 bg-white">
                      {motos.map(u => renderCompactUnit(u, 'MOTO'))}
                      {motos.length === 0 && <p className="text-[12px] italic text-slate-300 py-10 text-center bg-white font-medium uppercase tracking-widest">Sin registros</p>}
                    </div>
                  </div>

                  {/* Columna Serenos (oculta en OTRAS AREAS) */}
                  {!isOtrasAreas && (
                  <div className="flex flex-col rounded-xl border border-teal-50 overflow-hidden">
                    <div className="text-[16px] text-teal-700 bg-teal-50/70 px-4 py-2.5 flex items-center justify-between uppercase tracking-tighter border-b border-teal-100 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">hail</span>
                        SERENOS
                      </div>
                      <span className="bg-teal-600 text-white px-2 rounded-full text-[12px] shadow-sm">{serenos.length}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100 bg-white">
                      {serenos.map(u => renderCompactUnit(u, 'SERENO'))}
                      {serenos.length === 0 && <p className="text-[12px] italic text-slate-300 py-10 text-center bg-white font-medium uppercase tracking-widest">Sin registros</p>}
                    </div>
                  </div>
                  )}
                </>
              )}

              {/* Columna Única para C4 y COVV (OPERADORES) */}
              {isTechnical && (
                <div className="flex flex-col rounded-xl border border-teal-50 overflow-hidden w-full">
                  <div className="text-[16px] text-teal-700 bg-teal-50/70 px-4 py-2.5 flex items-center justify-between uppercase tracking-tighter border-b border-teal-100 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">hail</span>
                      OPERADORES
                    </div>
                    <span className="bg-teal-600 text-white px-2 rounded-full text-[12px] shadow-sm">{serenos.length}</span>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-100 bg-white">
                    {serenos.map(u => renderCompactUnit(u, 'SERENO'))}
                    {serenos.length === 0 && <p className="text-[12px] italic text-slate-300 py-10 text-center bg-white font-medium uppercase tracking-widest">Sin registros</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisualizationView;
