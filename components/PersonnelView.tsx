
import React, { useState, useMemo } from 'react';
import { PersonnelData } from '../types';

interface PersonnelViewProps {
    data: PersonnelData[];
    onRefresh: () => void;
    isLoading: boolean;
}

const PersonnelView: React.FC<PersonnelViewProps> = ({ data, onRefresh, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('TODOS');

    const operationalRoles = useMemo(() => {
        const roles = new Set(data.map(p => p.rol_operativo).filter(Boolean));
        return ['TODOS', ...Array.from(roles).sort()];
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(p => {
            const matchesSearch =
                (p.apellidos_nombres || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.dni || '').includes(searchTerm) ||
                (p.codigo_interno || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesRole = filterRole === 'TODOS' || p.rol_operativo === filterRole;
            const matchesState = (p.estado || '').toUpperCase() === 'ACTIVO';

            return matchesSearch && matchesState && matchesRole;
        });
    }, [data, searchTerm, filterRole]);

    const columnHeaderStyle = "px-4 py-3 text-left text-[13px] font-semibold text-white uppercase tracking-widest border-b border-blue-800 bg-[#005ea5] sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]";
    const cellStyle = "px-4 py-3 text-[13px] text-slate-700 border-b border-slate-50 bg-white";

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
                <div className="flex-1 flex flex-col">
                    <span className="text-[11px] font-medium text-[#004b93] uppercase tracking-wider mb-1 px-1">Buscar por</span>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="NOMBRE, DNI O CÓDIGO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all uppercase placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Filtro Rol */}
                    <div className="flex flex-col min-w-[200px]">
                        <span className="text-[11px] font-medium text-[#004b93] uppercase tracking-wider mb-1 px-1">Función Actual</span>
                        <div className="relative">
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer pr-8"
                            >
                                {operationalRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* Limpiar Filtros */}
                    <div className="flex flex-col justify-end">
                        <span className="text-[11px] font-medium text-transparent uppercase tracking-wider mb-1 px-1">‎</span>
                        <button
                            onClick={() => { setSearchTerm(''); setFilterRole('TODOS'); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-all h-[38px] whitespace-nowrap cursor-pointer"
                            title="Limpiar todos los filtros"
                        >
                            <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                            Limpiar
                        </button>
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
                                <th className={columnHeaderStyle}>Foto</th>
                                <th className={columnHeaderStyle}>DNI</th>
                                <th className={columnHeaderStyle}>Apellidos y Nombres</th>
                                <th className={columnHeaderStyle}>Régimen Laboral</th>
                                <th className={columnHeaderStyle}>Cód. Interno</th>
                                <th className={columnHeaderStyle}>Sector</th>
                                <th className={columnHeaderStyle}>Función Actual</th>
                                <th className={columnHeaderStyle}>Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-4 text-[13px] font-medium text-slate-400 uppercase tracking-widest">Cargando Personal...</p>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">person_search</span>
                                        <p className="text-[13px] font-medium text-slate-300 uppercase tracking-widest">No se encontraron registros</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((person, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className={`${cellStyle} text-center text-slate-300 font-medium w-12`}>{idx + 1}</td>
                                        <td className={`${cellStyle} w-14`}>
                                            {person.foto_url ? (
                                                <div className="relative group cursor-pointer">
                                                    <img
                                                        src={person.foto_url}
                                                        alt={person.apellidos_nombres}
                                                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50 shadow-2xl rounded-xl overflow-hidden border-2 border-white">
                                                        <img
                                                            src={person.foto_url}
                                                            alt={person.apellidos_nombres}
                                                            className="w-auto h-auto max-w-48 max-h-48 object-contain"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                                    <span className="material-symbols-outlined text-[18px]">person</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className={`${cellStyle} font-mono text-slate-500`}>{person.dni}</td>
                                        <td className={`${cellStyle} text-[#004b93] uppercase`}>{person.apellidos_nombres}</td>
                                        <td className={cellStyle}>{person.regimen_laboral}</td>
                                        <td className={cellStyle}>{person.codigo_interno}</td>
                                        <td className={cellStyle}>{person.sector_id}</td>
                                        <td className={cellStyle}>{person.rol_operativo}</td>
                                        <td className={cellStyle}>
                                            <span className={`px-2 rounded text-[13px] border uppercase ${person.estado.toUpperCase() === 'ACTIVO'
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
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 uppercase tracking-wider">
                    <span>Mostrando {filteredData.length} de {data.length} registros</span>
                </div>
            </div>
        </div>
    );
};

export default PersonnelView;
