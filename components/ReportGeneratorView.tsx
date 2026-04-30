import React, { useState } from 'react';
import { Calendar, Clock, FileText, Download, PieChart, Users } from 'lucide-react';

interface ReportGeneratorViewProps {
  selectedDate: string;
  selectedShift: string;
  onGenerateReport: (type: string, date: string, shift: string) => void;
  isGenerating?: boolean;
}

const ReportGeneratorView: React.FC<ReportGeneratorViewProps> = ({
  selectedDate,
  selectedShift,
  onGenerateReport,
  isGenerating = false
}) => {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [localDate, setLocalDate] = useState(selectedDate);
  const [localShift, setLocalShift] = useState(selectedShift);

  const reportTypes = [
    {
      id: 'motos',
      title: 'Reporte Numérico de Motos',
      subtitle: 'Yamaha XTZ150',
      description: 'Consolidado de operatividad, patrullaje y personal de toda la flota de motos Yamaha por sector.',
      icon: <PieChart className="w-8 h-8" />,
      color: 'blue',
      themeClass: 'border-blue-500 bg-blue-50/30',
      iconClass: 'bg-blue-100 text-blue-600',
      btnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
    },
    {
      id: 'motos_honda',
      title: 'Reporte Numérico de Motos',
      subtitle: 'Honda SAHARA XRE 300',
      description: 'Consolidado de operatividad, patrullaje y personal de la flota Honda SAHARA XRE 300 por sector.',
      icon: <PieChart className="w-8 h-8" />,
      color: 'red',
      themeClass: 'border-red-500 bg-red-50/30',
      iconClass: 'bg-red-100 text-red-600',
      btnClass: 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
    },
    {
      id: 'moviles',
      title: 'Reporte Numérico de Vehículos',
      subtitle: 'FLOTA RENTING (CAMIONETAS/AUTOS)',
      description: 'Consolidado general de operatividad, patrullaje y personal de toda la flota de vehículos Renting por sector.',
      icon: <FileText className="w-8 h-8" />,
      color: 'indigo',
      themeClass: 'border-indigo-500 bg-indigo-50/30',
      iconClass: 'bg-indigo-100 text-indigo-600',
      btnClass: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
    },
    {
      id: 'asistencia_regimen',
      title: 'Reporte de Asistencia por Régimen',
      subtitle: 'Personal Faltante por Régimen Laboral',
      description: 'Detalle de personal inasistente agrupado por su régimen laboral: 276, 728, 1057 y OS.',
      icon: <Users className="w-8 h-8" />,
      color: 'rose',
      themeClass: 'border-rose-500 bg-rose-50/30',
      iconClass: 'bg-rose-100 text-rose-600',
      btnClass: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
    }
  ];

  const handleGenerate = (id: string) => {
    setActiveReport(id);
    onGenerateReport(id, localDate, localShift);
  };

  return (
    <div className="mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-slate-800 leading-none">Filtros de Reporte</h2>
            <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Seleccione parámetros</p>
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
                className="pl-10 pr-4 h-9 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer text-sm shadow-sm"
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
                className="pl-10 pr-10 h-9 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 appearance-none transition-all cursor-pointer text-sm shadow-sm"
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
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`group rounded-2xl border-t-4 ${report.themeClass} border-x border-b shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col`}
          >
            <div className="p-6 flex-1 flex flex-col space-y-4">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${report.iconClass} group-hover:rotate-6 transition-all duration-300`}>
                  {report.icon}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] font-medium text-slate-500 tracking-wider uppercase">PDF</span>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 leading-snug group-hover:text-blue-900 transition-colors">{report.title}</h3>
                <p className="text-[11px] font-semibold text-slate-400 mt-1 mb-3 uppercase tracking-tighter">{report.subtitle}</p>
                <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                  {report.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100/50">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all
                    ${isGenerating && activeReport === report.id
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : `${report.btnClass} text-white shadow-lg active:scale-95 hover:-translate-y-0.5`
                    }
                  `}
                >
                  {isGenerating && activeReport === report.id ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      GENERANDO...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      GENERAR REPORTE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportGeneratorView;
