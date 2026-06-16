import React, { useState, useRef, useEffect } from 'react';
import { VehicleRQ } from '../types';
import { Search, XCircle, AlertCircle, Plus, X, ChevronDown } from 'lucide-react';

declare const google: any;

const VehicleSearchView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<VehicleRQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [plates, setPlates] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState('TODOS'); // New state
  const [saving, setSaving] = useState(false);
  const [quadrantOptions, setQuadrantOptions] = useState<string[]>([]);
  const [showQuadrantDropdown, setShowQuadrantDropdown] = useState(false);
  const [quadrantActiveIndex, setQuadrantActiveIndex] = useState(-1);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const quadrantRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<VehicleRQ>({
    sade: '', fecha: '', tipo: '', marca: '', modelo: '', color: '', placa: '',
    estado: '', relato: '', tipoDelito: '', subtipoDelito: '', sector: '', cuadrante: ''
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: string[]) => setPlates(data || []))
        .withFailureHandler(() => {})
        .getVehiclePlates();
      google.script.run
        .withSuccessHandler((data: string[]) => setQuadrantOptions(data || []))
        .withFailureHandler(() => {})
        .getQuadrantList();
      loadAll();
    }
  }, []);

  useEffect(() => {
    if (searched && !searchTerm.trim()) {
      loadAll();
    }
  }, [searchTerm]);

  const loadAll = () => {
    setLoading(true);
    setSearched(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: VehicleRQ[]) => {
          setResults(data || []);
          setLoading(false);
        })
        .withFailureHandler((err: any) => {
          console.error('Failed to load vehicles', err);
          setResults([]);
          setLoading(false);
        })
        .searchVehicles('');
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (quadrantRef.current && !quadrantRef.current.contains(e.target as Node)) {
        setShowQuadrantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPlates = searchTerm.trim()
    ? plates.filter(p => p.includes(searchTerm.toUpperCase())).slice(0, 50)
    : [];

  const handleSearch = () => {
    const term = searchTerm.trim();
    setLoading(true);
    setSearched(true);
    setShowDropdown(false);

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((data: VehicleRQ[]) => {
          setResults(data || []);
          setLoading(false);
        })
        .withFailureHandler((err: any) => {
          console.error('Search failed', err);
          setResults([]);
          setLoading(false);
        })
        .searchVehicles(term);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && filteredPlates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredPlates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredPlates.length) % filteredPlates.length);
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        setSearchTerm(filteredPlates[activeIndex]);
        setShowDropdown(false);
        setActiveIndex(-1);
        return;
      }
    }
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setShowDropdown(false);
    setActiveIndex(-1);
    loadAll();
    inputRef.current?.focus();
  };

  const handleSaveVehicle = () => {
    const required = ['sade', 'fecha', 'tipo', 'placa', 'estado'];
    const errors: Record<string, boolean> = {};
    required.forEach(key => { if (!(formData as any)[key]?.toString().trim()) errors[key] = true; });
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(() => {
          setSaving(false);
          setShowAddModal(false);
          setFormData({ sade: '', fecha: '', tipo: '', marca: '', modelo: '', color: '', placa: '', estado: '', relato: '', tipoDelito: '', subtipoDelito: '', sector: '', cuadrante: '' });
          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run
              .withSuccessHandler((data: string[]) => setPlates(data || []))
              .withFailureHandler(() => {})
              .getVehiclePlates();
          }
        })
        .withFailureHandler((err: any) => {
          console.error('Save failed', err);
          setSaving(false);
        })
        .saveVehicleRQ(formData);
    } else {
      setSaving(false);
      setShowAddModal(false);
    }
  };

  const inputModalStyle = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1" ref={containerRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
                setActiveIndex(-1);
                if (e.target.value.trim()) {
                    handleSearch();
                }
              }}
              onFocus={() => searchTerm.trim() && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por placa (ej: ABC-123)..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {showDropdown && filteredPlates.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[220px] overflow-y-auto ring-1 ring-black ring-opacity-5">
                {filteredPlates.map((plate, idx) => (
                  <div
                    key={plate}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchTerm(plate);
                      setShowDropdown(false);
                      setActiveIndex(-1);
                    }}
                    className={`px-4 py-2.5 text-[13px] font-mono cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${activeIndex === idx ? 'bg-primary text-white' : 'text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    {plate}
                  </div>
                ))}
              </div>
            )}
            {searchTerm && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="TODOS">TODOS LOS TIPOS</option>
            <option value="AUTO">AUTO</option>
            <option value="CAMIONETA">CAMIONETA</option>
            <option value="MOTOTAXI">MOTOTAXI</option>
            <option value="MOTO">MOTO</option>
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-3 bg-emerald-600 text-white rounded-lg text-[13px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">AGREGAR</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[13px] font-medium uppercase tracking-wider">Buscando vehículos...</p>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <AlertCircle className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-[14px] font-medium">No se encontraron vehículos</p>
          <p className="text-[12px] text-slate-400 mt-1">Intente con otro término de búsqueda</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-600">
              Resultados: <span className="text-primary">{results.length}</span> vehículo{results.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#005ea5] text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="text-left px-4 py-3">SADE</th>
                  <th className="text-left px-4 py-3">FECHA</th>
                  <th className="text-left px-4 py-3">TIPO</th>
                  <th className="text-left px-4 py-3">MARCA</th>
                  <th className="text-left px-4 py-3">MODELO</th>
                  <th className="text-left px-4 py-3">COLOR</th>
                  <th className="text-left px-4 py-3">PLACA</th>
                  <th className="text-left px-4 py-3">ESTADO</th>
                  <th className="text-left px-4 py-3">RELATO</th>
                  <th className="text-left px-4 py-3">TIPO DELITO</th>
                  <th className="text-left px-4 py-3">SUBTIPO</th>
                  <th className="text-left px-4 py-3">SECTOR</th>
                  <th className="text-left px-4 py-3">CUADRANTE</th>
                </tr>
              </thead>
              <tbody>
                {results.filter(r => filterType === 'TODOS' || r.tipo === filterType).map((v, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{v.sade}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.fecha}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">{v.tipo}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{v.marca}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.modelo}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{
                        backgroundColor: v.color?.toLowerCase() === 'negro' ? '#f1f5f9' :
                          v.color?.toLowerCase() === 'blanco' ? '#f8fafc' :
                          v.color?.toLowerCase() === 'rojo' ? '#fef2f2' :
                          v.color?.toLowerCase() === 'azul' ? '#eff6ff' :
                          v.color?.toLowerCase() === 'verde' ? '#f0fdf4' :
                          v.color?.toLowerCase() === 'gris' || v.color?.toLowerCase() === 'plateado' ? '#f8fafc' :
                          '#f5f5f4',
                        color: v.color?.toLowerCase() === 'negro' ? '#334155' :
                          v.color?.toLowerCase() === 'rojo' ? '#dc2626' :
                          v.color?.toLowerCase() === 'azul' ? '#2563eb' :
                          v.color?.toLowerCase() === 'verde' ? '#16a34a' :
                          '#64748b'
                      }}>{v.color}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-800 tracking-wider">{v.placa}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${v.estado?.toUpperCase() === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{v.estado || '--'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[250px] truncate" title={v.relato}>{v.relato}</td>
                    <td className="px-4 py-2.5 text-slate-700">{v.tipoDelito}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.subtipoDelito}</td>
                    <td className="px-4 py-2.5 text-slate-700">{v.sector}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.cuadrante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400">
            Mostrando {results.length} resultado{results.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search className="w-16 h-16 mb-4 text-slate-200" />
          <p className="text-[15px] font-medium text-slate-500">Buscador de Vehículos Sospechosos</p>
          <p className="text-[12px] text-slate-400 mt-1">Ingrese una placa para buscar en el registro histórico</p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowAddModal(false)}>
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0b63a7] px-5 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="text-[15px] font-bold uppercase tracking-wider text-white">Agregar Vehículo</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {[
                { key: 'sade', label: 'SADE', type: 'number', required: true },
                { key: 'fecha', label: 'FECHA', type: 'date', required: true },
                { key: 'tipo', label: 'TIPO', type: 'select', options: ['AUTO', 'CAMIONETA', 'MOTOTAXI', 'MOTO'], required: true },
                { key: 'marca', label: 'MARCA', type: 'text' },
                { key: 'modelo', label: 'MODELO', type: 'text' },
                { key: 'color', label: 'COLOR', type: 'text' },
                { key: 'placa', label: 'PLACA', type: 'text', required: true },
                { key: 'estado', label: 'ESTADO', type: 'select', options: ['IMPLICADO', 'ROBADO', 'SOSPECHOSO', 'REQUISITORIADO'], required: true },
                { key: 'relato', label: 'RELATO', type: 'text' },
                { key: 'tipoDelito', label: 'TIPO DELITO', type: 'text' },
                { key: 'subtipoDelito', label: 'SUBTIPO DELITO', type: 'text' },
                { key: 'sector', label: 'SECTOR', type: 'select', options: ['1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B'] },
                { key: 'cuadrante', label: 'CUADRANTE', type: 'autocomplete' },
              ].map(({ key, label, type, options, required }) => (
                <div key={key} className={key === 'relato' ? 'md:col-span-2' : ''}>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {type === 'select' ? (
                    <div className="relative">
                      <select
                        value={(formData as any)[key]}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                        className={`${inputModalStyle} cursor-pointer pr-8 appearance-none${formErrors[key] ? ' border-red-400' : ''}`}
                      >
                        <option value="">--</option>
                        {options!.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>
                  ) : type === 'autocomplete' ? (
                    <div className="relative" ref={quadrantRef}>
                      <input
                        type="text"
                        value={(formData as any)[key]}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, [key]: e.target.value }));
                          setShowQuadrantDropdown(true);
                          setQuadrantActiveIndex(-1);
                        }}
                        onFocus={() => setShowQuadrantDropdown(true)}
                        onKeyDown={(e) => {
                          if (!showQuadrantDropdown) return;
                          const filtered = quadrantOptions.filter(q => q.toLowerCase().includes((formData.cuadrante || '').toLowerCase()));
                          if (e.key === 'ArrowDown') { e.preventDefault(); setQuadrantActiveIndex(prev => (prev + 1) % filtered.length); }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setQuadrantActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length); }
                          if (e.key === 'Enter' && quadrantActiveIndex >= 0) { e.preventDefault(); setFormData(prev => ({ ...prev, cuadrante: filtered[quadrantActiveIndex] })); setShowQuadrantDropdown(false); }
                        }}
                        className={`${inputModalStyle}${formErrors[key] ? ' border-red-400' : ''}`}
                        placeholder="Escriba o seleccione..."
                      />
                      {showQuadrantDropdown && (() => {
                        const filtered = quadrantOptions.filter(q => q.toLowerCase().includes((formData.cuadrante || '').toLowerCase()));
                        return filtered.length > 0 ? (
                          <div className="absolute z-[9999] w-full bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[180px] overflow-y-auto ring-1 ring-black ring-opacity-5">
                            {filtered.slice(0, 30).map((q, idx) => (
                              <div
                                key={q}
                                onMouseEnter={() => setQuadrantActiveIndex(idx)}
                                onMouseDown={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, cuadrante: q })); setShowQuadrantDropdown(false); }}
                                className={`px-3 py-2 text-[12px] cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${quadrantActiveIndex === idx ? 'bg-primary text-white' : 'text-slate-700 hover:bg-blue-50'}`}
                              >
                                {q}
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : type === 'number' ? (
                    <input
                      type="number"
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className={`${inputModalStyle}${formErrors[key] ? ' border-red-400' : ''}`}
                      min="0"
                    />
                  ) : (
                    <input
                      type={type}
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className={`${inputModalStyle}${formErrors[key] ? ' border-red-400' : ''}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                className="px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveVehicle}
                disabled={saving || !formData.placa.trim()}
                className="px-6 py-2.5 bg-primary text-white rounded-lg text-[12px] font-bold uppercase tracking-wider hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleSearchView;
