import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WantedPerson } from '../types';

declare const google: any;

const WantedView: React.FC = () => {
  const [persons, setPersons] = useState<WantedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [selectedPerson, setSelectedPerson] = useState<WantedPerson | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedPerson) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedPerson]);

  const loadData = () => {
    setLoading(true);
    setPhotoErrors({});
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: WantedPerson[]) => {
          setPersons(data || []);
          setLoading(false);
        })
        .withFailureHandler(() => {
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

  const filteredPersons = useMemo(() => {
    return persons.filter(p => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.dnice.includes(term);
      const matchesCategory = categoryFilter === 'TODAS' || p.buscado_por === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    }, [persons, searchTerm, categoryFilter]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, WantedPerson[]> = {};
    filteredPersons.forEach(p => {
      const cat = p.buscado_por || 'SIN CATEGORÍA';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPersons]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedPerson(null);
  }, []);

  const DetailRow = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div className="flex gap-2 text-[13px]">
        <span className="text-slate-400 font-medium shrink-0 min-w-[80px]">{label}:</span>
        <span className="text-slate-800">{value}</span>
      </div>
    ) : null;

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            type="text"
            placeholder="Buscar por nombre o DNI"
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
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-primary h-9 max-w-[300px]"
          >
            {categories.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="text-[13px] font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-lg shrink-0 leading-none">{filteredPersons.length}</span>
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
                          onClick={() => setSelectedPerson(person)}
                          className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                        >
                          <div className="aspect-[3/4] bg-slate-100 overflow-hidden relative flex items-center justify-center">
                            {photoUrl && !hasError ? (
                               <img
                                 src={photoUrl}
                                 alt={person.nombre}
                                 className="w-full h-full object-contain"
                                 loading="lazy"
                                 onError={() => {
                                   if (person.photoUrl) setPhotoErrors(prev => ({ ...prev, [person.photoUrl!]: true }));
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
                          <div className="p-1.5">
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

      {selectedPerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedPerson(null)}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-[700px] w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPerson(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all md:hidden"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="md:w-[280px] shrink-0 bg-slate-100 relative flex items-center justify-center overflow-hidden">
              <div className="aspect-[3/4] md:aspect-auto md:h-full w-full flex items-center justify-center">
                {selectedPerson.photoUrl && !photoErrors[selectedPerson.photoUrl] ? (
                  <img
                    src={selectedPerson.photoUrl}
                    alt={selectedPerson.nombre}
                    className="w-full h-full object-contain"
                    onError={() => {
                      if (selectedPerson.photoUrl) setPhotoErrors(prev => ({ ...prev, [selectedPerson.photoUrl!]: true }));
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined text-[64px]">person_off</span>
                    <span className="text-[13px] font-medium mt-1">Sin foto</span>
                  </div>
                )}
              </div>
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                <div className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full leading-none shadow-md ${
                  selectedPerson.estado?.toUpperCase() === 'CAPTURADO' ? 'bg-green-500 text-white' :
                  selectedPerson.estado?.toUpperCase() === 'FALLECIDO' ? 'bg-red-500 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                  {selectedPerson.estado || 'REQUISITORIADO'}
                </div>
                {selectedPerson.recompensa && (
                  <div className="bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-md leading-none text-center">
                    {selectedPerson.recompensa}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-slate-800 leading-tight">{selectedPerson.nombre}</h2>
                  <p className="text-[12px] text-primary font-semibold mt-0.5">{selectedPerson.buscado_por}</p>
                </div>
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="hidden md:flex w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full items-center justify-center transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <div className="h-px bg-slate-100"></div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <DetailRow label="DNI/CE" value={selectedPerson.dnice} />
                <DetailRow label="Edad" value={selectedPerson.edad ? selectedPerson.edad + ' años' : undefined} />
                <DetailRow label="Sexo" value={selectedPerson.sexo} />
                <DetailRow label="Nacionalidad" value={selectedPerson.nacionalidad} />
                <DetailRow label="SADE" value={selectedPerson.sade} />
                <DetailRow label="CASO" value={selectedPerson.caso} />
                <DetailRow label="Fecha" value={selectedPerson.fecha_hecho} />
                <DetailRow label="Hora" value={selectedPerson.hora_hecho} />
                <div className="col-span-2">
                  <DetailRow label="Lugar" value={selectedPerson.lugar_intervencion} />
                </div>
                <div className="col-span-2">
                  <DetailRow label="Habilitación" value={selectedPerson.habilitacion_urbana} />
                </div>
                <div className="col-span-2">
                  <DetailRow label="Dependencia" value={selectedPerson.dependencia_policial} />
                </div>
              </div>

              {selectedPerson.caracteristicas && (
                <>
                  <div className="h-px bg-slate-100"></div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <DetailRow label="Fuente" value={selectedPerson.fuente} />
                    <DetailRow label="Video" value={selectedPerson.video} />
                    <div className="col-span-2">
                      <DetailRow label="Características" value={selectedPerson.caracteristicas} />
                    </div>
                    <div className="col-span-2">
                      <DetailRow label="Vestimenta" value={selectedPerson.vestimenta} />
                    </div>
                    <DetailRow label="Reincidente" value={selectedPerson.reincidente} />
                    <DetailRow label="Cumple analítica" value={selectedPerson.cumple_analitica} />
                  </div>
                </>
              )}

              {selectedPerson.circunstancias && (
                <>
                  <div className="h-px bg-slate-100"></div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Circunstancias</span>
                    <p className="text-[13px] text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{selectedPerson.circunstancias}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WantedView;
