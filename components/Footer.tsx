
import React from 'react';
import { AppSettings } from '../types';

interface FooterProps {
  settings: AppSettings;
  activeCount: number;
  personnelCount: number;
}

const Footer: React.FC<FooterProps> = ({ settings, activeCount, personnelCount }) => {
  return (
    <footer className="bg-[#0f172a] text-slate-400 px-6 py-2 flex items-center justify-between text-[10px] font-bold">
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          ACTIVAS: <span className="text-white">{activeCount.toString().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          PERSONAL: <span className="text-white">{Math.floor(personnelCount).toString().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          ALERTAS: <span className="text-white">0</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <span className="font-mono text-slate-600">{settings.ipServidor}</span>
        <span className="text-cyan-400 tracking-[0.2em] font-black">{settings.version}</span>
      </div>
    </footer>
  );
};

export default Footer;
