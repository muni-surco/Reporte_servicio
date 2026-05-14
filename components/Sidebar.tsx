
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': any;
    }
  }
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <aside className="w-[70px] bg-primary h-screen flex-shrink-0 flex flex-col items-center py-6 z-[1030] shadow-2xl no-print">
      <div className="mb-8 bg-secondary p-2 rounded-xl text-white shadow-lg shadow-black/20">
        <span className="text-2xl font-medium">C4</span>
      </div>

      <nav className="flex flex-col gap-5">
        <button
          onClick={() => onViewChange('DASHBOARD')}
          data-tooltip="Dashboard de Edición"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'DASHBOARD' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">dashboard</span>
        </button>
        <button
          onClick={() => onViewChange('RETEN')}
          data-tooltip="Gestión de Unidades Retén"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'RETEN' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">swap_horizontal_circle</span>
        </button>
        <button
          onClick={() => onViewChange('VISUALIZATION')}
          data-tooltip="Vista de Despachador"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'VISUALIZATION' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">description</span>
        </button>
        <button
          onClick={() => onViewChange('STATISTICS')}
          data-tooltip="Estadísticas Operativas"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'STATISTICS' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">bar_chart</span>
        </button>
        <button
          onClick={() => onViewChange('PERSONNEL')}
          data-tooltip="Vista de Personal"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'PERSONNEL' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">group</span>
        </button>
        <button
          onClick={() => onViewChange('REPORTS')}
          data-tooltip="Centro de Reportes"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'REPORTS' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">summarize</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <div
          data-tooltip="Usuario: Municipalidad de Surco"
          className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-medium border border-white/20 hover:bg-white/20 transition-all cursor-help"
        >
          MSS
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
