import React, { useState, useRef, useEffect } from 'react';
import { VehicleRQ } from '../types';
import { Search, XCircle, AlertCircle } from 'lucide-react';

declare const google: any;

const VehicleSearchView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<VehicleRQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = () => {
    const term = searchTerm.trim();
    if (!term) return;

    setLoading(true);
    setSearched(true);

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
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por placa (ej: ABC-123)..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchTerm && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchTerm.trim()}
            className="px-6 py-3 bg-primary text-white rounded-lg text-[13px] font-bold uppercase tracking-wider hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {loading ? 'Buscando...' : 'Buscar'}
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
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="text-left px-4 py-3">SADE</th>
                  <th className="text-left px-4 py-3">FECHA</th>
                  <th className="text-left px-4 py-3">TIPO</th>
                  <th className="text-left px-4 py-3">MARCA</th>
                  <th className="text-left px-4 py-3">MODELO</th>
                  <th className="text-left px-4 py-3">COLOR</th>
                  <th className="text-left px-4 py-3">PLACA</th>
                  <th className="text-left px-4 py-3">RELATO</th>
                  <th className="text-left px-4 py-3">TIPO DELITO</th>
                  <th className="text-left px-4 py-3">SUBTIPO</th>
                  <th className="text-left px-4 py-3">SECTOR</th>
                  <th className="text-left px-4 py-3">CUADRANTE</th>
                </tr>
              </thead>
              <tbody>
                {results.map((v, i) => (
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
    </div>
  );
};

export default VehicleSearchView;
