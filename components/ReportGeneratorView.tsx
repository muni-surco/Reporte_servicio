import React, { useState } from 'react';
import { Calendar, Clock, FileText, Download, PieChart, Users, UserRound, ShieldCheck, Activity, Search } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

interface ReportGeneratorViewProps {
  selectedDate: string;
  selectedShift: string;
  onGenerateReport: (type: string, date: string, shift: string, operatorName?: string) => void;
  isGenerating?: boolean;
  operatorOptions?: string[];
}

const ReportGeneratorView: React.FC<ReportGeneratorViewProps> = ({
  selectedDate,
  selectedShift,
  onGenerateReport,
  isGenerating = false,
  operatorOptions = [],
}) => {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [localDate, setLocalDate] = useState(selectedDate);
  const [localShift, setLocalShift] = useState(selectedShift);
  const [localOperator, setLocalOperator] = useState<string>('');
  const [operatorError, setOperatorError] = useState<string | null>(null);
  // Vista de listado: la generación se hace desde cada fila, sin card aparte.
  // Los filtros por categoría + buscador acortan la lista para que la pantalla
  // no haga scroll a medida que se agreguen reportes
  const [groupFilter, setGroupFilter] = useState('Todas');
  const [query, setQuery] = useState('');

  const reportTypes = [
    {
      id: 'operatividad',
      title: 'Reporte de Operatividad',
      subtitle: 'CONSOLIDADO DE OPERATIVIDAD',
      description: 'Estado integral de operatividad de la flota vehicular y recursos por sector, porcentajes de cobertura y novedades.',
      icon: <Activity className="w-8 h-8" />,
      color: 'orange',
      themeClass: 'border-orange-200 hover:border-orange-400 ring-1 ring-orange-100',
      iconClass: 'bg-orange-50 text-orange-600',
      btnClass: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      id: 'general',
      title: 'Reporte General',
      subtitle: 'TODOS LOS REGISTROS',
      description: 'Lista completa de todos los registros del turno y fecha incluyendo todos los sectores.',
      icon: <FileText className="w-8 h-8" />,
      color: 'emerald',
      themeClass: 'border-emerald-100',
      iconClass: 'bg-emerald-50 text-emerald-600',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700'
    },
    {
      id: 'motos',
      title: 'Motos Yamaha',
      subtitle: 'MODELO XTZ150',
      description: 'Reporte consolidado de operatividad, patrullaje y personal de toda la flota Yamaha por sector.',
      icon: <PieChart className="w-8 h-8" />,
      color: 'blue',
      themeClass: 'border-blue-100',
      iconClass: 'bg-blue-50 text-blue-600',
      btnClass: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      id: 'motos_honda',
      title: 'Motos Honda',
      subtitle: 'MODELO SAHARA XRE 300',
      description: 'Reporte consolidado de operatividad, patrullaje y personal de la flota Honda SAHARA por sector.',
      icon: <PieChart className="w-8 h-8" />,
      color: 'red',
      themeClass: 'border-red-100',
      iconClass: 'bg-red-50 text-red-600',
      btnClass: 'bg-red-600 hover:bg-red-700'
    },
    {
      id: 'motos_consolidado',
      title: 'Motos Consolidado',
      subtitle: 'YAMAHA + HONDA',
      description: 'Reporte único con el resumen de motos Yamaha y Honda por sector y el detalle combinado.',
      icon: <PieChart className="w-8 h-8" />,
      color: 'violet',
      themeClass: 'border-violet-100',
      iconClass: 'bg-violet-50 text-violet-600',
      btnClass: 'bg-violet-600 hover:bg-violet-700'
    },
    {
      id: 'moviles',
      title: 'Flota Renting',
      subtitle: 'CAMIONETAS Y AUTOS',
      description: 'Reporte general de operatividad, patrullaje y personal de toda la flota de vehículos Renting.',
      icon: <FileText className="w-8 h-8" />,
      color: 'indigo',
      themeClass: 'border-indigo-100',
      iconClass: 'bg-indigo-50 text-indigo-600',
      btnClass: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      id: 'consolidado',
      title: 'Unidades Consolidadas',
      subtitle: 'CAMIONETA · MINIVAN · AUTOMÓVIL',
      description: 'Tabla única consolidada por sector de camionetas, minivan y automóviles (propiedades Renting, Surco y Lima).',
      icon: <FileText className="w-8 h-8" />,
      color: 'teal',
      themeClass: 'border-teal-100',
      iconClass: 'bg-teal-50 text-teal-600',
      btnClass: 'bg-teal-600 hover:bg-teal-700'
    },
    {
      id: 'sipcop',
      title: 'Flota SIPCOP',
      subtitle: 'VEHÍCULOS SIPCOP',
      description: 'Reporte general de operatividad, patrullaje y personal de los vehículos con SIPCOP.',
      icon: <FileText className="w-8 h-8" />,
      color: 'orange',
      themeClass: 'border-orange-100',
      iconClass: 'bg-orange-50 text-orange-600',
      btnClass: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      id: 'asistencia_regimen',
      title: 'Inasistencia por Régimen',
      subtitle: 'PERSONAL FALTANTE',
      description: 'Detalle de personal inasistente agrupado por régimen laboral (276, 728, 1057 y OS).',
      icon: <Users className="w-8 h-8" />,
      color: 'rose',
      themeClass: 'border-rose-100',
      iconClass: 'bg-rose-50 text-rose-600',
      btnClass: 'bg-rose-600 hover:bg-rose-700'
    },
    {
      id: 'asistencia_estado',
      title: 'Asistencia por Régimen',
      subtitle: 'Personal presente',
      description: 'Detalle de personal patrullando, sin vehículo o sin documentos agrupado por régimen laboral (276, 728, 1057 y OS).',
      icon: <UserRound className="w-8 h-8" />,
      color: 'cyan',
      themeClass: 'border-cyan-100',
      iconClass: 'bg-cyan-50 text-cyan-600',
      btnClass: 'bg-cyan-600 hover:bg-cyan-700'
    },
    {
      id: 'taser',
      title: 'Reporte TASER',
      subtitle: 'TASER Y BODYCAM',
      description: 'Reporte detallado de equipos TASER y BODYCAM asignados al personal por unidad.',
      icon: <ShieldCheck className="w-8 h-8" />,
      color: 'slate',
      themeClass: 'border-slate-200',
      iconClass: 'bg-slate-100 text-slate-700',
      btnClass: 'bg-slate-700 hover:bg-slate-800'
    },
    {
      id: 'calendario_patrullaje',
      title: 'Parte Diario de las Unidades Móviles',
      subtitle: 'CALENDARIO MENSUAL',
      description: 'Calendario mensual de vehículos por día (automóviles y camionetas de GIR, RESCATE y FISCALIZACIÓN) con los 3 turnos (M/T/N). Usa el mes de la fecha seleccionada.',
      icon: <Calendar className="w-8 h-8" />,
      color: 'green',
      themeClass: 'border-green-100',
      iconClass: 'bg-green-50 text-green-600',
      btnClass: 'bg-green-600 hover:bg-green-700'
    }
  ];

  // Agrupación de la lista lateral (reportes nuevos se suman sin generar scroll)
  const REPORT_GROUPS: Record<string, string> = {
    operatividad: 'Operatividad',
    general: 'Operatividad',
    motos: 'Flotas',
    motos_honda: 'Flotas',
    motos_consolidado: 'Flotas',
    moviles: 'Flotas',
    consolidado: 'Flotas',
    sipcop: 'Flotas',
    asistencia_regimen: 'Personal',
    asistencia_estado: 'Personal',
    taser: 'Personal',
    calendario_patrullaje: 'Patrullaje'
  };
  const GROUP_ORDER = ['Operatividad', 'Flotas', 'Personal', 'Patrullaje'];
  const groupTabs = ['Todas', ...GROUP_ORDER];
  // Búsqueda sin tildes ni mayúsculas
  const flat = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filteredReports = reportTypes.filter(r => {
    const q = flat(query.trim());
    if (!q) return true;
    return flat(`${r.title} ${r.subtitle} ${r.description}`).includes(q);
  });
  // Categoría activa + búsqueda: la lista se acota para que entre sin scroll
  const listedReports = filteredReports.filter(r =>
    groupFilter === 'Todas' || REPORT_GROUPS[r.id] === groupFilter
  );
  const countByGroup = (group: string) =>
    group === 'Todas' ? filteredReports.length : filteredReports.filter(r => REPORT_GROUPS[r.id] === group).length;

  const handleGenerate = (id: string) => {
    if (!localOperator || localOperator.trim() === '') {
      setOperatorError('El campo operador es obligatorio para generar el reporte');
      return;
    }
    setOperatorError(null);
    setActiveReport(id);
    onGenerateReport(id, localDate, localShift, localOperator || undefined);
  };

  const handleOperatorChange = (value: string) => {
    setLocalOperator(value);
    if (operatorError) setOperatorError(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Filters Bar */}
      <div className="shrink-0 bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-slate-800 leading-none">Generador de Reportes</h2>
            <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Configure fecha y turno para los documentos</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1 mb-1">FECHA</span>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
                className="pl-10 pr-4 h-9 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer text-sm shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1 mb-1">TURNO</span>
            <div className="relative group">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <select
                value={localShift}
                onChange={(e) => setLocalShift(e.target.value)}
                className="pl-10 pr-10 h-9 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 appearance-none transition-all cursor-pointer text-sm shadow-sm"
              >
                <option value="MAÑANA">MAÑANA</option>
                <option value="TARDE">TARDE</option>
                <option value="NOCHE">NOCHE</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-4 h-4 border-r-2 border-b-2 border-slate-300 rotate-45 mb-1" />
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <span className={`text-[9px] font-medium uppercase tracking-widest ml-1 mb-1 ${operatorError ? 'text-red-500' : 'text-slate-400'}`}>OPERADOR</span>
            <div className="relative group w-[350px]">
              <UserRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none z-10 ${operatorError ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
              <AutocompleteInput
                value={localOperator}
                onChange={handleOperatorChange}
                suggestions={operatorOptions}
                placeholder="SELECCIONE OPERADOR"
                className={`h-9 rounded-xl text-sm font-medium shadow-sm pl-10 ${operatorError ? '' : 'bg-slate-50 border-slate-200'}`}
                error={!!operatorError}
              />
            </div>
            {operatorError && <span className="text-[10px] text-red-500 font-medium ml-1 mt-1">{operatorError}</span>}
          </div>
        </div>
      </div>

      {/* Listado de reportes: cada fila trae su propio botón GENERAR, así que no
          hace falta seleccionar nada. Los filtros de categoría + buscador acotan
          la lista para que entre completa sin scroll de pantalla. */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        {/* Buscador + filtros de categoría */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BUSCAR REPORTE..."
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {groupTabs.map(tab => {
              const isActive = groupFilter === tab;
              const count = countByGroup(tab);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setGroupFilter(tab)}
                  className={`h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                  <span className={`ml-1.5 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <p className="ml-auto text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {listedReports.length} de {reportTypes.length} reportes
          </p>
        </div>

        {/* Filas con botón GENERAR (dos columnas en pantallas anchas) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 grid grid-cols-1 xl:grid-cols-2 gap-3 content-start">
          {listedReports.map(report => {
            const processing = isGenerating && activeReport === report.id;
            return (
              <div
                key={report.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
              >
                <span className={`w-9 h-9 rounded-lg ${report.iconClass} flex items-center justify-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
                  {report.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{report.title}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 truncate">
                    {REPORT_GROUPS[report.id]} · {report.subtitle}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug truncate">{report.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  title={`Generar ${report.title} — ${localDate || 'sin fecha'} · ${localShift || ''}${localOperator ? ` · ${localOperator}` : ''}`}
                  className={`shrink-0 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    processing
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary-dark text-white shadow-sm active:scale-95 hover:-translate-y-0.5'
                  }`}
                >
                  {processing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      PROCESANDO
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      GENERAR
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {listedReports.length === 0 && (
            <p className="px-3 py-10 text-center text-[12px] text-slate-400">
              Sin coincidencias para «{query.trim()}»
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneratorView;
