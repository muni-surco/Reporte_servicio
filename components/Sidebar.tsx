
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
        <span className="text-2xl font-bold">C4</span>
      </div>

      <nav className="flex flex-col gap-5">
        <button
          onClick={() => onViewChange('DASHBOARD')}
          title="Dashboard de Edición"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'DASHBOARD' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">dashboard</span>
        </button>
        <button
          onClick={() => onViewChange('VISUALIZATION')}
          title="Visualización de Reporte"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'VISUALIZATION' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">description</span>
        </button>
        <button
          onClick={() => onViewChange('STATISTICS')}
          title="Estadísticas Operativas"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'STATISTICS' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">bar_chart</span>
        </button>
        <button
          onClick={() => onViewChange('PERSONNEL')}
          title="Gestión de Personal"
          className={`px-3 py-2 rounded-xl transition-all ${currentView === 'PERSONNEL' ? 'bg-primary-dark text-white shadow-lg shadow-black/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined">group</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-bold border border-white/20">
          MSS
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
