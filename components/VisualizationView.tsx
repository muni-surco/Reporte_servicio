
import React from 'react';
import { UnitData, AppSettings, UnitStatus, SECTORS } from '../types';

interface VisualizationViewProps {
  allSectorsData: Record<string, { units: UnitData[], settings: AppSettings }>;
  settings: AppSettings;
  mobileData: { id: string; plate: string; radio?: string; quadrant?: string; sector?: string; }[];
}

const VisualizationView: React.FC<VisualizationViewProps> = ({ allSectorsData, settings, mobileData }) => {
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
  ];

  const getStatusColor = (status: string) => {
    if (status === UnitStatus.PATRULLANDO) return "bg-green-500 ring-2 ring-green-200";
    if (status === UnitStatus.APOYO_OTRA_AREA) return "bg-blue-500 ring-2 ring-blue-200";
    if (redStatusPatterns.includes(status)) return "bg-red-500 ring-2 ring-red-200";
    if (amberStatusPatterns.includes(status)) return "bg-amber-500 ring-2 ring-amber-200";
    return "bg-slate-300 ring-2 ring-slate-100";
  };

  const ALLOWED_STATUSES = [
    UnitStatus.PATRULLANDO,
    UnitStatus.SIN_VEHICULO,
  ];

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
          {u.id}
        </span>

        {/* Contenedor de información */}
        <div className="flex-1 flex items-center justify-between min-w-0 gap-6">
          <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-800 truncate uppercase tracking-tight flex items-center gap-2">
                {u.personnel1}
              </p>
            {u.status?.toUpperCase() === UnitStatus.SIN_VEHICULO && u.lugarEstado && (
              <div className="text-[10px] font-bold text-red-500 uppercase leading-none mt-0.5">
                {u.lugarEstado}
              </div>
            )}
            {u.type === 'CHOFER' && (u.indicative || u.personnel2) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {u.indicative && (
                  <span className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 leading-none shrink-0">
                    {u.indicative}
                  </span>
                )}
                {u.personnel2 && (
                  <span className="text-[10px] text-slate-500 truncate uppercase leading-none">
                    {u.personnel2}
                  </span>
                )}
              </div>
            )}
            </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="flex flex-col items-end min-w-[60px]">
              <span className="text-[11px] font-medium text-slate-400 tracking-tighter uppercase leading-none mb-1">RADIO</span>
              <span className="text-[13px] font-medium text-slate-700 font-mono leading-none">{displayRadio}</span>
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

  const infoLabelStyle = "text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-0.5 block";
  const infoValueStyle = "text-[13px] font-medium text-slate-800 uppercase truncate leading-none bg-transparent border-none p-0 cursor-default";

  return (
    <div className="flex flex-col gap-6 mx-auto">
      {SECTORS.map((sectorName) => {
        const data = allSectorsData[sectorName];
        if (!data) return null;

        const activeUnits = data.units.filter(u => ALLOWED_STATUSES.includes(u.status));
        const choferes = activeUnits.filter(u => u.type === 'CHOFER');
        const motos = activeUnits.filter(u => u.type === 'MOTO');
        const serenos = activeUnits.filter(u => u.type === 'SERENO');
        const isRescate = sectorName === 'RESCATE';

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
                  <h2 className="text-[24px] font-medium tracking-tighter uppercase text-[#002d5a] leading-none">{sectorName}</h2>
                </div>

                <div className="h-8 w-px bg-slate-200 shrink-0"></div>

                {/* INFO PERSONAL */}
                <div className="flex gap-12 flex-1 min-w-0">
                  <div className="flex flex-col min-w-[180px]">
                    <span className={infoLabelStyle}>OPERADOR EN TURNO</span>
                    <span className={infoValueStyle}>{data.settings.operador || 'NO ASIGNADO'}</span>
                  </div>

                  <div className="flex flex-col min-w-[180px]">
                    <span className={infoLabelStyle}>SUPERVISOR SECTOR</span>
                    <span className={infoValueStyle}>{data.settings.supervisor || 'NO ASIGNADO'}</span>
                  </div>

                  <div className="flex flex-col min-w-[180px]">
                    <span className={infoLabelStyle}>{settings.turno === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA'}</span>
                    <span className={infoValueStyle}>{data.settings.permanencia || '--'}</span>
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
            <div className={`p-4 grid gap-4 ${isRescate ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
              {/* Columna Choferes */}
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

              {!isRescate && (
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

                  {/* Columna Serenos */}
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
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisualizationView;
