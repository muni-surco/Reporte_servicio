
import React, { useState, useMemo } from 'react';
import { PersonnelData } from '../types';

interface PersonnelViewProps {
    data: PersonnelData[];
    onRefresh: () => void;
    isLoading: boolean;
}

const PersonnelView: React.FC<PersonnelViewProps> = ({ data, onRefresh, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterState, setFilterState] = useState('TODOS');
    const [filterRole, setFilterRole] = useState('TODOS');

    const operationalRoles = useMemo(() => {
        const roles = new Set(data.map(p => p.rol_operativo).filter(Boolean));
        return ['TODOS', ...Array.from(roles).sort()];
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(p => {
            const matchesSearch =
                p.apellidos_nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.dni.includes(searchTerm) ||
                p.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesRole = filterRole === 'TODOS' || p.rol_operativo === filterRole;

            let matchesState = filterState === 'TODOS' || p.estado.toUpperCase() === filterState.toUpperCase();

            // Compatibilidad para registros que aún digan CESADO pero el filtro sea INACTIVO
            if (filterState === 'INACTIVO' && p.estado.toUpperCase() === 'CESADO') {
                matchesState = true;
            }

            return matchesSearch && matchesState && matchesRole;
        });
    }, [data, searchTerm, filterState, filterRole]);

    const columnHeaderStyle = "px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]";
    const cellStyle = "px-4 py-3 text-[12px] font-medium text-slate-700 border-b border-slate-50 bg-white";

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
                <div className="flex-1 flex flex-col">
                    <span className="text-[8px] font-bold text-[#004b93] uppercase tracking-wider mb-1 px-1">Buscar por</span>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="NOMBRE, DNI O CÓDIGO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all uppercase placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Filtro Rol */}
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[8px] font-bold text-[#004b93] uppercase tracking-wider mb-1 px-1">Rol Operativo</span>
                        <div className="relative">
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer pr-8"
                            >
                                {operationalRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* Filtro Estado */}
                    <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-[#004b93] uppercase tracking-wider mb-1 px-1">Estado</span>
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 h-[38px]">
                            {['TODOS', 'ACTIVO', 'INACTIVO'].map(state => (
                                <button
                                    key={state}
                                    onClick={() => setFilterState(state)}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-bold transition-all h-full ${filterState === state
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {state}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className={`${columnHeaderStyle} w-12 text-center`}>#</th>
                                <th className={columnHeaderStyle}>DNI</th>
                                <th className={columnHeaderStyle}>Apellidos y Nombres</th>
                                <th className={columnHeaderStyle}>Cód. Interno</th>
                                <th className={columnHeaderStyle}>Sector</th>
                                <th className={columnHeaderStyle}>Rol Operativo</th>
                                <th className={columnHeaderStyle}>Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cargando Personal...</p>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">person_search</span>
                                        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">No se encontraron registros</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((person, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className={`${cellStyle} text-center text-slate-300 font-bold w-12`}>{idx + 1}</td>
                                        <td className={`${cellStyle} font-mono font-bold text-slate-500`}>{person.dni}</td>
                                        <td className={`${cellStyle} font-bold text-[#004b93] uppercase`}>{person.apellidos_nombres}</td>
                                        <td className={cellStyle}>{person.codigo_interno}</td>
                                        <td className={cellStyle}>{person.sector_id}</td>
                                        <td className={cellStyle}>{person.rol_operativo}</td>
                                        <td className={cellStyle}>
                                            <span className={`px-2 rounded text-[11px] font-bold border uppercase ${person.estado.toUpperCase() === 'ACTIVO'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : 'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                {person.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer info */}
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Mostrando {filteredData.length} de {data.length} registros</span>
                </div>
            </div>
        </div>
    );
};

export default PersonnelView;
