import React, { useState, useEffect, useMemo } from 'react';
import { WantedPerson } from '../types';

declare const google: any;

const WantedView: React.FC = () => {
  const [persons, setPersons] = useState<WantedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [selectedPerson, setSelectedPerson] = useState<WantedPerson | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    setPhotoErrors({});
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: WantedPerson[]) => {
          setPersons(data || []);
          setLoading(false);
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to load wanted persons', err);
          setPersons([]);
          setLoading(false);
        })
        .getWantedPersons();
    } else {
      setPersons([]);
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(persons.map(p => p.buscado_por).filter(Boolean));
    return ['TODAS', ...Array.from(set).sort()];
  }, [persons]);

  const statuses = useMemo(() => {
    const set = new Set(persons.map(p => p.estado).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [persons]);

  const filteredPersons = useMemo(() => {
    return persons.filter(p => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.dnice.includes(term) ||
        p.sade.toLowerCase().includes(term) ||
        p.caso.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'TODOS' || p.estado === statusFilter;
      const matchesCategory = categoryFilter === 'TODAS' || p.buscado_por === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [persons, searchTerm, statusFilter, categoryFilter]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, WantedPerson[]> = {};
    filteredPersons.forEach(p => {
      const cat = p.buscado_por || 'SIN CATEGORÍA';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPersons]);

  const totalWithPhoto = persons.filter(p => p.photoUrl).length;

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, SADE o caso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none text-[13px] font-medium text-slate-700 focus:outline-none placeholder:text-slate-300"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-300 hover:text-slate-500">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">Categoría:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-primary h-9 max-w-[160px]"
          >
            {categories.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-primary h-9 max-w-[140px]"
          >
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={loadData}
          className="h-9 px-4 bg-primary text-white rounded-lg text-[12px] font-medium uppercase tracking-wider flex items-center gap-2 hover:bg-primary-dark transition-all shrink-0"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>



      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[13px] font-medium text-slate-400 animate-pulse">Cargando registros...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredPersons.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-[14px] text-slate-400 font-medium">No se encontraron registros</p>
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {groupedByCategory.map(([category, categoryPersons]) => (
                <div key={category}>
                  <div className="flex items-center gap-3 mb-3 sticky top-0 bg-[#f8fafc] z-10 py-2">
                    <span className="text-[13px] font-bold text-primary uppercase tracking-wider">{category}</span>
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{categoryPersons.length}</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                    {categoryPersons.map((person, idx) => {
                      const photoUrl = person.photoUrl;
                      const hasError = person.photoUrl ? photoErrors[person.photoUrl] : true;

                      return (
                        <div
                          key={`${category}_${person.dnice}_${idx}`}
                          onClick={() => setSelectedPerson(selectedPerson === person ? null : person)}
                          className={`bg-white rounded-lg border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                            selectedPerson === person ? 'ring-2 ring-primary border-transparent' : 'border-slate-200'
                          }`}
                        >
                          <div className="aspect-[3/4] bg-slate-100 overflow-hidden relative flex items-center justify-center">
                            {photoUrl && !hasError ? (
                              <img
                                src={photoUrl}
                                alt={person.nombre}
                                className="w-full h-full object-contain"
                                onError={() => {
                                  if (person.photoUrl) {
                                    setPhotoErrors(prev => ({ ...prev, [person.photoUrl!]: true }));
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-300">
                                <span className="material-symbols-outlined text-[36px]">person_off</span>
                                <span className="text-[9px] font-medium mt-0.5">Sin foto</span>
                              </div>
                            )}
                            {person.recompensa && (
                              <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md leading-none">
                                {person.recompensa}
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                              <h3 className="text-white text-[11px] font-bold leading-tight truncate">{person.nombre}</h3>
                              {person.edad && <p className="text-white/70 text-[9px] leading-none mt-0.5">{person.edad} años</p>}
                            </div>
                          </div>
                          <div className="p-1.5 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[70px]">{person.dnice || 'S/D'}</span>
                              <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded-full truncate max-w-[75px] leading-none ${
                                person.estado?.toUpperCase() === 'CAPTURADO' ? 'bg-green-100 text-green-700' :
                                person.estado?.toUpperCase() === 'FALLECIDO' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {person.estado || 'REQ'}
                              </span>
                            </div>
                            {selectedPerson === person && (
                              <div className="pt-1 border-t border-slate-100 space-y-0.5 mt-0.5">
                                {person.edad && <p className="text-[10px]"><span className="text-slate-400">Edad:</span> <span className="text-slate-700 font-medium">{person.edad}</span></p>}
                                {person.sexo && <p className="text-[10px]"><span className="text-slate-400">Sexo:</span> <span className="text-slate-700 font-medium">{person.sexo}</span></p>}
                                {person.lugar_intervencion && <p className="text-[10px]"><span className="text-slate-400">Lugar:</span> <span className="text-slate-700 font-medium truncate">{person.lugar_intervencion}</span></p>}
                                {person.fecha_hecho && <p className="text-[10px]"><span className="text-slate-400">Fecha:</span> <span className="text-slate-700 font-medium">{person.fecha_hecho}</span></p>}
                                {person.dependencia_policial && <p className="text-[10px]"><span className="text-slate-400">Dep.:</span> <span className="text-slate-700 font-medium truncate">{person.dependencia_policial}</span></p>}
                                {person.fuente && <p className="text-[10px]"><span className="text-slate-400">Fuente:</span> <span className="text-slate-700 font-medium truncate">{person.fuente}</span></p>}
                                {person.caracteristicas && <p className="text-[10px]"><span className="text-slate-400">Caract.:</span> <span className="text-slate-700 font-medium truncate">{person.caracteristicas}</span></p>}
                                {person.circunstancias && (
                                  <div>
                                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider block">Circunstancias</span>
                                    <p className="text-[10px] text-slate-700 bg-slate-50 rounded p-1 leading-snug">{person.circunstancias}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="pt-0.5">
                              <span className="text-[8px] text-primary font-semibold uppercase tracking-wider">
                                {selectedPerson === person ? 'OCULTAR' : 'VER'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WantedView;
