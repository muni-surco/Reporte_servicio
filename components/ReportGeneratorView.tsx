import React, { useState } from 'react';
import { Calendar, Clock, FileText, Download, PieChart, Users } from 'lucide-react';
import { UnitData, PersonnelData } from '../types';

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
      id: 'asistencia_regimen',
      title: 'Asistencia por Régimen',
      subtitle: 'PERSONAL FALTANTE',
      description: 'Detalle de personal inasistente agrupado por régimen laboral (276, 728, 1057 y OS).',
      icon: <Users className="w-8 h-8" />,
      color: 'rose',
      themeClass: 'border-rose-100',
      iconClass: 'bg-rose-50 text-rose-600',
      btnClass: 'bg-rose-600 hover:bg-rose-700'
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
            <h2 className="text-sm font-medium text-slate-800 leading-none">Generador de Reportes</h2>
            <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Configure fecha y turno para los documentos</p>
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
            className={`group bg-white rounded-2xl border ${report.themeClass} shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col`}
          >
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start gap-4 mb-5">
                <div className={`w-14 h-14 rounded-2xl ${report.iconClass} flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105`}>
                  {report.icon}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-slate-800 leading-tight group-hover:text-blue-700 transition-colors">
                    {report.title}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    {report.subtitle}
                  </span>
                </div>
              </div>

              <div className="flex-1 mb-6">
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100/50">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[11px] tracking-widest transition-all uppercase
                    ${isGenerating && activeReport === report.id
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : `${report.btnClass} text-white shadow-lg active:scale-95 hover:-translate-y-0.5`
                    }
                  `}
                >
                  {isGenerating && activeReport === report.id ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
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
