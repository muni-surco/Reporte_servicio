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
      icon: <PieChart className="w-8 h-8 text-blue-600" />,
      color: 'blue'
    },
    {
      id: 'motos_honda',
      title: 'Reporte Numérico de Motos',
      subtitle: 'Honda SAHARA XRE 300',
      description: 'Consolidado de operatividad, patrullaje y personal de la flota Honda SAHARA XRE 300 por sector.',
      icon: <PieChart className="w-8 h-8 text-red-600" />,
      color: 'red'
    },
    {
      id: 'moviles',
      title: 'Reporte Numérico de Vehículos',
      subtitle: 'FLOTA RENTING (CAMIONETAS/AUTOS)',
      description: 'Consolidado general de operatividad, patrullaje y personal de toda la flota de vehículos Renting por sector.',
      icon: <FileText className="w-8 h-8 text-indigo-600" />,
      color: 'indigo'
    },
    {
      id: 'asistencia_regimen',
      title: 'Reporte de Asistencia por Régimen',
      subtitle: 'Personal Faltante por Régimen Laboral',
      description: 'Detalle de personal inasistente agrupado por su régimen laboral: 276, 728, CAS y OS.',
      icon: <Users className="w-8 h-8 text-rose-600" />,
      color: 'rose'
    }
  ];

  const handleGenerate = (id: string) => {
    setActiveReport(id);
    onGenerateReport(id, localDate, localShift);
  };

  return (
    <div className="mx-auto p-4 md:p-6 space-y-8 animate-in fade-in duration-500">

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className={`p-4 rounded-2xl bg-${report.color}-50 group-hover:scale-110 transition-transform duration-500`}>
                  {report.icon}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full">
                  <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">Formato PDF</span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-medium text-slate-800">{report.title}</h3>
                <p className={`text-sm font-medium text-${report.color}-600/80 mb-2 uppercase tracking-tight`}>{report.subtitle}</p>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all
                    ${isGenerating && activeReport === report.id
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : `bg-${report.color}-600 text-white hover:bg-${report.color}-700 shadow-lg shadow-${report.color}-600/20 active:scale-95 hover:-translate-y-0.5`
                    }
                  `}
                >
                  {isGenerating && activeReport === report.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      PROCESANDO...
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
