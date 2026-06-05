import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UnitData, AppSettings, UnitStatus } from '@/types';

interface MapViewProps {
  allSectorsData: Record<string, { units: UnitData[]; settings: AppSettings }>;
  settings: AppSettings;
}

interface QuadrantDetail {
  total: number;
  choferes: number;
  motos: number;
  serenos: number;
  units: { id: string; personnel1: string; type: string; plate: string }[];
}

function normalizeQuadrant(val: string): string {
  return val.trim().toUpperCase();
}

function parseQuadrants(val: string): string[] {
  if (!val || !val.trim()) return [];
  return val.split(',').map(v => normalizeQuadrant(v)).filter(Boolean);
}

const TYPE_ICONS: Record<string, string> = {
  CHOFER: 'directions_car',
  MOTO: 'motorcycle',
  SERENO: 'hail',
};

const TYPE_LABELS: Record<string, string> = {
  CHOFER: 'CHOFER',
  MOTO: 'MOTO',
  SERENO: 'SERENO',
};

function buildPopupContent(quadrantName: string, detail: QuadrantDetail | undefined): string {
  if (!detail || detail.total === 0) {
    return `
      <div class="min-w-[240px] font-sans pb-1">
        <h3 class="text-[16px] font-bold text-slate-900 mb-4 tracking-tight">Cuadrante ${quadrantName}</h3>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-slate-200 flex shrink-0 items-center justify-center text-slate-500 font-bold text-lg">
            0
          </div>
          <div>
            <div class="font-bold text-slate-700 text-[14px] leading-tight">Sin asignación</div>
            <div class="text-slate-500 text-[12px] mt-0.5">Sin personal activo</div>
          </div>
        </div>
        <div class="text-slate-500 text-[13px] flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px]">info</span>
          No hay unidades en este cuadrante
        </div>
      </div>`;
  }

  const unitsListHtml = detail.units.map(u => {
    const icon = TYPE_ICONS[u.type] || 'radio';
    const label = u.personnel1 || u.id || 'Desconocido';
    const plateText = u.plate ? ` • ${u.plate}` : '';
    return `
      <div class="flex items-start gap-2.5 mb-2.5">
        <span class="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">${icon}</span>
        <div class="flex flex-col">
          <span class="text-slate-500 text-[13px] font-medium leading-snug">${label}</span>
          <span class="text-slate-400 text-[11px] leading-none mt-0.5">${u.type}${plateText}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="min-w-[260px] font-sans pb-1">
      <h3 class="text-[16px] font-bold text-slate-900 mb-4 tracking-tight">Cuadrante ${quadrantName}</h3>
      
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 rounded-full bg-[#00c9a7] flex shrink-0 items-center justify-center text-white font-bold text-lg shadow-sm">
          ${detail.total}
        </div>
        <div>
          <div class="font-bold text-slate-700 text-[14px] leading-tight">Unidades Activas</div>
          <div class="text-slate-500 text-[12px] mt-0.5">
             ${detail.choferes} Autos · ${detail.motos} Motos · ${detail.serenos} Serenos
          </div>
        </div>
      </div>

      <div class="max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
        ${unitsListHtml}
      </div>
    </div>
  `;
}

const MapView: React.FC<MapViewProps> = ({ allSectorsData, settings }) => {
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lReady, setLReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  const quadrantDetailMap = useMemo(() => {
    const map = new Map<string, QuadrantDetail>();

    Object.values(allSectorsData).forEach(sd => {
      sd.units.forEach(u => {
        const quadrants = parseQuadrants(u.quadrant || '');
        if (quadrants.length === 0) return;

        const isActive = u.status === UnitStatus.PATRULLANDO || u.status === UnitStatus.SIN_VEHICULO;
        if (!isActive) return;

        const entry: { id: string; personnel1: string; type: string; plate: string } = {
          id: u.id || '',
          personnel1: u.personnel1 || '',
          type: u.type,
          plate: u.plate || '',
        };

        quadrants.forEach(q => {
          if (!map.has(q)) {
            map.set(q, { total: 0, choferes: 0, motos: 0, serenos: 0, units: [] });
          }
          const d = map.get(q)!;
          d.total++;
          if (u.type === 'CHOFER') d.choferes++;
          else if (u.type === 'MOTO') d.motos++;
          else if (u.type === 'SERENO') d.serenos++;
          d.units.push(entry);
        });
      });
    });

    return map;
  }, [allSectorsData]);

  const getQuadrantStyle = (quadrantName: string) => {
    const name = normalizeQuadrant(quadrantName);
    const hasUnits = quadrantDetailMap.has(name) && quadrantDetailMap.get(name)!.total > 0;
    return {
      color: hasUnits ? '#00c9a7' : '#ff0000',
      weight: 3,
      fillColor: hasUnits ? '#00c9a7' : '#ff0000',
      fillOpacity: 0.5
    };
  };

  useEffect(() => {
    const checkL = setInterval(() => {
      if ((window as any).L) {
        setLReady(true);
        clearInterval(checkL);
      }
    }, 200);
    return () => clearInterval(checkL);
  }, []);

  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      setLoadingData(true);
      google.script.run
        .withSuccessHandler((dataStr: string) => {
          try {
            if (!dataStr) {
              console.error('MAP: Empty response from GAS');
              return;
            }
            const data = JSON.parse(dataStr);
            setGeoJsonData(data);
          } catch (e) {
            console.error('MAP: Parse error:', e);
          } finally {
            setLoadingData(false);
          }
        })
        .withFailureHandler((err: any) => {
          console.error('MAP: GAS Error:', err);
          setLoadingData(false);
        })
        .getQuadrantsData();
    }
  }, []);

  useEffect(() => {
    if (!lReady || !containerRef.current || mapRef.current) return;

    try {
      const L = (window as any).L;
      const map = L.map(containerRef.current).setView([-12.128, -76.995], 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 500);
    } catch (e) {
      console.error('MAP: Init error:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoJsonData) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    if (geoJsonData.features && geoJsonData.features.length > 0) {
      const L = (window as any).L;
      const geoLayer = L.geoJson(geoJsonData, {
        style: (feature: any) => {
          const name = feature?.properties?.name || '';
          return getQuadrantStyle(name);
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = normalizeQuadrant(feature.properties?.name || '');
          const detail = quadrantDetailMap.get(name);
          layer.bindPopup(buildPopupContent(name, detail));
          layer.on('mouseover', () => {
            layer.setStyle({ weight: 4, fillOpacity: 0.7 });
          });
          layer.on('mouseout', () => {
            const hasUnits = detail && detail.total > 0;
            layer.setStyle({
              color: hasUnits ? '#00c9a7' : '#ff0000',
              weight: 3,
              fillColor: hasUnits ? '#00c9a7' : '#ff0000',
              fillOpacity: 0.5
            });
          });
        }
      });

      const labelsLayer = L.layerGroup();
      geoLayer.eachLayer((layer: any) => {
        if (layer.getBounds && layer.feature) {
          const name = normalizeQuadrant(layer.feature.properties?.name || '');
          const center = layer.getBounds().getCenter();
          const marker = L.marker(center, {
            icon: L.divIcon({
              className: '',
              html: `<div class="bg-white/90 border-[2px] border-[#002d5a] text-[#002d5a] rounded-full w-6 h-6 flex items-center justify-center font-bold text-[9px] shadow-sm pointer-events-none">${name}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            }),
            interactive: false
          });
          labelsLayer.addLayer(marker);
        }
      });

      const combinedGroup = L.featureGroup([geoLayer, labelsLayer]).addTo(map);
      geoLayerRef.current = combinedGroup;
    }
  }, [geoJsonData, quadrantDetailMap]);

  const totalQuadrants = geoJsonData?.features?.length || 0;
  const occupiedCount = geoJsonData?.features
    ? geoJsonData.features.filter((f: any) => {
        const d = quadrantDetailMap.get(normalizeQuadrant(f.properties?.name || ''));
        return d && d.total > 0;
      }).length
    : 0;

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
      <div className="relative z-0 flex-1" style={{ minHeight: '750px', width: '100%' }}>
        {(loadingData || !lReady) && (
          <div className="absolute inset-0 z-[2000] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#002d5a] border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-[#002d5a] font-bold tracking-wider">CARGANDO MAPA...</span>
          </div>
        )}
        <div 
          ref={containerRef} 
          style={{ height: '100%', width: '100%', background: '#f8fafc' }}
          className="absolute inset-0 z-0"
        ></div>
        
        {totalQuadrants > 0 && (
          <div className="absolute bottom-6 right-6 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-xl p-4 min-w-[220px]">
            <h3 className="text-xs font-bold text-[#002d5a] uppercase tracking-wider mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">map</span>
              Leyenda
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-[#00c9a7] opacity-60 border-2 border-[#00c9a7]"></span>
                  <span className="font-medium text-slate-700">Con Personal</span>
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{occupiedCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-[#ff0000] opacity-60 border-2 border-[#ff0000]"></span>
                  <span className="font-medium text-slate-700">Sin Personal</span>
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{totalQuadrants - occupiedCount}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500 uppercase tracking-wider">Total</span>
                <span className="font-bold text-[#002d5a]">{totalQuadrants}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
