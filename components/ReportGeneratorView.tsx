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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-in fade-in duration-500">
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 leading-none">Filtros de Reporte</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Seleccione parámetros</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">FECHA</span>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
                className="pl-10 pr-4 h-10 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer text-sm shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">TURNO</span>
            <div className="relative group">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <select
                value={localShift}
                onChange={(e) => setLocalShift(e.target.value)}
                className="pl-10 pr-10 h-10 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 appearance-none transition-all cursor-pointer text-sm shadow-sm"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Formato PDF</span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-800">{report.title}</h3>
                <p className={`text-sm font-bold text-${report.color}-600/80 mb-2 uppercase tracking-tight`}>{report.subtitle}</p>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all
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

      {/* Tips / Info Section */}
      <div className="bg-blue-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="bg-blue-800 p-6 rounded-2xl">
            <Calendar className="w-12 h-12 text-blue-300" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black mb-2 tracking-tight">¿Necesitas reportes históricos?</h2>
            <p className="text-blue-100/80 max-w-xl">
              Solo debes cambiar la fecha en la parte superior. El sistema consultará automáticamente la base de datos histórica para generar el consolidado de ese día específico.
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-blue-800/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-blue-700/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default ReportGeneratorView;
