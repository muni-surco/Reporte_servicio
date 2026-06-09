import React, { useState } from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { id: 'DASHBOARD' as ViewMode, icon: 'dashboard', label: 'Registro de Servicio' },
    { id: 'RETEN' as ViewMode, icon: 'swap_horizontal_circle', label: 'Registro de Retenes' },
    { id: 'VISUALIZATION' as ViewMode, icon: 'description', label: 'Vista de Despachador' },
    { id: 'VEHICLE_SEARCH' as ViewMode, icon: 'search', label: 'Buscador de Vehículos' },
    { id: 'PERSONNEL' as ViewMode, icon: 'group', label: 'Vista de Personal' },
    { id: 'MAP' as ViewMode, icon: 'map', label: 'Mapa de Cuadrantes' },
    { id: 'WANTED' as ViewMode, icon: 'scan', label: 'Rostros Buscados' },
    { id: 'STATISTICS' as ViewMode, icon: 'bar_chart', label: 'Estadísticas' },
    { id: 'REPORTS' as ViewMode, icon: 'summarize', label: 'Centro de Reportes' },
  ];

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`bg-primary h-screen fixed left-0 top-0 flex flex-col transition-all duration-300 ease-in-out z-[1030] shadow-2xl no-print overflow-hidden ${isExpanded ? 'w-[260px]' : 'w-[76px]'
        }`}
    >
      {/* Logo Area */}
      <div className="h-[72px] flex items-center px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-secondary p-2 rounded-xl text-white shadow-lg shadow-black/20 shrink-0">
            <span className="text-xl font-bold">C4</span>
          </div>
          <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
            <h1 className="text-white font-bold text-sm tracking-tighter leading-none">SISTEMA DE GESTIÓN</h1>
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-widest mt-1 block">C4 - Alerta Surco</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all group relative ${currentView === item.id
              ? 'bg-primary-dark text-white shadow-lg shadow-black/30'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
          >
            <span className="material-symbols-outlined text-[24px] shrink-0">{item.icon}</span>
            <span className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
              }`}>
              {item.label}
            </span>

            {/* Tooltip fallback when collapsed */}
            {!isExpanded && (
              <div className="absolute left-16 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase tracking-widest border border-white/10">
                {item.label}
              </div>
            )}
          </button>
        ))}

        {/* External Links */}
        <div className="border-t border-white/10 my-2"></div>
        <a
          href="https://script.google.com/a/macros/munisurco.gob.pe/s/AKfycbxyiW9Ttu4zVumZ2UteycD2htKEe-dtTGDLp6GN_1VV_X7HgFWBpenE7cZlxFju-qoR/exec"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all group relative text-slate-400 hover:text-white hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[24px] shrink-0">videocam</span>
          <span className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
            Mapa de Cámaras
          </span>
          <span className="material-symbols-outlined text-[14px] ml-auto opacity-40">open_in_new</span>
          {!isExpanded && (
            <div className="absolute left-16 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase tracking-widest border border-white/10">
              Mapa de Cámaras
            </div>
          )}
        </a>
        <a
          href="https://script.google.com/a/macros/munisurco.gob.pe/s/AKfycbxmfgdAOeI5tE4o11UuHK6GQX8v8S9Jh5SG-vgtPghUnWLu2kDboUqcQMvhLKLKBwuswA/exec"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all group relative text-slate-400 hover:text-white hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[24px] shrink-0">assignment</span>
          <span className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
            Procedimientos
          </span>
          <span className="material-symbols-outlined text-[14px] ml-auto opacity-40">open_in_new</span>
          {!isExpanded && (
            <div className="absolute left-16 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase tracking-widest border border-white/10">
              Procedimientos
            </div>
          )}
        </a>
      </nav>

      {/* User / Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center text-[12px] font-bold border border-white/20 shrink-0">
            MSS
          </div>
          <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
            <p className="text-white text-[10px] font-bold leading-none uppercase">Municipalidad</p>
            <p className="text-white/40 text-[9px] font-medium mt-1 uppercase tracking-tight">de Santiago de Surco</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
